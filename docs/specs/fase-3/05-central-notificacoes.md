# Spec Fase 3.05 — Central de Notificações

## Contexto

As specs 02, 03 e 04 criaram os eventos da Fase 3: um encaminhamento chega, uma restrição é emitida, uma solicitação é respondida, uma nota relevante é registrada. Mas hoje o profissional só descobre se abrir a página certa. Falta o mecanismo que **avisa proativamente**: "você tem 2 encaminhamentos pendentes", "o fisioterapeuta emitiu uma restrição para seu aluno João".

A Fase 2.02 deliberadamente *não* persistiu alertas — eles eram calculados a cada render porque não tinham estado. Notificações são diferentes: têm ciclo de vida (não lida → lida) e referenciam um evento específico no tempo. Por isso **são armazenadas**.

## Objetivo

Criar a tabela `notifications`, popular automaticamente via **triggers** quando os eventos da Fase 3 ocorrem, e expor uma **central de notificações** no header: sino com contador de não lidas + dropdown com a lista. Esta é a última spec da Fase 3 porque consome eventos gerados por todas as anteriores.

---

## Tarefa 1 — Migration 031

**Arquivo**: `supabase/migrations/031_notifications.sql` (novo)

```sql
-- ============================================
-- Migration 031: Central de notificações
-- Eventos da comunicação interdisciplinar (Fase 3)
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Destinatário: sempre por profile_id (cobre treinador, nutri, fisio, manager)
    recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'referral_received', 'referral_replied', 'referral_status_changed',
        'clearance_issued', 'shared_note_added'
    )),
    title TEXT NOT NULL,
    body TEXT,
    -- Para onde levar ao clicar
    link TEXT,
    -- Origem opcional, para deduplicar/agrupar
    source_table TEXT,
    source_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- RLS — cada um só vê e marca como lidas as SUAS notificações.
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own_select ON notifications
    FOR SELECT TO authenticated
    USING (recipient_profile_id = auth.uid());

CREATE POLICY notifications_own_update ON notifications
    FOR UPDATE TO authenticated
    USING (recipient_profile_id = auth.uid())
    WITH CHECK (recipient_profile_id = auth.uid());

-- Inserts vêm dos triggers (SECURITY DEFINER) — nenhuma policy de INSERT para
-- usuários comuns, evitando que alguém crie notificação para terceiros.

-- ============================================
-- Helper: profile_id dono de um professional_id
-- ============================================
CREATE OR REPLACE FUNCTION public.profile_of_professional(p_professional_id UUID)
RETURNS UUID AS $$
    SELECT profile_id FROM professionals WHERE id = p_professional_id LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ============================================
-- Trigger 1: novo encaminhamento → notifica o destinatário
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_created()
RETURNS TRIGGER AS $$
DECLARE
    recipient UUID;
    student_name TEXT;
BEGIN
    recipient := public.profile_of_professional(NEW.to_professional_id);
    SELECT full_name INTO student_name FROM students WHERE id = NEW.student_id;

    INSERT INTO notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
    VALUES (
        recipient,
        'referral_received',
        CASE NEW.type WHEN 'request' THEN 'Nova solicitação' ELSE 'Novo encaminhamento' END,
        COALESCE(student_name, 'Aluno') || ': ' || NEW.subject,
        '/dashboard/messages',
        'interdisciplinary_referrals',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_referral_created
    AFTER INSERT ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_created();

-- ============================================
-- Trigger 2: mudança de status → notifica o remetente
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_status()
RETURNS TRIGGER AS $$
DECLARE
    recipient UUID;
    student_name TEXT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        recipient := public.profile_of_professional(NEW.from_professional_id);
        SELECT full_name INTO student_name FROM students WHERE id = NEW.student_id;
        INSERT INTO notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
        VALUES (
            recipient,
            'referral_status_changed',
            'Atualização em encaminhamento',
            COALESCE(student_name, 'Aluno') || ': ' || NEW.subject || ' — ' ||
            CASE NEW.status
                WHEN 'accepted' THEN 'aceito'
                WHEN 'completed' THEN 'concluído'
                WHEN 'declined' THEN 'recusado'
                ELSE NEW.status
            END,
            '/dashboard/messages',
            'interdisciplinary_referrals',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_referral_status
    AFTER UPDATE ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_status();

-- ============================================
-- Trigger 3: nova resposta → notifica o OUTRO participante
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_referral_replied()
RETURNS TRIGGER AS $$
DECLARE
    ref RECORD;
    author_profile UUID;
    recipient UUID;
BEGIN
    SELECT * INTO ref FROM interdisciplinary_referrals WHERE id = NEW.referral_id;
    author_profile := public.profile_of_professional(NEW.author_professional_id);

    -- Notifica quem NÃO é o autor da resposta
    recipient := CASE
        WHEN public.profile_of_professional(ref.from_professional_id) = author_profile
            THEN public.profile_of_professional(ref.to_professional_id)
        ELSE public.profile_of_professional(ref.from_professional_id)
    END;

    INSERT INTO notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
    VALUES (recipient, 'referral_replied', 'Nova resposta', ref.subject,
            '/dashboard/messages', 'interdisciplinary_referrals', ref.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_referral_replied
    AFTER INSERT ON referral_replies
    FOR EACH ROW EXECUTE FUNCTION public.notify_referral_replied();

-- ============================================
-- Trigger 4: restrição emitida → notifica o(s) treinador(es) do aluno
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_clearance_issued()
RETURNS TRIGGER AS $$
DECLARE
    student_name TEXT;
    trainer_profile UUID;
BEGIN
    SELECT full_name INTO student_name FROM students WHERE id = NEW.student_id;

    -- Notifica cada treinador vinculado ao aluno (legado trainer_id + student_professionals)
    FOR trainer_profile IN
        SELECT DISTINCT pr.id
        FROM (
            SELECT t.profile_id AS pid
            FROM students s JOIN trainers t ON t.id = s.trainer_id
            WHERE s.id = NEW.student_id
            UNION
            SELECT p.profile_id AS pid
            FROM student_professionals sp
            JOIN professionals p ON p.id = sp.professional_id
            WHERE sp.student_id = NEW.student_id AND sp.status = 'active'
              AND p.profession_type = 'trainer'
        ) src
        JOIN profiles pr ON pr.id = src.pid
        WHERE pr.id <> public.profile_of_professional(NEW.issued_by_professional_id)
    LOOP
        INSERT INTO notifications (recipient_profile_id, type, title, body, link, source_table, source_id)
        VALUES (
            trainer_profile,
            'clearance_issued',
            CASE NEW.clearance_level
                WHEN 'contraindicated' THEN 'Contraindicação clínica'
                WHEN 'restricted' THEN 'Nova restrição clínica'
                ELSE 'Liberação clínica'
            END,
            COALESCE(student_name, 'Aluno') || ': ' || NEW.description,
            '/dashboard/trainer/students/' || NEW.student_id,
            'student_clearances',
            NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_clearance_issued
    AFTER INSERT ON student_clearances
    FOR EACH ROW EXECUTE FUNCTION public.notify_clearance_issued();
```

