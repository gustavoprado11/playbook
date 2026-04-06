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

-- 3. Métricas fisioterapêuticas (N:1 com sessão)
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

-- 5. Evolução por sessão
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
