-- 1. Create New Tables

-- 1.1 Protocols
CREATE TABLE assessment_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pillar TEXT NOT NULL CHECK (pillar IN ('composition', 'neuromuscular', 'specific', 'rom')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Metrics
CREATE TABLE protocol_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID NOT NULL REFERENCES assessment_protocols(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Assessment Instances
CREATE TABLE student_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    protocol_id UUID NOT NULL REFERENCES assessment_protocols(id),
    performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id), -- Nullable for migration compatibility if needed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 Assessment Data
CREATE TABLE assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES student_assessments(id) ON DELETE CASCADE,
    metric_id UUID NOT NULL REFERENCES protocol_metrics(id),
    value DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assessment_id, metric_id)
);

-- 2. Data Migration
-- Migrate existing Test Types to Protocols (1-to-1 mapping)
DO $$
DECLARE
    r_test_type RECORD;
    v_protocol_id UUID;
    v_metric_id UUID;
    r_result RECORD;
    v_assessment_id UUID;
BEGIN
    FOR r_test_type IN SELECT * FROM test_types LOOP
        -- Create Protocol
        INSERT INTO assessment_protocols (id, name, pillar, is_active, created_by, created_at)
        VALUES (gen_random_uuid(), r_test_type.name, r_test_type.pillar, r_test_type.is_active, r_test_type.created_by, r_test_type.created_at)
        RETURNING id INTO v_protocol_id;

        -- Create Single Metric for this Protocol
        INSERT INTO protocol_metrics (protocol_id, name, unit, display_order, is_required)
        VALUES (v_protocol_id, 'Resultado', r_test_type.unit, 0, TRUE)
        RETURNING id INTO v_metric_id;

        -- Migrate Results for this Test Type
        FOR r_result IN SELECT * FROM student_results WHERE test_type_id = r_test_type.id LOOP
            -- Create Assessment
            INSERT INTO student_assessments (student_id, protocol_id, performed_at, notes, created_by, created_at)
            VALUES (r_result.student_id, v_protocol_id, r_result.measured_at, r_result.notes, r_result.created_by, r_result.created_at)
            RETURNING id INTO v_assessment_id;

            -- Create Result
            INSERT INTO assessment_results (assessment_id, metric_id, value, created_at)
            VALUES (v_assessment_id, v_metric_id, r_result.value, r_result.created_at);
        END LOOP;
    END LOOP;
END $$;

-- 3. Update KPI Function
CREATE OR REPLACE FUNCTION calculate_management(
    p_trainer_id UUID,
    p_reference_month DATE
) RETURNS TABLE (
    portfolio_size INTEGER,
    managed_count INTEGER,
    management_rate DECIMAL(5,2)
) AS $$
DECLARE
    v_reference_month DATE;
    v_window_days INTEGER;
    v_calculation_date DATE;
BEGIN
    v_reference_month := DATE_TRUNC('month', p_reference_month)::DATE;
    v_window_days := get_management_window_days();
    
    IF DATE_TRUNC('month', CURRENT_DATE) = v_reference_month THEN
        v_calculation_date := CURRENT_DATE;
    ELSE
        v_calculation_date := (v_reference_month + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

    -- Portfolio size (Active students)
    SELECT COUNT(*)::INTEGER INTO portfolio_size
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'; 

    -- Managed count: Students with at least one assessment in window
    SELECT COUNT(DISTINCT s.id)::INTEGER INTO managed_count
    FROM students s
    JOIN student_assessments sa ON s.id = sa.student_id
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'
      AND sa.performed_at BETWEEN (v_calculation_date - v_window_days * INTERVAL '1 day')::DATE AND v_calculation_date;

    IF portfolio_size > 0 THEN
        management_rate := ROUND((managed_count::DECIMAL / portfolio_size) * 100, 2);
    ELSE
        management_rate := 0.00;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. RLS Policies
-- Enable RLS
ALTER TABLE assessment_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

-- Protocols & Metrics (Public read for authenticated, Manager write)
CREATE POLICY "Everyone view active protocols" ON assessment_protocols FOR SELECT USING (is_active = TRUE OR public.is_manager());
CREATE POLICY "Managers manage protocols" ON assessment_protocols FOR ALL USING (public.is_manager());

CREATE POLICY "Everyone view metrics" ON protocol_metrics FOR SELECT USING (true);
CREATE POLICY "Managers manage metrics" ON protocol_metrics FOR ALL USING (public.is_manager());

-- Assessments (Trainers view/insert own, Managers view all)
CREATE POLICY "Managers view all assessments" ON student_assessments FOR SELECT USING (public.is_manager());
CREATE POLICY "Trainers view own student assessments" ON student_assessments FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE trainer_id = public.get_trainer_id())
);
CREATE POLICY "Trainers insert own student assessments" ON student_assessments FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE trainer_id = public.get_trainer_id())
);

-- Results (Inherit from Assessment)
CREATE POLICY "Managers view all result values" ON assessment_results FOR SELECT USING (public.is_manager());
CREATE POLICY "Trainers view own result values" ON assessment_results FOR SELECT USING (
    assessment_id IN (
        SELECT id FROM student_assessments WHERE student_id IN (
            SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
        )
    )
);
CREATE POLICY "Trainers insert own result values" ON assessment_results FOR INSERT WITH CHECK (
    assessment_id IN (
        SELECT id FROM student_assessments WHERE student_id IN (
            SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
        )
    )
);

-- 5. Cleanup (Deprecated Tables)
-- We keep them for safety for now, but rename them to indicate deprecation or just rely on new tables.
-- Ideally we drop them if we are confident in the migration DO block above.
-- DROP TABLE student_results;
-- DROP TABLE test_types;
