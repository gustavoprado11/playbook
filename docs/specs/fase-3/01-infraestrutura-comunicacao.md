# Spec Fase 3.01 — Infraestrutura de Comunicação

## Contexto

A Fase 2 deu **visibilidade** cruzada: o gestor e o treinador veem dados de nutrição e fisio na aba 360°. Mas ninguém consegue **agir** sobre o que vê. Se o fisioterapeuta percebe que o aluno precisa ajustar o treino, ele manda mensagem no WhatsApp. Se o treinador quer encaminhar um aluno para o nutricionista, não há registro disso no sistema.

A Fase 3 cria a camada de comunicação estruturada. Esta primeira spec entrega a **fundação de dados**: a tabela central de mensagens interdisciplinares, suas respostas, as políticas de acesso e as server actions base. As specs seguintes (02, 03, 04, 05) constroem as funcionalidades sobre essa fundação.

## Objetivo

Criar a tabela `interdisciplinary_referrals` (encaminhamentos, solicitações, alertas e liberações), a tabela de respostas `referral_replies`, suas políticas RLS baseadas em **vínculo compartilhado** (dois profissionais que atendem o mesmo aluno), os tipos TypeScript e as server actions CRUD base.

---

## Modelo de Dados

### Decisão: uma tabela polimórfica por `type`

O PRD (seção 5) propôs uma única tabela `interdisciplinary_referrals` com `type IN ('referral', 'request', 'alert', 'clearance')`. Mantemos esse desenho porque os quatro tipos compartilham o mesmo ciclo de vida (origem → destino → status) e a mesma estrutura de thread. As **liberações clínicas** (`clearance`) ganham uma tabela própria e estruturada na spec 03 (pois precisam de campos específicos e impactam o treino), mas o `interdisciplinary_referrals` continua sendo o canal de `referral` e `request`. O tipo `alert` é reservado para uso futuro.

### Conceito de "vínculo compartilhado"

A regra de acesso central da Fase 3: **dois profissionais podem se comunicar sobre um aluno se ambos têm vínculo ativo com esse aluno** em `student_professionals` (ou, para treinadores, via `students.trainer_id`). Isso evita que um nutricionista mande mensagem sobre um aluno que ele não atende.

---

## Tarefa 1 — Migration 028: tabelas e RLS

**Arquivo**: `supabase/migrations/028_interdisciplinary_communication.sql` (novo)

