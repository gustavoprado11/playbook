# Spec 01 — Infraestrutura Multidisciplinar

**Sprint:** 1
**Estimativa:** 1-2 semanas
**Pré-requisito:** Nenhum
**Migrations:** 019, 020, 021

---

## Contexto

O Playbook hoje suporta dois roles (`manager` e `trainer`) definidos no enum `user_role`. A tabela `trainers` contém dados específicos dos treinadores, e `students.trainer_id` vincula alunos a treinadores diretamente.

Precisamos expandir o sistema para suportar **nutricionistas** e **fisioterapeutas** como novos tipos de profissional, sem alterar nenhuma tabela ou código existente. A abordagem é **aditiva**: criamos novas estruturas que convivem com as existentes.

---

## Tarefa 1: Migration 019 — Tabela `professionals` e enum `profession_type`

**Arquivo:** `supabase/migrations/019_professionals.sql`

### O que criar

```sql
-- 1. Enum para tipo de profissional
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profession_type') THEN
        CREATE TYPE profession_type AS ENUM ('trainer', 'nutritionist', 'physiotherapist');
    END IF;
END
$$;

-- 2. Adicionar campo profession_type à tabela profiles (nullable para retrocompatibilidade)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession_type profession_type;

-- 3. Atualizar profiles existentes com role='trainer' para profession_type='trainer'
UPDATE profiles SET profession_type = 'trainer' WHERE role = 'trainer' AND profession_type IS NULL;

-- 4. Expandir o enum user_role para incluir 'professional'
-- NOTA: No PostgreSQL, ALTER TYPE ... ADD VALUE não pode rodar dentro de transação.
-- Se necessário, usar a abordagem de DO block com check.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'professional';

-- 5. Tabela professionals (abstração de todos os tipos de profissional)
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profession_type profession_type NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT professionals_profile_profession_unique UNIQUE(profile_id, profession_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_professionals_profile_id ON professionals(profile_id);
CREATE INDEX IF NOT EXISTS idx_professionals_profession_type ON professionals(profession_type);
CREATE INDEX IF NOT EXISTS idx_professionals_is_active ON professionals(is_active);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_professionals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_professionals_updated_at
    BEFORE UPDATE ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

-- 6. Migrar treinadores existentes para a tabela professionals
INSERT INTO professionals (profile_id, profession_type, start_date, is_active, notes, created_at, updated_at)
SELECT
    t.profile_id,
    'trainer'::profession_type,
    t.start_date,
    t.is_active,
    t.notes,
    t.created_at,
    t.updated_at
FROM trainers t
ON CONFLICT (profile_id, profession_type) DO NOTHING;
```

### Regras importantes

- **NÃO** alterar a tabela `trainers` existente.
- **NÃO** remover o campo `trainer_id` de `students`.
- O campo `profiles.profession_type` é nullable — profiles antigos com `role='manager'` ficam com NULL.
- O valor `'professional'` no enum `user_role` será usado para nutricionistas e fisioterapeutas. Treinadores continuam com `role='trainer'`.

---

## Tarefa 2: Migration 020 — Tabela `student_professionals`

**Arquivo:** `supabase/migrations/020_student_professionals.sql`

### O que criar

