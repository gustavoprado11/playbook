# Spec 03 — Módulo Fisioterapia

**Sprint:** 3
**Estimativa:** 2-3 semanas
**Pré-requisito:** Spec 01 (infraestrutura) implementada
**Migrations:** 024, 025

---

## Contexto

Com a infraestrutura base e o módulo de nutrição já implementados, agora criamos o módulo de fisioterapia. A estrutura segue padrões similares ao módulo de nutrição, mas com dados específicos da prática fisioterapêutica: sessões de tratamento, avaliação de dor (escala EVA), amplitude de movimento, protocolos de reabilitação e evolução por sessão.

> **Nota:** O módulo de fisioterapia pode ser implementado em paralelo com o de nutrição (Sprint 2 e 3 simultâneos), desde que a Spec 01 já esteja pronta.

---

## Tarefa 1: Migration 024 — Tabelas de fisioterapia

**Arquivo:** `supabase/migrations/024_physio_module.sql`

```sql
-- ============================================
-- MÓDULO FISIOTERAPIA
-- ============================================

-- 1. Sessões de fisioterapia
CREATE TABLE IF NOT EXISTS physio_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_type TEXT NOT NULL CHECK (session_type IN (
        'initial_assessment', 'treatment', 'reassessment', 'discharge'
    )),
    clinical_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_sessions_student ON physio_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_physio_sessions_professional ON physio_sessions(professional_id);
CREATE INDEX IF NOT EXISTS idx_physio_sessions_date ON physio_sessions(session_date DESC);

CREATE TRIGGER set_physio_sessions_updated_at
    BEFORE UPDATE ON physio_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

-- 2. Anamnese fisioterapêutica (1:1 com sessão de avaliação inicial)
CREATE TABLE IF NOT EXISTS physio_anamnesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES physio_sessions(id) ON DELETE CASCADE,
    chief_complaint TEXT,
    pain_location TEXT[] DEFAULT '{}',
    pain_intensity INTEGER CHECK (pain_intensity BETWEEN 0 AND 10),
    pain_type TEXT,
    onset_date DATE,
    aggravating_factors TEXT[] DEFAULT '{}',
    relieving_factors TEXT[] DEFAULT '{}',
    medical_history TEXT,
    surgical_history TEXT,
    medications TEXT[] DEFAULT '{}',
    imaging_results TEXT,
    functional_limitations TEXT,
    previous_treatments TEXT,
    additional_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT physio_anamnesis_session_unique UNIQUE(session_id)
);

-- 3. Métricas fisioterapêuticas (N:1 com sessão — múltiplas métricas por sessão)
CREATE TABLE IF NOT EXISTS physio_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES physio_sessions(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'rom', 'strength', 'pain', 'functional_test', 'posture', 'gait', 'balance'
    )),
    body_region TEXT NOT NULL,
    movement TEXT,
    value DECIMAL(6,2),
    unit TEXT,
    side TEXT CHECK (side IN ('left', 'right', 'bilateral', 'midline')),
    is_within_normal BOOLEAN,
    reference_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_metrics_session ON physio_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_physio_metrics_type ON physio_metrics(metric_type);

-- 4. Protocolos de tratamento
CREATE TABLE IF NOT EXISTS physio_treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    objectives TEXT[] NOT NULL DEFAULT '{}',
    contraindications TEXT[] DEFAULT '{}',
    estimated_sessions INTEGER,
    frequency TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'paused', 'cancelled'
    )),
    exercises JSONB DEFAULT '[]',
    modalities JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_treatment_plans_student ON physio_treatment_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_physio_treatment_plans_professional ON physio_treatment_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_physio_treatment_plans_status ON physio_treatment_plans(status);

CREATE TRIGGER set_physio_treatment_plans_updated_at
    BEFORE UPDATE ON physio_treatment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

-- 5. Evolução por sessão (vinculada a sessão + opcionalmente a protocolo)
CREATE TABLE IF NOT EXISTS physio_session_evolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES physio_sessions(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES physio_treatment_plans(id) ON DELETE SET NULL,
    procedures_performed TEXT[] DEFAULT '{}',
    patient_response TEXT,
    pain_before INTEGER CHECK (pain_before BETWEEN 0 AND 10),
    pain_after INTEGER CHECK (pain_after BETWEEN 0 AND 10),
    exercises_performed JSONB DEFAULT '[]',
    home_exercises JSONB DEFAULT '[]',
    next_session_plan TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT physio_evolution_session_unique UNIQUE(session_id)
);

-- 6. Anexos (exames de imagem, laudos, fotos)
CREATE TABLE IF NOT EXISTS physio_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES physio_sessions(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES physio_treatment_plans(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT physio_attachments_has_parent CHECK (
        session_id IS NOT NULL OR treatment_plan_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_physio_attachments_session ON physio_attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_physio_attachments_plan ON physio_attachments(treatment_plan_id);
CREATE INDEX IF NOT EXISTS idx_physio_attachments_student ON physio_attachments(student_id);
```