```sql
-- ============================================
-- Migration 028: Comunicação interdisciplinar (base)
-- Encaminhamentos, solicitações e respostas entre profissionais
-- ============================================

-- Tabela central de mensagens interdisciplinares
CREATE TABLE IF NOT EXISTS interdisciplinary_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    to_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('referral', 'request', 'alert', 'clearance')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    subject TEXT NOT NULL,
    body TEXT,
    -- Referência opcional a um registro de origem (consulta, sessão, exame...)
    -- Não usa FK porque pode apontar para tabelas diferentes; guarda tabela+id.
    context_ref JSONB,         -- ex: { "table": "physio_sessions", "id": "uuid" }
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'completed', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    -- Não faz sentido encaminhar para si mesmo
    CONSTRAINT referral_distinct_professionals CHECK (from_professional_id <> to_professional_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_student ON interdisciplinary_referrals(student_id);
CREATE INDEX IF NOT EXISTS idx_referrals_from ON interdisciplinary_referrals(from_professional_id);
CREATE INDEX IF NOT EXISTS idx_referrals_to ON interdisciplinary_referrals(to_professional_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON interdisciplinary_referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_to_status ON interdisciplinary_referrals(to_professional_id, status);

-- Respostas dentro de um encaminhamento (thread)
CREATE TABLE IF NOT EXISTS referral_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES interdisciplinary_referrals(id) ON DELETE CASCADE,
    author_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_replies_referral ON referral_replies(referral_id);

-- updated_at trigger (reusa o padrão das fases anteriores se já existir set_updated_at())
CREATE TRIGGER set_referrals_updated_at
    BEFORE UPDATE ON interdisciplinary_referrals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- Helper: o usuário autenticado atende este aluno?
-- (como treinador via students.trainer_id OU como profissional via student_professionals)
-- ============================================
CREATE OR REPLACE FUNCTION public.attends_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        -- profissional vinculado (nutri/fisio/treinador via student_professionals)
        SELECT 1
        FROM student_professionals sp
        JOIN professionals p ON p.id = sp.professional_id
        WHERE sp.student_id = p_student_id
          AND sp.status = 'active'
          AND p.profile_id = auth.uid()
          AND p.is_active = true
        UNION
        -- treinador via vínculo legado students.trainer_id
        SELECT 1
        FROM students s
        JOIN trainers t ON t.id = s.trainer_id
        WHERE s.id = p_student_id
          AND t.profile_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- RLS: interdisciplinary_referrals
-- ============================================
ALTER TABLE interdisciplinary_referrals ENABLE ROW LEVEL SECURITY;

-- Manager: leitura total (acompanhamento), sem precisar criar/responder
CREATE POLICY referrals_manager_select ON interdisciplinary_referrals
    FOR SELECT TO authenticated
    USING (public.is_manager());

-- Profissional vê mensagens em que é remetente OU destinatário
CREATE POLICY referrals_participant_select ON interdisciplinary_referrals
    FOR SELECT TO authenticated
    USING (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    );

-- Criar: só posso enviar como mim mesmo, para alguém, sobre um aluno que EU atendo
CREATE POLICY referrals_insert ON interdisciplinary_referrals
    FOR INSERT TO authenticated
    WITH CHECK (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND public.attends_student(student_id)
    );

-- Atualizar: remetente (cancelar/editar) ou destinatário (mudar status)
CREATE POLICY referrals_update ON interdisciplinary_referrals
    FOR UPDATE TO authenticated
    USING (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    )
    WITH CHECK (
        from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    );

-- ============================================
-- RLS: referral_replies
-- ============================================
ALTER TABLE referral_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_replies_manager_select ON referral_replies
    FOR SELECT TO authenticated
    USING (public.is_manager());

-- Vê respostas de threads em que participa
CREATE POLICY referral_replies_participant_select ON referral_replies
    FOR SELECT TO authenticated
    USING (
        referral_id IN (
            SELECT id FROM interdisciplinary_referrals
            WHERE from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
               OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        )
    );

-- Responde quem participa da thread, escrevendo como ele mesmo
CREATE POLICY referral_replies_insert ON referral_replies
    FOR INSERT TO authenticated
    WITH CHECK (
        author_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND referral_id IN (
            SELECT id FROM interdisciplinary_referrals
            WHERE from_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
               OR to_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        )
    );
```

### Notas de implementação

- **`set_updated_at()`**: verifique se já existe (foi usada em migrations anteriores de nutrição/fisio). Se o nome for outro no projeto, use o trigger existente. Se não existir, crie-a antes do trigger.
- **`context_ref` (JSONB)**: permite que um encaminhamento aponte para o registro que o motivou (ex.: "encaminho por causa desta sessão de fisio"). A spec 02 usa isso para renderizar um link "ver origem". Não há FK porque o alvo varia de tabela.
- **`attends_student()`** cobre os dois modelos de vínculo (legado `trainer_id` e novo `student_professionals`), garantindo que treinadores também participem da comunicação.

---

## Tarefa 2 — Tipos TypeScript

**Arquivo**: `web/src/types/database.ts`

Adicionar os enums e interfaces seguindo o padrão do arquivo:

```typescript
// Enums (junto aos demais no topo)
export type ReferralType = 'referral' | 'request' | 'alert' | 'clearance';
export type ReferralPriority = 'low' | 'normal' | 'high';
export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'declined';

// Interfaces
export interface InterdisciplinaryReferral {
  id: string;
  student_id: string;
  from_professional_id: string;
  to_professional_id: string;
  type: ReferralType;
  priority: ReferralPriority;
  subject: string;
  body: string | null;
  context_ref: { table: string; id: string } | null;
  status: ReferralStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  // Joined fields (preenchidos nas actions)
  student?: { id: string; full_name: string };
  from_professional?: { id: string; profession_type: ProfessionType; full_name: string };
  to_professional?: { id: string; profession_type: ProfessionType; full_name: string };
  replies?: ReferralReply[];
  reply_count?: number;
}

export interface ReferralReply {
  id: string;
  referral_id: string;
  author_professional_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string; profession_type: ProfessionType };
}
```

---

## Tarefa 3 — Server Actions base

