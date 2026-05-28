# Spec Fase 3.03 — Liberações e Restrições Clínicas

## Contexto

O caso de comunicação mais crítico do estúdio: o fisioterapeuta avalia um aluno com lesão e precisa comunicar ao treinador **o que pode e o que não pode ser feito no treino**. Hoje isso vive num áudio de WhatsApp — o treinador esquece, treina o movimento contraindicado, e o aluno se machuca.

Diferente de um encaminhamento (que é uma conversa pontual), uma **liberação/restrição** é um *estado clínico ativo*: "este aluno está restrito de agachamento profundo até nova avaliação". Esse estado precisa estar **sempre visível** no contexto do treino enquanto vigorar, não enterrado numa caixa de entrada.

## Objetivo

Criar a tabela `student_clearances` (liberações e restrições), o fluxo do fisioterapeuta para emitir/encerrar uma liberação, e a **superfície no módulo de treino**: um banner persistente de restrições ativas na ficha do aluno (treinador e gestor) e na agenda.

> **Escopo**: nesta fase, a liberação é informativa e rastreável — ela alerta e registra, mas **não bloqueia** automaticamente a prescrição de treino (que nem existe ainda, está em "Em evolução"). O objetivo é segurança por visibilidade, não enforcement automático.

---

## Modelo de Dados

### Por que tabela própria (e não o `type='clearance'` do referral)

O `interdisciplinary_referrals` (spec 01) modela uma *mensagem* com ciclo conversacional. Uma liberação clínica precisa de:

- **Estado de vigência** (ativa / encerrada / expirada), consultável a qualquer momento
- **Severidade clínica** (liberado / liberado com ressalvas / restrito / contraindicado)
- **Estrutura** (região do corpo, movimentos/exercícios afetados)
- **Consulta eficiente** "quais restrições ativas este aluno tem agora?"

Isso justifica uma tabela dedicada. O `interdisciplinary_referrals` com `type='clearance'` permanece reservado caso se queira referenciar a liberação numa thread, mas a fonte da verdade é `student_clearances`.

---

## Tarefa 1 — Migration 029

**Arquivo**: `supabase/migrations/029_student_clearances.sql` (novo)

```sql
-- ============================================
-- Migration 029: Liberações e restrições clínicas
-- Fisioterapeuta comunica ao treino o que pode/não pode ser feito
-- ============================================

CREATE TABLE IF NOT EXISTS student_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    -- Quem emitiu (tipicamente fisioterapeuta; modelado genérico)
    issued_by_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    clearance_level TEXT NOT NULL CHECK (clearance_level IN (
        'cleared',            -- liberado sem restrições
        'cleared_with_notes', -- liberado com ressalvas
        'restricted',         -- restrito (evitar certos movimentos)
        'contraindicated'     -- contraindicado (não realizar)
    )),
    body_region TEXT,                 -- ex: 'joelho direito', 'lombar'
    affected_movements TEXT[],        -- ex: ['agachamento profundo', 'impacto', 'salto']
    description TEXT NOT NULL,         -- orientação ao treinador
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted', 'expired')),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    review_date DATE,                 -- quando reavaliar (opcional)
    lifted_at TIMESTAMPTZ,            -- quando foi encerrada
    lifted_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearances_student ON student_clearances(student_id);
CREATE INDEX IF NOT EXISTS idx_clearances_status ON student_clearances(status);
CREATE INDEX IF NOT EXISTS idx_clearances_student_status ON student_clearances(student_id, status);

CREATE TRIGGER set_clearances_updated_at
    BEFORE UPDATE ON student_clearances
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS
-- Quem emite (e managers) escrevem; quem ATENDE o aluno lê.
-- attends_student() foi criada na migration 028.
-- ============================================
ALTER TABLE student_clearances ENABLE ROW LEVEL SECURITY;

-- Manager: tudo
CREATE POLICY clearances_manager_all ON student_clearances
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- Leitura: qualquer profissional que atende o aluno (treinador inclusive) vê as restrições
CREATE POLICY clearances_attending_select ON student_clearances
    FOR SELECT TO authenticated
    USING (public.attends_student(student_id));

-- Criação: só o próprio profissional, e apenas se atende o aluno
CREATE POLICY clearances_insert ON student_clearances
    FOR INSERT TO authenticated
    WITH CHECK (
        issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND public.attends_student(student_id)
    );

-- Edição/encerramento: só quem emitiu
CREATE POLICY clearances_update_owner ON student_clearances
    FOR UPDATE TO authenticated
    USING (issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));
```

### Nota sobre expiração