### Notas de implementação

- **Triggers, não server actions**: garante que a notificação é criada de forma consistente independentemente de qual caminho de código originou o evento, e em transação com o insert. `SECURITY DEFINER` permite escrever em `notifications` mesmo sem policy de insert pública.
- **Notas compartilhadas (`shared_note_added`)**: notificar *todos* os profissionais do aluno a cada nota pode gerar ruído. **Recomendação para o MVP**: NÃO disparar notificação para nota comum; deixar o tipo no enum para uso futuro (ex.: só notificar se a nota for categoria `health`). Documente a decisão e, se decidir incluir, replique o padrão do trigger 4 iterando sobre os profissionais vinculados exceto o autor.
- **Link do clearance**: aponta para a ficha do treinador. Se o destinatário for manager, ajuste o link no frontend conforme o role, ou use um link genérico `/dashboard`.

---

## Tarefa 2 — Tipos

**Arquivo**: `web/src/types/database.ts`

```typescript
export type NotificationType =
  | 'referral_received'
  | 'referral_replied'
  | 'referral_status_changed'
  | 'clearance_issued'
  | 'shared_note_added';

export interface AppNotification {
  id: string;
  recipient_profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  source_table: string | null;
  source_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}
```

---

## Tarefa 3 — Server Actions

**Arquivo**: `web/src/app/actions/notifications.ts` (novo)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AppNotification } from '@/types/database';

export async function getNotifications(limit = 20): Promise<AppNotification[]> {
    const supabase = await createClient();   // RLS já restringe ao próprio usuário
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    return data || [];
}

export async function getUnreadCount(): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
    return count ?? 0;
}

export async function markNotificationRead(id: string) {
    const supabase = await createClient();
    await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function markAllNotificationsRead() {
    const supabase = await createClient();
    await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false);
    revalidatePath('/dashboard');
    return { success: true };
}
```

> Como o RLS limita as linhas ao `recipient_profile_id = auth.uid()`, os updates sem filtro de id (markAll) só afetam as notificações do próprio usuário.

---

## Tarefa 4 — Sino de Notificações no Header

O layout atual (`web/src/app/dashboard/layout.tsx`) tem sidebar à esquerda mas não há um header global com ações. Esta spec adiciona um sino.

**Arquivos**:
- `web/src/components/notifications/notification-bell.tsx` (novo, `'use client'`)
- `web/src/app/dashboard/layout.tsx` (renderizar o sino)

### 4.1 Layout

No `dashboard/layout.tsx`, adicionar uma barra superior fina (sticky) na área de conteúdo, à direita, contendo o `NotificationBell`. Buscar dados iniciais no server:

```typescript
import { getNotifications, getUnreadCount } from '@/app/actions/notifications';
import { NotificationBell } from '@/components/notifications/notification-bell';