```sql
-- Tabela de vínculo aluno ↔ profissional
CREATE TABLE IF NOT EXISTS student_professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_professionals_unique UNIQUE(student_id, professional_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_professionals_student ON student_professionals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_professionals_professional ON student_professionals(professional_id);
CREATE INDEX IF NOT EXISTS idx_student_professionals_status ON student_professionals(status);

-- Migrar vínculos existentes: students.trainer_id → student_professionals
INSERT INTO student_professionals (student_id, professional_id, status, started_at)
SELECT
    s.id,
    p.id,
    CASE WHEN s.status = 'active' THEN 'active' ELSE 'inactive' END,
    s.created_at
FROM students s
JOIN trainers t ON s.trainer_id = t.id
JOIN professionals p ON p.profile_id = t.profile_id AND p.profession_type = 'trainer'
ON CONFLICT (student_id, professional_id) DO NOTHING;

-- Função helper: buscar professional_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_professional_id()
RETURNS UUID AS $$
    SELECT p.id
    FROM professionals p
    JOIN profiles pr ON pr.id = p.profile_id
    WHERE pr.id = auth.uid()
    AND p.is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função helper: buscar professional_id por tipo
CREATE OR REPLACE FUNCTION public.get_professional_id_by_type(p_type profession_type)
RETURNS UUID AS $$
    SELECT p.id
    FROM professionals p
    WHERE p.profile_id = auth.uid()
    AND p.profession_type = p_type
    AND p.is_active = true
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função helper: verificar se é profissional de um tipo específico
CREATE OR REPLACE FUNCTION public.is_profession(p_type profession_type)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM professionals p
        WHERE p.profile_id = auth.uid()
        AND p.profession_type = p_type
        AND p.is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## Tarefa 3: Migration 021 — RLS para novas tabelas

**Arquivo:** `supabase/migrations/021_professionals_rls.sql`

### O que criar

```sql
-- Habilitar RLS
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_professionals ENABLE ROW LEVEL SECURITY;