### Estrutura esperada do JSONB `exercises` (protocolo de tratamento)

```json
[
    {
        "name": "Alongamento isquiotibiais",
        "sets": 3,
        "reps": "30 segundos",
        "load": null,
        "notes": "Manter posição sem compensação lombar",
        "progression": "Aumentar tempo para 45s na semana 3"
    },
    {
        "name": "Fortalecimento quadríceps",
        "sets": 3,
        "reps": "12 repetições",
        "load": "2kg",
        "notes": "Evitar extensão completa do joelho",
        "progression": "Aumentar carga 0.5kg/semana"
    }
]
```

### Estrutura esperada do JSONB `modalities` (modalidades terapêuticas)

```json
[
    { "name": "Crioterapia", "duration": "15 minutos", "area": "Joelho direito", "notes": "Pós exercícios" },
    { "name": "TENS", "duration": "20 minutos", "frequency": "100Hz", "area": "Lombar", "notes": "Modo convencional" }
]
```

### Estrutura esperada do JSONB `exercises_performed` (evolução por sessão)

```json
[
    { "name": "Alongamento isquiotibiais", "sets_done": 3, "reps_done": "30s", "load_used": null, "tolerance": "boa" },
    { "name": "Fortalecimento quadríceps", "sets_done": 3, "reps_done": "10", "load_used": "1.5kg", "tolerance": "moderada" }
]
```

### Estrutura esperada do JSONB `home_exercises`

```json
[
    { "name": "Alongamento gastrocnêmio", "frequency": "2x ao dia", "duration": "30 segundos cada lado", "notes": "Fazer ao acordar e antes de dormir" },
    { "name": "Gelo local", "frequency": "Após atividade física", "duration": "15 minutos", "notes": "Envolver em pano, não aplicar direto na pele" }
]
```

---

## Tarefa 2: Migration 025 — RLS para tabelas de fisioterapia

**Arquivo:** `supabase/migrations/025_physio_rls.sql`

```sql
-- Habilitar RLS
ALTER TABLE physio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_session_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_attachments ENABLE ROW LEVEL SECURITY;

-- Padrão: Manager = acesso total; Fisioterapeuta = seus registros

-- === PHYSIO_SESSIONS ===
CREATE POLICY physio_sessions_manager_all ON physio_sessions
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_sessions_own_all ON physio_sessions
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === PHYSIO_ANAMNESIS ===
CREATE POLICY physio_anamnesis_manager_all ON physio_anamnesis
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_anamnesis_own_all ON physio_anamnesis
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_METRICS ===
CREATE POLICY physio_metrics_manager_all ON physio_metrics
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_metrics_own_all ON physio_metrics
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_TREATMENT_PLANS ===
CREATE POLICY physio_treatment_plans_manager_all ON physio_treatment_plans
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_treatment_plans_own_all ON physio_treatment_plans
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === PHYSIO_SESSION_EVOLUTION ===
CREATE POLICY physio_evolution_manager_all ON physio_session_evolution
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_evolution_own_all ON physio_session_evolution
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_ATTACHMENTS ===
CREATE POLICY physio_attachments_manager_all ON physio_attachments
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_attachments_own_all ON physio_attachments
    FOR ALL TO authenticated
    USING (
        (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR
        (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    )
    WITH CHECK (
        (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR
        (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    );
```

---

## Tarefa 3: TypeScript types para fisioterapia

**Arquivo:** `web/src/types/database.ts` — Adicionar ao final

