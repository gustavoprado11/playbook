# Spec 02 — Módulo Nutrição

**Sprint:** 2
**Estimativa:** 2-3 semanas
**Pré-requisito:** Spec 01 (infraestrutura) implementada
**Migrations:** 022, 023

---

## Contexto

Com a infraestrutura multidisciplinar implementada (tabelas `professionals`, `student_professionals`, routing por `profession_type`), agora criamos o módulo completo de nutrição. O nutricionista terá um prontuário digital com: consultas, anamnese, métricas antropométricas, planos alimentares e exames laboratoriais.

---

## Tarefa 1: Migration 022 — Tabelas de nutrição

**Arquivo:** `supabase/migrations/022_nutrition_module.sql`

```sql
-- ============================================
-- MÓDULO NUTRIÇÃO
-- ============================================

-- 1. Consultas nutricionais
CREATE TABLE IF NOT EXISTS nutrition_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    consultation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    consultation_type TEXT NOT NULL CHECK (consultation_type IN (
        'initial_assessment', 'follow_up', 'reassessment'
    )),
    chief_complaint TEXT,
    clinical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_consultations_student ON nutrition_consultations(student_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultations_professional ON nutrition_consultations(professional_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_consultations_date ON nutrition_consultations(consultation_date DESC);

-- Trigger updated_at
CREATE TRIGGER set_nutrition_consultations_updated_at
    BEFORE UPDATE ON nutrition_consultations
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();
    -- Reutiliza a function criada na migration 019

-- 2. Anamnese nutricional (1:1 com consulta)
CREATE TABLE IF NOT EXISTS nutrition_anamnesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES nutrition_consultations(id) ON DELETE CASCADE,
    dietary_history TEXT,
    food_allergies TEXT[] DEFAULT '{}',
    food_intolerances TEXT[] DEFAULT '{}',
    supplements TEXT[] DEFAULT '{}',
    pathologies TEXT[] DEFAULT '{}',
    medications TEXT[] DEFAULT '{}',
    objective TEXT,
    daily_routine TEXT,
    water_intake_ml INTEGER,
    bowel_habits TEXT,
    sleep_quality TEXT,
    additional_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nutrition_anamnesis_consultation_unique UNIQUE(consultation_id)
);

-- 3. Métricas nutricionais / antropometria (1:1 com consulta)
CREATE TABLE IF NOT EXISTS nutrition_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES nutrition_consultations(id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,1),
    bmi DECIMAL(4,1),
    body_fat_pct DECIMAL(4,1),
    lean_mass_kg DECIMAL(5,2),
    waist_cm DECIMAL(5,1),
    hip_cm DECIMAL(5,1),
    arm_cm DECIMAL(5,1),
    thigh_cm DECIMAL(5,1),
    chest_cm DECIMAL(5,1),
    calf_cm DECIMAL(5,1),
    visceral_fat_level INTEGER,
    basal_metabolic_rate INTEGER,
    additional_measures JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nutrition_metrics_consultation_unique UNIQUE(consultation_id)
);

-- 4. Planos alimentares
CREATE TABLE IF NOT EXISTS nutrition_meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    objective TEXT,
    total_calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER,
    fiber_g INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    meals JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_meal_plans_student ON nutrition_meal_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_plans_professional ON nutrition_meal_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_plans_active ON nutrition_meal_plans(is_active);

CREATE TRIGGER set_nutrition_meal_plans_updated_at
    BEFORE UPDATE ON nutrition_meal_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

-- 5. Exames laboratoriais
CREATE TABLE IF NOT EXISTS nutrition_lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    exam_type TEXT NOT NULL,
    results JSONB NOT NULL DEFAULT '{}',
    file_path TEXT,
    file_type TEXT,
    file_size INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_lab_results_student ON nutrition_lab_results(student_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_lab_results_date ON nutrition_lab_results(exam_date DESC);
```

### Estrutura esperada do JSONB `meals` (plano alimentar)