`review_date` é informativo. Se quiser marcar liberações vencidas como `expired` automaticamente, isso pode ser feito no cron existente (`web/src/app/api/cron/monthly-snapshot/route.ts`) ou on-demand na leitura. Para o MVP, basta exibir um aviso visual quando `review_date < hoje` e `status = 'active'` — sem job dedicado.

---

## Tarefa 2 — Tipos

**Arquivo**: `web/src/types/database.ts`

```typescript
export type ClearanceLevel = 'cleared' | 'cleared_with_notes' | 'restricted' | 'contraindicated';
export type ClearanceStatus = 'active' | 'lifted' | 'expired';

export interface StudentClearance {
  id: string;
  student_id: string;
  issued_by_professional_id: string;
  clearance_level: ClearanceLevel;
  body_region: string | null;
  affected_movements: string[] | null;
  description: string;
  status: ClearanceStatus;
  effective_from: string;
  review_date: string | null;
  lifted_at: string | null;
  lifted_note: string | null;
  created_at: string;
  updated_at: string;
  issued_by?: { full_name: string; profession_type: ProfessionType };
}
```

---

## Tarefa 3 — Server Actions

**Arquivo**: `web/src/app/actions/clearances.ts` (novo)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import type { StudentClearance, ClearanceLevel } from '@/types/database';

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

interface CreateClearanceInput {
    studentId: string;
    level: ClearanceLevel;
    description: string;
    bodyRegion?: string;
    affectedMovements?: string[];
    reviewDate?: string;
}