```typescript
// === MÓDULO FISIOTERAPIA ===

export type PhysioSessionType = 'initial_assessment' | 'treatment' | 'reassessment' | 'discharge';
export type PhysioMetricType = 'rom' | 'strength' | 'pain' | 'functional_test' | 'posture' | 'gait' | 'balance';
export type PhysioBodySide = 'left' | 'right' | 'bilateral' | 'midline';
export type PhysioTreatmentStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface PhysioSession {
    id: string;
    student_id: string;
    professional_id: string;
    session_date: string;
    session_type: PhysioSessionType;
    clinical_notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
    anamnesis?: PhysioAnamnesis;
    metrics?: PhysioMetric[];
    evolution?: PhysioSessionEvolution;
}

export interface PhysioAnamnesis {
    id: string;
    session_id: string;
    chief_complaint: string | null;
    pain_location: string[];
    pain_intensity: number | null;
    pain_type: string | null;
    onset_date: string | null;
    aggravating_factors: string[];
    relieving_factors: string[];
    medical_history: string | null;
    surgical_history: string | null;
    medications: string[];
    imaging_results: string | null;
    functional_limitations: string | null;
    previous_treatments: string | null;
    additional_notes: string | null;
    created_at: string;
}

export interface PhysioMetric {
    id: string;
    session_id: string;
    metric_type: PhysioMetricType;
    body_region: string;
    movement: string | null;
    value: number | null;
    unit: string | null;
    side: PhysioBodySide | null;
    is_within_normal: boolean | null;
    reference_value: string | null;
    notes: string | null;
    created_at: string;
}

export interface PhysioExercise {
    name: string;
    sets: number;
    reps: string;
    load: string | null;
    notes?: string;
    progression?: string;
}

export interface PhysioModality {
    name: string;
    duration: string;
    area: string;
    frequency?: string;
    notes?: string;
}

export interface PhysioTreatmentPlan {
    id: string;
    student_id: string;
    professional_id: string;
    diagnosis: string;
    objectives: string[];
    contraindications: string[];
    estimated_sessions: number | null;
    frequency: string | null;
    start_date: string;
    end_date: string | null;
    status: PhysioTreatmentStatus;
    exercises: PhysioExercise[];
    modalities: PhysioModality[];
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Joined fields
    student?: Student;
}

export interface PhysioExercisePerformed {
    name: string;
    sets_done: number;
    reps_done: string;
    load_used: string | null;
    tolerance: string;
}

export interface PhysioHomeExercise {
    name: string;
    frequency: string;
    duration: string;
    notes?: string;
}

export interface PhysioSessionEvolution {
    id: string;
    session_id: string;
    treatment_plan_id: string | null;
    procedures_performed: string[];
    patient_response: string | null;
    pain_before: number | null;
    pain_after: number | null;
    exercises_performed: PhysioExercisePerformed[];
    home_exercises: PhysioHomeExercise[];
    next_session_plan: string | null;
    notes: string | null;
    created_at: string;
}

export interface PhysioAttachment {
    id: string;
    session_id: string | null;
    treatment_plan_id: string | null;
    student_id: string;
    file_path: string;
    file_type: string;
    file_size: number | null;
    description: string | null;
    created_at: string;
}

// Input types para actions
export interface CreatePhysioSessionInput {
    student_id: string;
    session_date?: string;
    session_type: PhysioSessionType;
    clinical_notes?: string;
    anamnesis?: Omit<PhysioAnamnesis, 'id' | 'session_id' | 'created_at'>;
    metrics?: Omit<PhysioMetric, 'id' | 'session_id' | 'created_at'>[];
    evolution?: Omit<PhysioSessionEvolution, 'id' | 'session_id' | 'created_at'>;
}

export interface CreateTreatmentPlanInput {
    student_id: string;
    diagnosis: string;
    objectives: string[];
    contraindications?: string[];
    estimated_sessions?: number;
    frequency?: string;
    start_date: string;
    end_date?: string;
    exercises?: PhysioExercise[];
    modalities?: PhysioModality[];
    notes?: string;
}
```

---

## Tarefa 4: Server Actions — Fisioterapia

**Arquivo:** `web/src/app/actions/physio.ts` (novo arquivo)

### Padrão de autenticação

Idêntico ao módulo de nutrição, mas verificando `profession_type = 'physiotherapist'`.

### Actions a implementar

**Sessões:**

1. **`listPhysioSessions(studentId?: string)`**
   - Lista sessões do fisioterapeuta logado, com join no `students`
   - Filtro opcional por aluno
   - Ordenar por `session_date DESC`

2. **`getPhysioSession(sessionId: string)`**
   - Sessão completa com joins: `anamnesis`, `metrics[]`, `evolution`

3. **`createPhysioSession(input: CreatePhysioSessionInput)`**
   - Criar sessão + anamnese (se inicial) + métricas + evolução
   - Fluxo:
     1. Insert em `physio_sessions`
     2. Se `input.anamnesis` → insert em `physio_anamnesis`
     3. Se `input.metrics` → insert batch em `physio_metrics`
     4. Se `input.evolution` → insert em `physio_session_evolution`
   - Revalidar: `/dashboard/physiotherapist/patients`, `/dashboard/physiotherapist/patients/${input.student_id}`