// dentro do layout (server component):
const [notifications, unreadCount] = await Promise.all([
    getNotifications(20),
    getUnreadCount(),
]);

// no JSX, topo da área de conteúdo:
<header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-zinc-200 bg-white/80 px-6 backdrop-blur">
    <NotificationBell initialNotifications={notifications} initialUnread={unreadCount} />
</header>
```

### 4.2 Componente

```typescript
'use client';

import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications';
import type { AppNotification } from '@/types/database';

interface NotificationBellProps {
    initialNotifications: AppNotification[];
    initialUnread: number;
}

export function NotificationBell({ initialNotifications, initialUnread }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    // ... dropdown (reusar Radix DropdownMenu já instalado)
}
```

Comportamento:
- Ícone `Bell` com badge vermelho (contador) se `unread > 0`. Esconder badge se 0.
- Dropdown (`@radix-ui/react-dropdown-menu`, já dependência) com: cabeçalho + "Marcar todas como lidas", lista das notificações (título, corpo, tempo relativo, não lidas com fundo destacado).
- Clicar numa notificação: `markNotificationRead(id)` + `router.push(notification.link)`.
- Ícone por `type` (reusar mapa de ícones: encaminhamento → ArrowRightLeft, status → CheckCircle, resposta → MessageSquare, restrição → ShieldAlert).

### 4.3 Atualização do contador

Sem websockets (decisão da Fase 3). Opções, do mais simples ao mais robusto:
1. **MVP**: contador atualiza a cada navegação (o layout é server component e re-busca). Suficiente para o volume do estúdio.
2. **Opcional**: `router.refresh()` num `setInterval` de ~60s dentro do `NotificationBell`, ou Supabase Realtime subscription na tabela `notifications` filtrando por `recipient_profile_id`. Documentar como evolução, não obrigatório agora.

---

## Tarefa 5 — Badge no link "Mensagens" do Sidebar

**Arquivo**: `web/src/components/sidebar.tsx`

Agora que existe `getPendingReferralCount` (spec 01) e `getUnreadCount` (esta spec), exibir um badge numérico no item "Mensagens" quando houver pendências. Como o sidebar é client component, passar a contagem via prop a partir do layout (server), seguindo o padrão de `professionType`/`userName` já usados.

---

## Estrutura de arquivos

```
supabase/migrations/
└── 031_notifications.sql                          # tabela + RLS + 4 triggers

web/src/
├── types/database.ts                              # + tipos de notificação
├── app/actions/notifications.ts                   # actions
├── components/notifications/notification-bell.tsx # sino + dropdown
├── app/dashboard/layout.tsx                       # header com o sino + badge no sidebar
└── components/sidebar.tsx                          # badge no link "Mensagens"
```

---

## Checklist

### Banco
- [ ] Criar migration 031 (tabela, indexes, RLS, helper, 4 triggers)
- [ ] Testar trigger 1: criar encaminhamento → destinatário recebe `referral_received`
- [ ] Testar trigger 2: mudar status → remetente recebe `referral_status_changed`
- [ ] Testar trigger 3: responder → o outro participante recebe `referral_replied`
- [ ] Testar trigger 4: fisio emite restrição → treinador(es) do aluno recebem `clearance_issued`
- [ ] Confirmar que ninguém consegue inserir notificação para outro usuário (sem policy de insert pública)
- [ ] Decidir e documentar comportamento de `shared_note_added` (MVP: desligado)

### Tipos e actions
- [ ] Tipos em `database.ts`
- [ ] `notifications.ts` com get/unreadCount/markRead/markAllRead
- [ ] Type check (`npx tsc --noEmit`)

### UI
- [ ] Header com `NotificationBell` no `dashboard/layout.tsx`
- [ ] Badge de não lidas; some quando zero
- [ ] Dropdown lista, marca como lida ao clicar e navega para o link
- [ ] "Marcar todas como lidas" funciona
- [ ] Badge de pendências no link "Mensagens" do sidebar

### Verificação
- [ ] Fluxo completo: A encaminha para B → B vê badge no sino → clica → vai para a thread → badge zera
- [ ] Fisio emite restrição → treinador recebe notificação e o link abre a ficha do aluno
- [ ] RLS: usuário só vê as próprias notificações
- [ ] Responsividade mobile do dropdown

---

## Resultado Esperado

Cada profissional tem um sino no topo do dashboard que acende quando há algo para ele: um encaminhamento recebido, uma resposta, uma restrição emitida sobre seu aluno. As notificações são geradas automaticamente por triggers no banco — consistentes e em transação com o evento de origem — e some o badge ao serem lidas. A Fase 3 fica completa: os profissionais não só veem os dados uns dos outros (Fase 2), como agora se comunicam, agem e são avisados dentro do Playbook.
</content>
