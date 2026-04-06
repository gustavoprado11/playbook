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

CREATE TRIGGER set_nutrition_consultations_updated_at
    BEFORE UPDATE ON nutrition_consultations
    FOR EACH ROW
    EXECUTE FUNCTION update_professionals_updated_at();

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