4. **`updatePhysioSession(sessionId: string, input: Partial<CreatePhysioSessionInput>)`**
   - Atualizar sessão e sub-registros
   - Para metrics: deletar existentes e re-inserir (replace all)

5. **`deletePhysioSession(sessionId: string)`**
   - Deletar sessão (CASCADE)

**Protocolos de tratamento:**

6. **`listTreatmentPlans(studentId?: string)`**
   - Lista protocolos do fisioterapeuta
   - Filtro opcional por aluno e status

7. **`createTreatmentPlan(input: CreateTreatmentPlanInput)`**
   - Criar protocolo
   - NÃO desativar protocolos anteriores automaticamente (paciente pode ter múltiplos problemas)

8. **`updateTreatmentPlan(planId: string, input: Partial<CreateTreatmentPlanInput & { status: PhysioTreatmentStatus }>)`**
   - Atualizar protocolo, incluindo mudança de status

9. **`completeTreatmentPlan(planId: string)`**
   - Marca como `completed`, seta `end_date = today`

**Anexos:**

10. **`uploadPhysioAttachment(input: { session_id?: string, treatment_plan_id?: string, student_id: string, file: File, description?: string })`**
    - Upload via Supabase Storage bucket `physio-attachments`
    - Registrar na tabela `physio_attachments`

11. **`deletePhysioAttachment(attachmentId: string)`**
    - Deletar registro + arquivo do Storage

**Pacientes:**

12. **`listMyPhysioPatients()`**
    - Retorna alunos vinculados ao fisioterapeuta via `student_professionals`
    - Join com `students`
    - Filtrar por `status = 'active'`

---

## Tarefa 5: Páginas do Dashboard Fisioterapeuta

### Estrutura de arquivos

```
web/src/app/dashboard/physiotherapist/
├── page.tsx                           → Dashboard principal
├── layout.tsx                         → Layout com sidebar
├── patients/
│   ├── page.tsx                       → Lista de pacientes
│   └── [id]/
│       └── page.tsx                   → Prontuário do paciente
├── sessions/
│   ├── page.tsx                       → Histórico de sessões
│   └── new/
│       └── page.tsx                   → Nova sessão
└── treatment-plans/
    ├── page.tsx                       → Protocolos ativos
    └── new/
        └── page.tsx                   → Novo protocolo
```

### 5.1 Layout (`layout.tsx`)

- Sidebar com links:
  - Painel (ícone Home) → `/dashboard/physiotherapist`
  - Pacientes (ícone Users) → `/dashboard/physiotherapist/patients`
  - Sessões (ícone Activity) → `/dashboard/physiotherapist/sessions`
  - Protocolos (ícone FileText) → `/dashboard/physiotherapist/treatment-plans`
- Verificar `profile.profession_type === 'physiotherapist'`; se não, redirect

### 5.2 Dashboard principal (`page.tsx`)

Cards de resumo:
- Total de pacientes ativos
- Sessões realizadas no mês
- Protocolos ativos
- Pacientes com alta prevista neste mês

### 5.3 Prontuário do paciente (`patients/[id]/page.tsx`)

**Aba 1: Sessões**
- Timeline de sessões (mais recente primeiro)
- Cada sessão mostra: data, tipo, dor (antes → depois), notas
- Badge visual por tipo: avaliação (azul), tratamento (verde), reavaliação (amarelo), alta (cinza)
- Expandir para ver anamnese, métricas, evolução

**Aba 2: Métricas / Evolução**
- Gráfico de evolução da dor ao longo das sessões (Recharts)
- Gráfico de amplitude de movimento (ROM) por região/movimento
- Comparativo: avaliação inicial vs mais recente

**Aba 3: Protocolos de Tratamento**
- Protocolo(s) ativo(s) em destaque
- Lista de exercícios prescritos com progressão
- Modalidades terapêuticas
- Progresso: sessões realizadas vs estimadas
- Histórico de protocolos anteriores

**Aba 4: Exercícios para Casa**
- Consolidado dos exercícios domiciliares prescritos na última sessão
- Formato "cartão" para fácil visualização (pensando no futuro painel do aluno)

**Aba 5: Anexos**
- Exames de imagem, laudos, fotos de evolução
- Upload de novos anexos

### 5.4 Nova sessão (`sessions/new/page.tsx`)

