# Spec Fase 3.04 — Notas Compartilhadas

## Contexto

Encaminhamentos (spec 02) são direcionados (de A para B). Liberações (spec 03) são clínicas e estruturadas. Falta o canal mais informal e mais comum: uma **observação geral sobre o aluno**, visível a **todos** os profissionais que o atendem, sem destinatário específico.

Exemplos reais:
- "Aluno viaja a trabalho toda 3ª semana do mês — combinar treinos/consultas em torno disso."
- "Está desmotivado ultimamente, foco em reforço positivo."
- "Mudou de objetivo: agora quer foco em emagrecimento, não hipertrofia."

Hoje cada profissional anota isso no seu próprio prontuário (campo `notes` da consulta/sessão), onde os outros não enxergam. As notas compartilhadas são um "mural" do aluno, comum a toda a equipe multidisciplinar.

## Objetivo

Criar a tabela `student_shared_notes`, a UI de mural na ficha do aluno (visível e editável por qualquer profissional vinculado + gestor) e integrar essas notas na **timeline 360°** já existente (spec 2.01).

---

## Tarefa 1 — Migration 030

**Arquivo**: `supabase/migrations/030_student_shared_notes.sql` (novo)

```sql
-- ============================================
-- Migration 030: Notas compartilhadas do aluno
-- Mural visível a todos os profissionais que atendem o aluno
-- ============================================

CREATE TABLE IF NOT EXISTS student_shared_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
    author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- cobre o manager (sem professional_id)
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
        'general', 'goal', 'behavior', 'logistics', 'health'
    )),
    body TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_notes_student ON student_shared_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_shared_notes_pinned ON student_shared_notes(student_id, is_pinned);

CREATE TRIGGER set_shared_notes_updated_at
    BEFORE UPDATE ON student_shared_notes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS — qualquer profissional que atende o aluno lê e escreve; autor/manager editam.
-- attends_student() vem da migration 028.
-- ============================================
ALTER TABLE student_shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_notes_manager_all ON student_shared_notes
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- Leitura: todos que atendem o aluno
CREATE POLICY shared_notes_attending_select ON student_shared_notes
    FOR SELECT TO authenticated
    USING (public.attends_student(student_id));

-- Criação: quem atende o aluno, registrando autoria própria
CREATE POLICY shared_notes_insert ON student_shared_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        public.attends_student(student_id)
        AND author_profile_id = auth.uid()
    );

-- Edição/remoção: apenas o autor
CREATE POLICY shared_notes_update_author ON student_shared_notes
    FOR UPDATE TO authenticated
    USING (author_profile_id = auth.uid())
    WITH CHECK (author_profile_id = auth.uid());

CREATE POLICY shared_notes_delete_author ON student_shared_notes
    FOR DELETE TO authenticated
    USING (author_profile_id = auth.uid() OR public.is_manager());
```

### Nota sobre autoria dupla

Guardamos `author_profile_id` (sempre presente, inclusive para o manager que não tem `professional_id`) e `author_professional_id` (nullable, para exibir a profissão do autor). O RLS de insert usa `author_profile_id = auth.uid()`, garantindo que ninguém forje autoria.

---

## Tarefa 2 — Tipos

**Arquivo**: `web/src/types/database.ts`

```typescript
export type SharedNoteCategory = 'general' | 'goal' | 'behavior' | 'logistics' | 'health';

export interface StudentSharedNote {
  id: string;
  student_id: string;
  author_professional_id: string | null;
  author_profile_id: string | null;
  category: SharedNoteCategory;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: { full_name: string; profession_type: ProfessionType | null; role: string };
}
```

---

## Tarefa 3 — Server Actions

**Arquivo**: `web/src/app/actions/shared-notes.ts` (novo)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StudentSharedNote, SharedNoteCategory } from '@/types/database';