**Arquivo**: `web/src/app/actions/referrals.ts` (novo)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import type {
    InterdisciplinaryReferral,
    ReferralReply,
    ReferralType,
    ReferralPriority,
    ReferralStatus,
} from '@/types/database';

// Resolve o professional_id do usuário autenticado (qualquer profissão).
async function getMyProfessionalId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    return data?.id ?? null;
}

interface CreateReferralInput {
    studentId: string;
    toProfessionalId: string;
    type: ReferralType;
    subject: string;
    body?: string;
    priority?: ReferralPriority;
    contextRef?: { table: string; id: string };
}

export async function createReferral(input: CreateReferralInput) {
    const fromId = await getMyProfessionalId();
    if (!fromId) return { error: 'Profissional não encontrado.' };
    if (fromId === input.toProfessionalId) {
        return { error: 'Não é possível encaminhar para si mesmo.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('interdisciplinary_referrals')
        .insert({
            student_id: input.studentId,
            from_professional_id: fromId,
            to_professional_id: input.toProfessionalId,
            type: input.type,
            subject: input.subject,
            body: input.body ?? null,
            priority: input.priority ?? 'normal',
            context_ref: input.contextRef ?? null,
        })
        .select('id')
        .single();

    // O RLS bloqueia o insert se o usuário não atende o aluno → erro tratado aqui.
    if (error) return { error: 'Não foi possível criar o encaminhamento.' };

    // A spec 05 dispara a notificação para o destinatário (via trigger no banco).
    revalidatePath('/dashboard');
    return { data };
}

// Muda o status (aceitar, concluir, recusar). Só o destinatário deveria mudar status;
// o remetente pode cancelar marcando como 'declined'. RLS já restringe a participantes.
export async function updateReferralStatus(referralId: string, status: ReferralStatus) {
    const supabase = await createClient();
    const resolved = ['completed', 'declined'].includes(status);
    const { error } = await supabase
        .from('interdisciplinary_referrals')
        .update({
            status,
            resolved_at: resolved ? new Date().toISOString() : null,
        })
        .eq('id', referralId);

    if (error) return { error: 'Não foi possível atualizar o status.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function addReferralReply(referralId: string, body: string) {
    const authorId = await getMyProfessionalId();
    if (!authorId) return { error: 'Profissional não encontrado.' };

    const supabase = await createClient();
    const { error } = await supabase.from('referral_replies').insert({
        referral_id: referralId,
        author_professional_id: authorId,
        body,
    });

    if (error) return { error: 'Não foi possível enviar a resposta.' };
    revalidatePath('/dashboard');
    return { success: true };
}

// Caixa de entrada: recebidos / enviados. Usa adminClient só para fazer os joins
// de nome/profissão de forma confiável; o filtro por participante é explícito.
export async function getMyReferrals(
    box: 'inbox' | 'sent' = 'inbox'
): Promise<InterdisciplinaryReferral[]> {
    const myId = await getMyProfessionalId();
    if (!myId) return [];

    const admin = createAdminClient();
    const column = box === 'inbox' ? 'to_professional_id' : 'from_professional_id';

    const { data } = await admin
        .from('interdisciplinary_referrals')
        .select(`
            *,
            student:students!student_id(id, full_name),
            from_professional:professionals!from_professional_id(
                id, profession_type, profile:profiles!profile_id(full_name)
            ),
            to_professional:professionals!to_professional_id(
                id, profession_type, profile:profiles!profile_id(full_name)
            ),
            replies:referral_replies(count)
        `)
        .eq(column, myId)
        .order('created_at', { ascending: false });

    return (data || []).map(normalizeReferral);
}

export async function getReferralThread(referralId: string): Promise<InterdisciplinaryReferral | null> {
    const myId = await getMyProfessionalId();
    if (!myId) return null;

    const admin = createAdminClient();
    const { data } = await admin
        .from('interdisciplinary_referrals')
        .select(`
            *,
            student:students!student_id(id, full_name),
            from_professional:professionals!from_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            to_professional:professionals!to_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            replies:referral_replies(
                *, author:professionals!author_professional_id(profession_type, profile:profiles!profile_id(full_name))
            )
        `)
        .eq('id', referralId)
        .single();

    if (!data) return null;
    // Garante que o solicitante participa da thread (defesa extra além do RLS).
    if (data.from_professional_id !== myId && data.to_professional_id !== myId) {
        const profile = await getProfile();
        if (profile?.role !== 'manager') return null;
    }
    return normalizeReferral(data);
}

// Contador para o sino de notificações / badge do inbox.
export async function getPendingReferralCount(): Promise<number> {
    const myId = await getMyProfessionalId();
    if (!myId) return 0;
    const admin = createAdminClient();
    const { count } = await admin
        .from('interdisciplinary_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('to_professional_id', myId)
        .eq('status', 'pending');
    return count ?? 0;
}

// Profissionais que atendem o mesmo aluno — usado no seletor de destinatário.
export async function getCoProfessionals(studentId: string) {
    const myId = await getMyProfessionalId();
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_professionals')
        .select('professional:professionals!professional_id(id, profession_type, profile:profiles!profile_id(full_name))')
        .eq('student_id', studentId)
        .eq('status', 'active');

    return (data || [])
        .map((l: any) => l.professional)
        .filter((p: any) => p && p.id !== myId)
        .map((p: any) => ({
            id: p.id,
            profession_type: p.profession_type,
            full_name: p.profile?.full_name ?? 'Profissional',
        }));
}

function normalizeReferral(row: any): InterdisciplinaryReferral {
    return {
        ...row,
        from_professional: row.from_professional && {
            id: row.from_professional.id,
            profession_type: row.from_professional.profession_type,
            full_name: row.from_professional.profile?.full_name ?? '',
        },
        to_professional: row.to_professional && {
            id: row.to_professional.id,
            profession_type: row.to_professional.profession_type,
            full_name: row.to_professional.profile?.full_name ?? '',
        },
        replies: Array.isArray(row.replies)
            ? row.replies.map((r: any) => ({
                ...r,
                author: r.author && {
                    full_name: r.author.profile?.full_name ?? '',
                    profession_type: r.author.profession_type,
                },
            }))
            : undefined,
        reply_count: Array.isArray(row.replies) && row.replies[0]?.count !== undefined
            ? row.replies[0].count
            : undefined,
    };
}
```

### Notas de implementação

- `getCoProfessionals` lista apenas profissionais com vínculo ativo no aluno — exatamente o universo permitido pelo RLS de insert. Inclua o treinador do aluno se o vínculo legado não estiver espelhado em `student_professionals` (a migration 020 espelha treinadores, então geralmente já aparece).
- Mantenha a checagem dupla (RLS no banco + validações nas actions) seguindo a postura defensiva das fases anteriores.

---

## Estrutura de arquivos

```
supabase/migrations/
└── 028_interdisciplinary_communication.sql   # tabelas + RLS + attends_student()

web/src/
├── types/database.ts                          # + enums e interfaces
└── app/actions/referrals.ts                   # actions base de comunicação
```

---

## Checklist

### Banco
- [ ] Criar migration 028 (tabelas, indexes, helper `attends_student`, RLS, trigger)
- [ ] Confirmar que `public.set_updated_at()` existe; se não, criar antes do trigger
- [ ] Aplicar em branch/local primeiro e validar que RLS bloqueia insert de quem não atende o aluno
- [ ] Testar: nutricionista que atende o aluno consegue criar referral para o treinador do mesmo aluno
- [ ] Testar: profissional sem vínculo recebe erro ao tentar criar

### Tipos e actions
- [ ] Adicionar enums e interfaces em `database.ts`
- [ ] Criar `web/src/app/actions/referrals.ts` com todas as funções
- [ ] Type check (`npx tsc --noEmit`)

### Verificação
- [ ] `createReferral` + `getMyReferrals('inbox')` + `getMyReferrals('sent')` funcionam ponta a ponta
- [ ] `addReferralReply` e `getReferralThread` montam a thread corretamente
- [ ] `getPendingReferralCount` retorna o número certo de pendências
- [ ] Manager consegue ler tudo via `getReferralThread` mesmo sem ser participante

---

## Resultado Esperado

Existe uma fundação de dados e de server actions para comunicação interdisciplinar: é possível criar um encaminhamento/solicitação sobre um aluno para um colega que atende o mesmo aluno, responder em thread, mudar o status e listar caixa de entrada/enviados — tudo protegido por RLS de vínculo compartilhado. A UI vem na spec 02.
</content>