-- PROFESSIONALS: Manager vê todos; profissional vê apenas o próprio
CREATE POLICY professionals_manager_all ON professionals
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY professionals_own_select ON professionals
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- STUDENT_PROFESSIONALS: Manager vê todos; profissional vê apenas seus vínculos
CREATE POLICY student_professionals_manager_all ON student_professionals
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY student_professionals_own_select ON student_professionals
    FOR SELECT TO authenticated
    USING (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY student_professionals_own_insert ON student_professionals
    FOR INSERT TO authenticated
    WITH CHECK (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY student_professionals_own_update ON student_professionals
    FOR UPDATE TO authenticated
    USING (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );
```

---

## Tarefa 4: Atualizar TypeScript types

**Arquivo:** `web/src/types/database.ts`

### Adicionar ao final do arquivo

```typescript
// === ECOSSISTEMA MULTIDISCIPLINAR ===

export type ProfessionType = 'trainer' | 'nutritionist' | 'physiotherapist';

export interface Professional {
    id: string;
    profile_id: string;
    profession_type: ProfessionType;
    start_date: string;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    profile?: Profile;
}

export type StudentProfessionalStatus = 'active' | 'inactive';

export interface StudentProfessional {
    id: string;
    student_id: string;
    professional_id: string;
    status: StudentProfessionalStatus;
    started_at: string;
    ended_at: string | null;
    notes: string | null;
    created_at: string;
    // Joined fields
    student?: Student;
    professional?: Professional;
}
```

### Atualizar o type `UserRole` existente

```typescript
// ANTES:
export type UserRole = 'manager' | 'trainer';

// DEPOIS:
export type UserRole = 'manager' | 'trainer' | 'professional';
```

### Atualizar a interface `Profile` existente

```typescript
// Adicionar campo:
export interface Profile {
    // ... campos existentes ...
    profession_type: ProfessionType | null;
}
```

---

## Tarefa 5: Server Actions — CRUD de profissionais

**Arquivo:** `web/src/app/actions/professionals.ts` (novo arquivo)

### Implementar as seguintes actions

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { Professional, ProfessionType } from '@/types/database';
```

**Actions necessárias:**

1. **`listProfessionals(professionType?: ProfessionType)`**
   - Quem pode chamar: manager
   - Retorna lista de profissionais com profile joinado
   - Se `professionType` informado, filtra por tipo
   - Query: `professionals` JOIN `profiles` via `profile_id`

2. **`createProfessional(input: CreateProfessionalInput)`**
   - Quem pode chamar: manager
   - Input: `{ email, full_name, password, profession_type, start_date?, notes? }`
   - Fluxo:
     1. Verificar se email já existe em `profiles`
     2. Se não existe: criar usuário via `adminClient.auth.admin.createUser()`
     3. Criar/atualizar `profiles` com `role = 'professional'` e `profession_type`
     4. Criar registro em `professionals`
   - Revalidar: `/dashboard/manager/professionals`
   - **Seguir o mesmo padrão de `createTrainer()` em `manager.ts`**

3. **`toggleProfessionalStatus(professionalId: string)`**
   - Quem pode chamar: manager
   - Toggle `is_active` na tabela `professionals`
   - Revalidar: `/dashboard/manager/professionals`

4. **`resetProfessionalPassword(professionalId: string)`**
   - Quem pode chamar: manager
   - Buscar email via professional → profile
   - Usar `adminClient.auth.admin.updateUserById()` para resetar senha
   - Retornar senha temporária gerada
   - **Seguir o mesmo padrão de `resetTrainerPassword()` em `manager.ts`**

5. **`linkStudentToProfessional(studentId: string, professionalId: string)`**
   - Quem pode chamar: manager
   - Criar registro em `student_professionals`
   - Revalidar caminhos relevantes

6. **`unlinkStudentFromProfessional(studentId: string, professionalId: string)`**
   - Quem pode chamar: manager
   - Atualizar `status = 'inactive'` e `ended_at = now()` em `student_professionals`
   - Revalidar caminhos relevantes

---

## Tarefa 6: Atualizar routing do dashboard

**Arquivo:** `web/src/app/dashboard/page.tsx`

### Lógica atual

```typescript
if (profile.role === 'manager') redirect('/dashboard/manager');
else redirect('/dashboard/trainer');
```

### Nova lógica

```typescript
if (profile.role === 'manager') {
    redirect('/dashboard/manager');
} else if (profile.role === 'trainer') {
    redirect('/dashboard/trainer');
} else if (profile.role === 'professional') {
    // Redirecionar baseado no profession_type
    switch (profile.profession_type) {
        case 'nutritionist':
            redirect('/dashboard/nutritionist');
            break;
        case 'physiotherapist':
            redirect('/dashboard/physiotherapist');
            break;
        default:
            redirect('/dashboard/trainer'); // fallback
    }
}
```

### Criar páginas placeholder

Criar os seguintes arquivos com conteúdo placeholder:

1. **`web/src/app/dashboard/nutritionist/page.tsx`**
   ```typescript
   import { getProfile } from '@/app/actions/auth';
   import { redirect } from 'next/navigation';

   export default async function NutritionistDashboardPage() {
       const profile = await getProfile();
       if (!profile || profile.profession_type !== 'nutritionist') {
           redirect('/dashboard');
       }
       return (
           <div className="space-y-6">
               <h1 className="text-2xl font-bold">Painel do Nutricionista</h1>
               <p className="text-muted-foreground">Em construção...</p>
           </div>
       );
   }
   ```

2. **`web/src/app/dashboard/physiotherapist/page.tsx`**
   ```typescript
   import { getProfile } from '@/app/actions/auth';
   import { redirect } from 'next/navigation';

   export default async function PhysiotherapistDashboardPage() {
       const profile = await getProfile();
       if (!profile || profile.profession_type !== 'physiotherapist') {
           redirect('/dashboard');
       }
       return (
           <div className="space-y-6">
               <h1 className="text-2xl font-bold">Painel do Fisioterapeuta</h1>
               <p className="text-muted-foreground">Em construção...</p>
           </div>
       );
   }
   ```

---

## Tarefa 7: Atualizar `getProfile()` em auth.ts

**Arquivo:** `web/src/app/actions/auth.ts`

A function `getProfile()` precisa retornar o campo `profession_type` recém-adicionado. Verificar o `select()` e garantir que `profession_type` está incluído. Se o select usa `*`, já estará coberto. Se lista campos explicitamente, adicionar `profession_type`.

---

## Checklist de validação

Após implementar tudo, verificar:

- [ ] `npm run build` passa sem erros
- [ ] Login como manager redireciona para `/dashboard/manager`
- [ ] Login como trainer existente redireciona para `/dashboard/trainer` (sem regressão)
- [ ] Dados existentes de trainers foram migrados para `professionals` e `student_professionals`
- [ ] Manager consegue criar um novo profissional (nutricionista) via action
- [ ] Novo nutricionista consegue fazer login e é redirecionado para `/dashboard/nutritionist`
- [ ] RLS impede nutricionista de ver dados de treinadores
- [ ] Tabelas `trainers`, `students.trainer_id` e todo código existente não foram alterados
