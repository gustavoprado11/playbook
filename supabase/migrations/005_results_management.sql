-- Migration: 005_results_management.sql
-- Description: Implement data-driven Results Management, replacing manual checklists

-- =====================================================
-- 1. HELPER FUNCTIONS (New)
-- =====================================================

CREATE OR REPLACE FUNCTION get_management_window_days()
RETURNS INTEGER AS $$
DECLARE
    v_rule game_rules;
BEGIN
    v_rule := get_active_game_rule();
    
    IF v_rule IS NULL THEN
        RETURN 60; -- Default fallback
    END IF;
    
    RETURN COALESCE((v_rule.kpi_config->'management'->>'window_days')::INTEGER, 60);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 2. SCHEMA DEFINITIONS
-- =====================================================

-- 2.1 Test Types
CREATE TABLE test_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- e.g., 'kg', 'cm', '%', 's'
    pillar TEXT NOT NULL CHECK (pillar IN ('composition', 'neuromuscular', 'specific', 'rom')),
    created_by UUID REFERENCES profiles(id), -- NULL means system default
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for standardized lookups
CREATE INDEX idx_test_types_pillar ON test_types(pillar);

-- 2.2 Student Results
CREATE TABLE student_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_type_id UUID NOT NULL REFERENCES test_types(id),
    value DECIMAL(10,2) NOT NULL,
    notes TEXT,
    measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for KPI calculation (window checking)
CREATE INDEX idx_student_results_student_date ON student_results(student_id, measured_at DESC);

-- =====================================================
-- 3. FUNCTION UPDATES (Replace logic BEFORE dropping table)
-- =====================================================

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
    v_window_start DATE;
    v_window_end DATE; /* Usually we check backwards from TODAY or Month End? */
    /* Requirement: "Dentro de window_days" related to "result_date" 
       If calculating for a past month, should we use the end of that month?
       Yes, snapshot logic implies using the reference month context. 
       Let's assume window is [MonthEnd - Window, MonthEnd]. 
       Or relative to current date if "live"? 
       Common practice: For KPI snapshot (past), use relative to month end. 
       For Live dashboard, use relative to Today.
       
       However, the text says:
       "result_date BETWEEN (current_date - window_days) AND current_date"
       
       Let's use the p_reference_month as the anchor.
       If p_reference_month is current month, we anchor at CURRENT_DATE? 
       Actually, standard is usually: Anchor at "End of Reference Period".
       If Reference Month is Nov 2023, we check results up to Nov 30 (or today if still Nov).
    */
    v_calculation_date DATE;
BEGIN
    v_reference_month := DATE_TRUNC('month', p_reference_month)::DATE;
    v_window_days := get_management_window_days();
    
    -- Determine the reference date for the window
    -- If p_reference_month is the current month, we use TODAY.
    -- If it's a past month, we use the LAST DAY of that month.
    IF DATE_TRUNC('month', CURRENT_DATE) = v_reference_month THEN
        v_calculation_date := CURRENT_DATE;
    ELSE
        -- Last day of the reference month
        v_calculation_date := (v_reference_month + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

    -- Calculate Portfolio Size (Active students at calculation date)
    -- Note: Original logic checked 'active' status. Keep consistent.
    SELECT COUNT(*)::INTEGER INTO portfolio_size
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'; 
      -- Ideally we should check if they were active AT v_calculation_date, 
      -- but current schema stores current status. 
      -- For MVP live dashboard this is fine. For historical snapshots, might be slightly off if status changed later, 
      -- but snapshots are immutable once generated.

    -- Calculate Managed Count (Students with >= 1 result in window)
    SELECT COUNT(DISTINCT s.id)::INTEGER INTO managed_count
    FROM students s
    JOIN student_results sr ON s.id = sr.student_id
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'
      AND sr.measured_at BETWEEN (v_calculation_date - v_window_days * INTERVAL '1 day')::DATE AND v_calculation_date;

    -- Calculate management rate
    IF portfolio_size > 0 THEN
        management_rate := ROUND((managed_count::DECIMAL / portfolio_size) * 100, 2);
    ELSE
        management_rate := 0.00;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;


-- =====================================================
-- 4. CLEANUP (Deprecate old table)
-- =====================================================

DROP TABLE IF EXISTS result_management CASCADE;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_results ENABLE ROW LEVEL SECURITY;

-- 5.1 TEST TYPES (Definitions)
-- Managers can create
CREATE POLICY "Managers can create test types" ON test_types
    FOR INSERT WITH CHECK (public.is_manager());

-- Managers can update/delete
CREATE POLICY "Managers can update test types" ON test_types
    FOR UPDATE USING (public.is_manager());
    
CREATE POLICY "Managers can delete test types" ON test_types
    FOR DELETE USING (public.is_manager());

-- Everyone can view (Trainers need to select them)
CREATE POLICY "Everyone can view active test types" ON test_types
    FOR SELECT USING (is_active = TRUE OR public.is_manager());


-- 5.2 STUDENT RESULTS (Strict)

-- Managers: Read Only
CREATE POLICY "Managers view all results" ON student_results
    FOR SELECT USING (public.is_manager());

-- Trainers: View Only Own Students' Results
CREATE POLICY "Trainers view own student results" ON student_results
    FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- Trainers: Insert Only for Own Students
CREATE POLICY "Trainers insert own student results" ON student_results
    FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- NO UPDATE/DELETE policies for Trainers (Immutable)

-- =====================================================
-- 6. DATA MIGRATION (Config Update)
-- =====================================================

-- Update default KPI config in game_rules to include window_days
UPDATE game_rules
SET kpi_config = jsonb_set(
    kpi_config,
    '{management, window_days}',
    '60'::jsonb
)
WHERE (kpi_config->'management'->>'window_days') IS NULL;