Formulário em etapas ou accordion:

**Etapa 1: Dados básicos**
- Selecionar paciente
- Tipo de sessão (avaliação inicial, tratamento, reavaliação, alta)
- Data da sessão
- Vincular a protocolo existente (dropdown, opcional)

**Etapa 2: Anamnese** (visível apenas se tipo = `initial_assessment`)
- Queixa principal
- Localização da dor (seleção múltipla com body map ou tags)
- Intensidade da dor (slider 0-10, escala EVA)
- Tipo de dor
- Data início dos sintomas
- Fatores de piora / melhora (inputs com tags)
- Histórico médico e cirúrgico
- Medicações
- Exames de imagem
- Limitações funcionais
- Tratamentos anteriores

**Etapa 3: Métricas** (colapsável)
- Interface dinâmica: "Adicionar métrica"
- Para cada métrica:
  - Tipo (ROM, Força, Dor, Teste funcional, Postura, Marcha, Equilíbrio)
  - Região do corpo (dropdown)
  - Movimento (se ROM: flexão, extensão, abdução, etc.)
  - Valor + unidade
  - Lado (esquerdo, direito, bilateral)
  - Dentro do normal? (toggle)
  - Valor de referência
  - Notas

**Etapa 4: Evolução** (visível se tipo ≠ `initial_assessment`)
- Procedimentos realizados (input com tags)
- Dor antes da sessão (slider 0-10)
- Dor após a sessão (slider 0-10)
- Resposta do paciente (textarea)
- Exercícios realizados (auto-preenchido do protocolo, editável)
- Exercícios para casa (editor dinâmico)
- Plano para próxima sessão (textarea)
- Notas

**Etapa 5: Notas clínicas** (textarea)

### 5.5 Novo protocolo (`treatment-plans/new/page.tsx`)

Formulário com:
- Selecionar paciente
- Diagnóstico fisioterapêutico (textarea)
- Objetivos do tratamento (input com tags)
- Contraindicações (input com tags)
- Sessões estimadas (input numérico)
- Frequência (ex: "2x/semana")
- Data início / data fim (opcional)
- Editor de exercícios:
  - Botão "Adicionar exercício"
  - Cada exercício: nome, séries, repetições/tempo, carga, notas, progressão
- Editor de modalidades:
  - Botão "Adicionar modalidade"
  - Cada modalidade: nome, duração, frequência, área, notas
- Notas gerais

---

## Tarefa 6: Componentes compartilhados

**Diretório:** `web/src/components/physio/`

1. **`session-card.tsx`** — Card de sessão para timeline, com badge de tipo e indicador de dor
2. **`pain-scale.tsx`** — Componente visual da escala EVA (0-10) com cores (verde→amarelo→vermelho)
3. **`pain-chart.tsx`** — Gráfico de evolução da dor ao longo das sessões (Recharts)
4. **`rom-chart.tsx`** — Gráfico de amplitude de movimento (Recharts)
5. **`treatment-plan-card.tsx`** — Card do protocolo com progresso
6. **`exercise-editor.tsx`** — Editor dinâmico de exercícios (Client Component)
7. **`modality-editor.tsx`** — Editor dinâmico de modalidades (Client Component)
8. **`metrics-form.tsx`** — Formulário dinâmico de métricas fisio (Client Component)
9. **`anamnesis-form.tsx`** — Formulário de anamnese fisio (Client Component)
10. **`home-exercises-card.tsx`** — Card de exercícios para casa

---

## Checklist de validação

- [ ] `npm run build` passa sem erros
- [ ] Fisioterapeuta logado vê seus pacientes (e não de outros fisios)
- [ ] Fisioterapeuta consegue criar sessão de avaliação inicial com anamnese + métricas
- [ ] Fisioterapeuta consegue criar sessão de tratamento com evolução
- [ ] Escala EVA renderiza corretamente (0-10, gradiente de cores)
- [ ] Gráfico de evolução da dor mostra tendência ao longo das sessões
- [ ] Fisioterapeuta consegue criar protocolo de tratamento com exercícios e modalidades
- [ ] Fisioterapeuta consegue marcar protocolo como concluído
- [ ] Upload de anexos funciona e arquivos são salvos no Supabase Storage
- [ ] Exercícios para casa aparecem corretamente na aba do paciente
- [ ] Manager não consegue editar dados de fisioterapia (somente leitura via RLS)
- [ ] Nutricionista e treinador não conseguem ver dados de fisioterapia (RLS bloqueia)