export async function createClearance(input: CreateClearanceInput) {
    const proId = await getMyProfessionalId();
    if (!proId) return { error: 'Profissional não encontrado.' };

    const supabase = await createClient();
    const { error } = await supabase.from('student_clearances').insert({
        student_id: input.studentId,
        issued_by_professional_id: proId,
        clearance_level: input.level,
        description: input.description,
        body_region: input.bodyRegion ?? null,
        affected_movements: input.affectedMovements ?? null,
        review_date: input.reviewDate ?? null,
    });

    if (error) return { error: 'Não foi possível registrar a liberação.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function liftClearance(clearanceId: string, note?: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('student_clearances')
        .update({ status: 'lifted', lifted_at: new Date().toISOString(), lifted_note: note ?? null })
        .eq('id', clearanceId);

    if (error) return { error: 'Não foi possível encerrar a liberação.' };
    revalidatePath('/dashboard');
    return { success: true };
}

// Restrições ativas de um aluno — usado no banner do treino.
export async function getActiveClearances(studentId: string): Promise<StudentClearance[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_clearances')
        .select(`*, issued_by:professionals!issued_by_professional_id(profession_type, profile:profiles!profile_id(full_name))`)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    return (data || []).map((c: any) => ({
        ...c,
        issued_by: c.issued_by && {
            full_name: c.issued_by.profile?.full_name ?? '',
            profession_type: c.issued_by.profession_type,
        },
    }));
}

// Histórico completo (ativas + encerradas) para a ficha do paciente do fisio.
export async function getClearanceHistory(studentId: string): Promise<StudentClearance[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_clearances')
        .select(`*, issued_by:professionals!issued_by_professional_id(profession_type, profile:profiles!profile_id(full_name))`)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
    return (data || []).map((c: any) => ({
        ...c,
        issued_by: c.issued_by && {
            full_name: c.issued_by.profile?.full_name ?? '',
            profession_type: c.issued_by.profession_type,
        },
    }));
}
```

---

## Tarefa 4 — Componente Banner de Restrições

**Arquivo**: `web/src/components/clearances/clearance-banner.tsx` (novo, server-friendly)

Banner **persistente e impossível de ignorar** quando há restrições ativas. Renderizado no topo da ficha do aluno (treinador e gestor) e visível na agenda.

```typescript
interface ClearanceBannerProps {
    clearances: StudentClearance[];   // de getActiveClearances()
    compact?: boolean;                // versão reduzida (agenda)
}
```

Hierarquia visual por `clearance_level`:

```
- contraindicated → vermelho forte (border-red-300 bg-red-50, ícone Ban)        "Contraindicado"
- restricted      → laranja (border-orange-300 bg-orange-50, ícone AlertOctagon) "Restrição ativa"
- cleared_with_notes → amarelo (border-amber-200 bg-amber-50, ícone AlertTriangle) "Liberado com ressalvas"
- cleared         → verde (border-emerald-200 bg-emerald-50, ícone ShieldCheck)  "Liberado"
```

Cada item mostra: nível, `body_region`, `affected_movements` como chips, `description`, quem emitiu (`ProfessionBadge` + nome) e a data. Se `review_date < hoje`, adicionar selo "Reavaliação vencida".

Se não houver restrições ativas, o banner **não renderiza nada** (igual ao `DashboardAlerts`).

---

## Tarefa 5 — Fluxo do Fisioterapeuta

**Arquivos**:
- `web/src/components/clearances/clearance-dialog.tsx` (novo, `'use client'`) — formulário de emissão
- `web/src/app/dashboard/physiotherapist/patients/[id]/page.tsx` — adicionar seção "Liberações para o treino"

Na ficha do paciente do fisioterapeuta:

1. Botão **"Emitir liberação/restrição"** abre o `ClearanceDialog`:
   - Select de nível (4 opções)
   - Input região do corpo
   - Input de movimentos afetados (multi-chip; pode ser texto separado por vírgula → array)
   - Textarea descrição/orientação (obrigatório)
   - Date picker de reavaliação (opcional)
2. Lista de liberações (via `getClearanceHistory`): ativas no topo com botão **"Encerrar"** (`liftClearance`), histórico abaixo.

Ao emitir, a spec 05 dispara notificação para o treinador do aluno.

---

## Tarefa 6 — Superfície no Treino e na Agenda

### 6.1 Ficha do aluno (treinador e gestor)

**Arquivos**: `web/src/app/dashboard/trainer/students/[id]/page.tsx`, `web/src/app/dashboard/manager/students/[id]/page.tsx`

No topo da página (antes das tabs da spec 2.01), buscar `getActiveClearances(studentId)` e renderizar `<ClearanceBanner clearances={...} />`. É a primeira coisa que o treinador vê ao abrir o aluno.

### 6.2 Agenda

**Arquivo**: `web/src/app/dashboard/attendance/*` (componente de slot do aluno)

Quando um aluno com restrição ativa aparece na agenda, exibir um ícone de alerta (ex.: `AlertOctagon` laranja) ao lado do nome, com tooltip/popover mostrando o `ClearanceBanner` em modo `compact`. Reutilize o padrão de popover já existente (`attendance/slot-cell-popover.tsx`).

> Buscar restrições para muitos alunos de uma vez: criar `getActiveClearancesForStudents(ids: string[])` em `clearances.ts` retornando um `Map<studentId, StudentClearance[]>`, para não fazer N queries na agenda.

---

## Estrutura de arquivos

```
supabase/migrations/
└── 029_student_clearances.sql

web/src/
├── types/database.ts                          # + tipos de clearance
├── app/actions/clearances.ts                  # actions
├── components/clearances/
│   ├── clearance-banner.tsx                   # banner de restrições ativas
│   └── clearance-dialog.tsx                   # emissão (fisio)
└── app/dashboard/
    ├── physiotherapist/patients/[id]/page.tsx # emitir + histórico
    ├── trainer/students/[id]/page.tsx         # banner no topo
    ├── manager/students/[id]/page.tsx         # banner no topo
    └── attendance/*                           # ícone + popover na agenda
```

---

## Checklist

### Banco
- [ ] Criar migration 029 (tabela, indexes, RLS, trigger)
- [ ] Testar: fisio que atende o aluno emite restrição; treinador do mesmo aluno consegue ler
- [ ] Testar: profissional sem vínculo NÃO consegue ler nem criar
- [ ] Testar: só o emissor consegue encerrar (`liftClearance`)

### Tipos e actions
- [ ] Tipos em `database.ts`
- [ ] `clearances.ts` com create/lift/getActive/getHistory + `getActiveClearancesForStudents`
- [ ] Type check (`npx tsc --noEmit`)

### UI
- [ ] `clearance-dialog.tsx` emite com os 4 níveis e campos estruturados
- [ ] `clearance-banner.tsx` com hierarquia visual correta e selo de reavaliação vencida
- [ ] Banner no topo da ficha do aluno (treinador e gestor)
- [ ] Seção de liberações na ficha do paciente do fisio (ativas + histórico + encerrar)
- [ ] Ícone/popover de restrição na agenda sem N+1 queries

### Verificação
- [ ] Fluxo completo: fisio emite "restrito — joelho direito — evitar agachamento profundo" → treinador vê banner vermelho/laranja na ficha e ícone na agenda
- [ ] Encerrar restrição remove o banner
- [ ] Restrição contraindicada usa o visual mais severo
- [ ] Manager vê os banners em modo leitura

---

## Resultado Esperado

O fisioterapeuta registra uma restrição clínica estruturada para um aluno. Imediatamente, o treinador (e o gestor) veem um banner destacado no topo da ficha do aluno e um alerta na agenda — impossível de não notar — descrevendo o que evitar e até quando reavaliar. Quando o aluno se recupera, o fisio encerra a restrição e o banner some. A segurança do aluno deixa de depender de um áudio de WhatsApp.
</content>