export async function getSharedNotes(studentId: string): Promise<StudentSharedNote[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_shared_notes')
        .select(`
            *,
            author_professional:professionals!author_professional_id(profession_type),
            author_profile:profiles!author_profile_id(full_name, role, profession_type)
        `)
        .eq('student_id', studentId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    return (data || []).map((n: any) => ({
        ...n,
        author: {
            full_name: n.author_profile?.full_name ?? 'Profissional',
            profession_type: n.author_profile?.profession_type ?? n.author_professional?.profession_type ?? null,
            role: n.author_profile?.role ?? 'professional',
        },
    }));
}

export async function createSharedNote(input: {
    studentId: string;
    body: string;
    category?: SharedNoteCategory;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    // professional_id é opcional (manager não tem)
    const { data: pro } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

    const { error } = await supabase.from('student_shared_notes').insert({
        student_id: input.studentId,
        author_profile_id: user.id,
        author_professional_id: pro?.id ?? null,
        body: input.body,
        category: input.category ?? 'general',
    });

    if (error) return { error: 'Não foi possível salvar a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function togglePinSharedNote(noteId: string, isPinned: boolean) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('student_shared_notes')
        .update({ is_pinned: isPinned })
        .eq('id', noteId);
    if (error) return { error: 'Não foi possível fixar a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteSharedNote(noteId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('student_shared_notes').delete().eq('id', noteId);
    if (error) return { error: 'Não foi possível excluir a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}
```

---

## Tarefa 4 — Componente Mural de Notas

**Arquivo**: `web/src/components/shared-notes/shared-notes-panel.tsx` (novo, `'use client'`)

```typescript
interface SharedNotesPanelProps {
    studentId: string;
    notes: StudentSharedNote[];
    currentProfileId: string;   // para mostrar editar/excluir só ao autor
    readOnly?: boolean;
}
```

Layout:
- Campo de adição no topo: textarea + select de categoria + botão "Adicionar nota".
- Notas fixadas (`is_pinned`) primeiro, com selo de pin.
- Cada nota: corpo, autor (`ProfessionBadge` + nome + label do role), categoria como chip colorido, tempo relativo. Ações (pin/unpin, excluir) visíveis ao autor e ao manager.

Chips de categoria:
```
general   → zinc    ("Geral")
goal      → emerald ("Objetivo")
behavior  → violet  ("Comportamento")
logistics → blue    ("Logística")
health    → red     ("Saúde")
```

---

## Tarefa 5 — Integração na Ficha do Aluno e na Timeline 360°

### 5.1 Mural na ficha

Adicionar o `SharedNotesPanel` como uma sub-seção da aba 360° (ou aba própria "Notas") em:
- `manager/students/[id]` e `trainer/students/[id]`
- `nutritionist/patients/[id]` e `physiotherapist/patients/[id]`

Buscar com `getSharedNotes(studentId)`; passar `currentProfileId` (de `getProfile()`).

### 5.2 Timeline integrada

**Arquivo**: `web/src/app/actions/integrated.ts` (criado na spec 2.01)

Estender `getStudentIntegratedView()` para incluir notas compartilhadas na timeline:

1. Adicionar `'shared_note'` ao union `TimelineEvent['type']`.
2. No fetch paralelo, buscar as últimas ~10 notas do aluno.
3. Mapear cada nota para um `TimelineEvent` com `discipline: 'admin'` (ou uma nova categoria visual `'note'`), título "Nota compartilhada", descrição = corpo truncado, `professional` = nome do autor.

Atualizar o `IntegratedTimeline` (`components/integrated/integrated-timeline.tsx`) para reconhecer o novo tipo com ícone próprio (`StickyNote`) e cor (ex.: `violet-600`), incluindo no filtro por disciplina.

---

## Estrutura de arquivos

```
supabase/migrations/
└── 030_student_shared_notes.sql

web/src/
├── types/database.ts                              # + tipos de shared note
├── app/actions/shared-notes.ts                    # actions
├── components/shared-notes/shared-notes-panel.tsx # mural
├── app/actions/integrated.ts                      # + notas na timeline
└── components/integrated/integrated-timeline.tsx  # + tipo 'shared_note'
```

---

## Checklist

### Banco
- [ ] Criar migration 030 (tabela, indexes, RLS, trigger)
- [ ] Testar: profissional vinculado cria e lê notas; profissional sem vínculo não vê nada
- [ ] Testar: só o autor (ou manager) edita/exclui
- [ ] Testar: manager consegue criar nota (author_professional_id nulo)

### Tipos e actions
- [ ] Tipos em `database.ts`
- [ ] `shared-notes.ts` com get/create/togglePin/delete
- [ ] Type check (`npx tsc --noEmit`)

### UI
- [ ] `shared-notes-panel.tsx` com adição, categorias, pin e exclusão
- [ ] Mural integrado nas 4 fichas (manager, trainer, nutri, fisio)
- [ ] Notas aparecem na timeline 360° com ícone/cor e filtro

### Verificação
- [ ] Nota criada pelo treinador aparece para o nutricionista do mesmo aluno
- [ ] Pin move a nota para o topo
- [ ] Nota aparece corretamente na timeline integrada
- [ ] Autor diferente não vê botão de excluir

---

## Resultado Esperado

Cada aluno passa a ter um "mural" compartilhado pela equipe multidisciplinar. Qualquer profissional vinculado registra observações de objetivo, comportamento, logística ou saúde, e todos os colegas que atendem aquele aluno enxergam — inclusive na timeline 360°. As notas mais importantes podem ser fixadas no topo.
</content>