```json
[
    {
        "name": "Café da manhã",
        "time": "07:00",
        "items": [
            { "food": "Ovos mexidos", "quantity": "3 unidades", "calories": 210, "protein": 18, "carbs": 2, "fat": 15 },
            { "food": "Pão integral", "quantity": "2 fatias", "calories": 140, "protein": 6, "carbs": 24, "fat": 2 }
        ],
        "notes": "Pode substituir ovos por omelete"
    },
    {
        "name": "Almoço",
        "time": "12:00",
        "items": [ ... ]
    }
]
```

> **Nota:** Na v1, o JSONB é flexível. Não estamos criando uma tabela normalizada de alimentos — isso seria uma evolução futura se necessário.

### Estrutura esperada do JSONB `results` (exames)

```json
{
    "hemoglobina": { "value": 14.5, "unit": "g/dL", "reference": "12-16", "status": "normal" },
    "glicose_jejum": { "value": 92, "unit": "mg/dL", "reference": "70-99", "status": "normal" },
    "colesterol_total": { "value": 210, "unit": "mg/dL", "reference": "<200", "status": "high" }
}
```

---

## Tarefa 2: Migration 023 — RLS para tabelas de nutrição

**Arquivo:** `supabase/migrations/023_nutrition_rls.sql`

```sql
-- Habilitar RLS em todas as tabelas de nutrição
ALTER TABLE nutrition_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_lab_results ENABLE ROW LEVEL SECURITY;

-- === NUTRITION_CONSULTATIONS ===

-- Manager: acesso total
CREATE POLICY nutrition_consultations_manager_all ON nutrition_consultations
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

-- Nutricionista: CRUD nos seus próprios registros
CREATE POLICY nutrition_consultations_own_all ON nutrition_consultations
    FOR ALL TO authenticated
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

-- === NUTRITION_ANAMNESIS ===
-- Acesso via consulta (quem tem acesso à consulta, tem acesso à anamnese)

CREATE POLICY nutrition_anamnesis_manager_all ON nutrition_anamnesis
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_anamnesis_own_all ON nutrition_anamnesis
    FOR ALL TO authenticated
    USING (
        consultation_id IN (
            SELECT id FROM nutrition_consultations
            WHERE professional_id IN (
                SELECT id FROM professionals WHERE profile_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        consultation_id IN (
            SELECT id FROM nutrition_consultations
            WHERE professional_id IN (
                SELECT id FROM professionals WHERE profile_id = auth.uid()
            )
        )
    );

-- === NUTRITION_METRICS ===

CREATE POLICY nutrition_metrics_manager_all ON nutrition_metrics
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_metrics_own_all ON nutrition_metrics
    FOR ALL TO authenticated
    USING (
        consultation_id IN (
            SELECT id FROM nutrition_consultations
            WHERE professional_id IN (
                SELECT id FROM professionals WHERE profile_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        consultation_id IN (
            SELECT id FROM nutrition_consultations
            WHERE professional_id IN (
                SELECT id FROM professionals WHERE profile_id = auth.uid()
            )
        )
    );

-- === NUTRITION_MEAL_PLANS ===

CREATE POLICY nutrition_meal_plans_manager_all ON nutrition_meal_plans
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_meal_plans_own_all ON nutrition_meal_plans
    FOR ALL TO authenticated
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

-- === NUTRITION_LAB_RESULTS ===

CREATE POLICY nutrition_lab_results_manager_all ON nutrition_lab_results
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_lab_results_own_all ON nutrition_lab_results
    FOR ALL TO authenticated
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

## Tarefa 3: TypeScript types para nutrição

**Arquivo:** `web/src/types/database.ts` — Adicionar ao final

```typescript
// === MÓDULO NUTRIÇÃO ===

export type NutritionConsultationType = 'initial_assessment' | 'follow_up' | 'reassessment';

export interface NutritionConsultation {
    id: string;
    student_id: string;
    professional_id: string;
    consultation_date: string;
    consultation_type: NutritionConsultationType;
    chief_complaint: string | null;
    clinical_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
    anamnesis?: NutritionAnamnesis;
    metrics?: NutritionMetrics;
}

export interface NutritionAnamnesis {
    id: string;
    consultation_id: string;
    dietary_history: string | null;
    food_allergies: string[];
    food_intolerances: string[];
    supplements: string[];
    pathologies: string[];
    medications: string[];
    objective: string | null;
    daily_routine: string | null;
    water_intake_ml: number | null;
    bowel_habits: string | null;
    sleep_quality: string | null;
    additional_notes: string | null;
    created_at: string;
}

export interface NutritionMetrics {
    id: string;
    consultation_id: string;
    weight_kg: number | null;
    height_cm: number | null;
    bmi: number | null;
    body_fat_pct: number | null;
    lean_mass_kg: number | null;
    waist_cm: number | null;
    hip_cm: number | null;
    arm_cm: number | null;
    thigh_cm: number | null;
    chest_cm: number | null;
    calf_cm: number | null;
    visceral_fat_level: number | null;
    basal_metabolic_rate: number | null;
    additional_measures: Record<string, unknown>;
    created_at: string;
}

export interface MealPlanItem {
    food: string;
    quantity: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

export interface MealPlanMeal {
    name: string;
    time: string;
    items: MealPlanItem[];
    notes?: string;
}

export interface NutritionMealPlan {
    id: string;
    student_id: string;
    professional_id: string;
    title: string;
    objective: string | null;
    total_calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    notes: string | null;
    meals: MealPlanMeal[];
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
}

export interface LabResultEntry {
    value: number;
    unit: string;
    reference: string;
    status: 'normal' | 'low' | 'high';
}

export interface NutritionLabResult {
    id: string;
    student_id: string;
    professional_id: string;
    exam_date: string;
    exam_type: string;
    results: Record<string, LabResultEntry>;
    file_path: string | null;
    file_type: string | null;
    file_size: number | null;
    notes: string | null;
    created_at: string;
}

// Input types para actions
export interface CreateNutritionConsultationInput {
    student_id: string;
    consultation_date?: string;
    consultation_type: NutritionConsultationType;
    chief_complaint?: string;
    clinical_notes?: string;
    anamnesis?: Omit<NutritionAnamnesis, 'id' | 'consultation_id' | 'created_at'>;
    metrics?: Omit<NutritionMetrics, 'id' | 'consultation_id' | 'created_at'>;
}

export interface CreateMealPlanInput {
    student_id: string;
    title: string;
    objective?: string;
    total_calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    start_date: string;
    end_date?: string;
    notes?: string;
    meals: MealPlanMeal[];
}

export interface CreateLabResultInput {
    student_id: string;
    exam_date: string;
    exam_type: string;
    results: Record<string, LabResultEntry>;
    notes?: string;
}
```

---

## Tarefa 4: Server Actions — Nutrição

**Arquivo:** `web/src/app/actions/nutrition.ts` (novo arquivo)

### Padrão de autenticação

Todas as actions devem:
1. Chamar `checkAuth()` para obter `supabase` e `user`
2. Verificar que o usuário é nutricionista: buscar `professionals` com `profile_id = user.id` e `profession_type = 'nutritionist'`
3. Usar o `professional.id` como `professional_id` em todas as operações
4. Chamar `revalidatePath()` nos caminhos relevantes

### Actions a implementar

**Consultas:**

1. **`listNutritionConsultations(studentId?: string)`**
   - Retorna consultas do nutricionista logado
   - Se `studentId` informado, filtra por aluno
   - Join com `students` para nome do aluno
   - Ordenar por `consultation_date DESC`

2. **`getNutritionConsultation(consultationId: string)`**
   - Retorna consulta completa com anamnese e métricas (join)
   - Query: `nutrition_consultations` + join `nutrition_anamnesis` + join `nutrition_metrics`

3. **`createNutritionConsultation(input: CreateNutritionConsultationInput)`**
   - Criar consulta + anamnese (se fornecida) + métricas (se fornecidas) em sequência
   - Retornar a consulta criada com dados completos
   - Revalidar: `/dashboard/nutritionist/patients`, `/dashboard/nutritionist/patients/${input.student_id}`

4. **`updateNutritionConsultation(consultationId: string, input: Partial<CreateNutritionConsultationInput>)`**
   - Atualizar campos da consulta, anamnese e/ou métricas
   - Usar UPSERT para anamnese e métricas (podem não existir na criação inicial)

5. **`deleteNutritionConsultation(consultationId: string)`**
   - Deletar consulta (CASCADE deleta anamnese e métricas)
   - Revalidar caminhos

**Planos alimentares:**

6. **`listMealPlans(studentId?: string)`**
   - Lista planos do nutricionista logado
   - Filtro opcional por aluno
   - Ordenar por `start_date DESC`

7. **`createMealPlan(input: CreateMealPlanInput)`**
   - Desativar planos anteriores do mesmo aluno (`is_active = false`)
   - Criar novo plano
   - Revalidar caminhos

8. **`updateMealPlan(planId: string, input: Partial<CreateMealPlanInput>)`**
   - Atualizar plano existente

9. **`toggleMealPlanActive(planId: string)`**
   - Toggle `is_active`

**Exames:**

10. **`createLabResult(input: CreateLabResultInput)`**
    - Criar registro de exame
    - Upload de arquivo: se houver arquivo, salvar via Supabase Storage no bucket `lab-results`

11. **`listLabResults(studentId: string)`**
    - Lista exames do aluno, ordenados por data

12. **`deleteLabResult(labResultId: string)`**
    - Deletar exame (e arquivo associado do Storage se existir)

**Pacientes:**

13. **`listMyPatients()`**
    - Retorna alunos vinculados ao nutricionista via `student_professionals`
    - Join com `students` para dados do aluno
    - Filtrar por `status = 'active'`

---

## Tarefa 5: Páginas do Dashboard Nutricionista

### Estrutura de arquivos

```
web/src/app/dashboard/nutritionist/
├── page.tsx                          → Dashboard principal
├── layout.tsx                        → Layout com sidebar/navegação
├── patients/
│   ├── page.tsx                      → Lista de pacientes
│   └── [id]/
│       └── page.tsx                  → Prontuário do paciente
├── consultations/
│   ├── page.tsx                      → Histórico de consultas
│   └── new/
│       └── page.tsx                  → Nova consulta
└── meal-plans/
    ├── page.tsx                      → Planos alimentares ativos
    └── new/
        └── page.tsx                  → Novo plano alimentar
```

### 5.1 Layout (`layout.tsx`)

- Seguir o padrão do layout do trainer/manager existente
- Sidebar com links:
  - Painel (ícone Home) → `/dashboard/nutritionist`
  - Pacientes (ícone Users) → `/dashboard/nutritionist/patients`
  - Consultas (ícone ClipboardList) → `/dashboard/nutritionist/consultations`
  - Planos Alimentares (ícone UtensilsCrossed) → `/dashboard/nutritionist/meal-plans`
- Header com nome do profissional e botão de logout
- Verificar `profile.profession_type === 'nutritionist'` no layout; se não, redirect

### 5.2 Dashboard principal (`page.tsx`)

Exibir cards com resumo:
- Total de pacientes ativos
- Consultas realizadas no mês
- Planos alimentares ativos
- Próximas consultas agendadas (se houver)

Dados vêm de queries diretas usando `createClient()` no Server Component.

### 5.3 Lista de pacientes (`patients/page.tsx`)

- Tabela com: nome, telefone, status do vínculo, última consulta, plano ativo
- Dados de `listMyPatients()` + consulta mais recente por aluno
- Link para prontuário do paciente

### 5.4 Prontuário do paciente (`patients/[id]/page.tsx`)

Esta é a página mais complexa. Deve ter abas ou seções:

**Aba 1: Consultas**
- Timeline de consultas (mais recente primeiro)
- Cada consulta mostra: data, tipo, queixa principal, notas
- Botão para expandir e ver anamnese + métricas
- Botão "Nova consulta"

**Aba 2: Métricas / Evolução**
- Gráfico de evolução de peso ao longo do tempo (usar Recharts, já está no projeto)
- Gráfico de composição corporal (% gordura, massa magra)
- Tabela comparativa: última avaliação vs anterior

**Aba 3: Planos Alimentares**
- Plano ativo em destaque
- Histórico de planos anteriores
- Detalhe do plano: refeições, macros totais, notas

**Aba 4: Exames**
- Lista de exames com resultados
- Indicadores visuais (verde=normal, amarelo=atenção, vermelho=alterado)
- Upload de novo exame

### 5.5 Nova consulta (`consultations/new/page.tsx`)

Formulário em etapas ou accordion:

**Etapa 1: Dados básicos**
- Selecionar paciente (dropdown dos seus pacientes)
- Tipo de consulta (inicial, retorno, reavaliação)
- Data da consulta
- Queixa principal (textarea)

**Etapa 2: Anamnese** (colapsável, preenchimento opcional)
- Histórico alimentar
- Alergias e intolerâncias (input com tags)
- Suplementos em uso (input com tags)
- Patologias e medicações
- Objetivo
- Rotina diária
- Ingestão hídrica (slider ou input numérico)
- Hábitos intestinais
- Qualidade do sono

**Etapa 3: Métricas** (colapsável, preenchimento opcional)
- Peso, altura (calcula BMI automaticamente)
- % gordura, massa magra
- Circunferências (cintura, quadril, braço, coxa, peitoral, panturrilha)
- Nível de gordura visceral
- TMB

**Etapa 4: Notas clínicas** (textarea livre)

**Botão:** "Salvar consulta" → chama `createNutritionConsultation()`

### 5.6 Novo plano alimentar (`meal-plans/new/page.tsx`)

Formulário com:
- Selecionar paciente
- Título e objetivo do plano
- Macros totais (calorias, proteína, carbs, gordura, fibra)
- Data início / data fim (opcional)
- Editor de refeições:
  - Botão "Adicionar refeição"
  - Cada refeição: nome, horário, lista de alimentos
  - Cada alimento: nome, quantidade, macros opcionais
  - Notas por refeição
- Notas gerais

---

## Tarefa 6: Componentes compartilhados

**Diretório:** `web/src/components/nutrition/`

Criar os seguintes componentes:

1. **`consultation-card.tsx`** — Card de consulta para timeline
2. **`metrics-chart.tsx`** — Gráfico de evolução de métricas (Recharts)
3. **`meal-plan-viewer.tsx`** — Visualização formatada do plano alimentar
4. **`lab-result-card.tsx`** — Card de resultado de exame com indicadores
5. **`anamnesis-form.tsx`** — Formulário de anamnese (Client Component com estado)
6. **`metrics-form.tsx`** — Formulário de métricas com cálculo auto de BMI (Client Component)
7. **`meal-plan-editor.tsx`** — Editor de refeições dinâmico (Client Component)

---

## Checklist de validação

- [ ] `npm run build` passa sem erros
- [ ] Nutricionista logado vê a lista dos seus pacientes (e não de outros nutris)
- [ ] Nutricionista consegue criar consulta completa (dados básicos + anamnese + métricas)
- [ ] Consultas aparecem na timeline do prontuário do paciente
- [ ] Gráficos de evolução renderizam corretamente com dados de múltiplas consultas
- [ ] Nutricionista consegue criar plano alimentar com múltiplas refeições
- [ ] Ao criar novo plano, o anterior é desativado automaticamente
- [ ] Nutricionista consegue registrar resultado de exame
- [ ] Manager não consegue editar dados de nutrição (somente leitura via RLS)
- [ ] Treinador não consegue ver dados de nutrição (RLS bloqueia)
- [ ] Formulários mostram mensagens de erro em português quando validação falha
