-- 1. Add is_archived to students
ALTER TABLE students ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update calculate_retention to exclude archived students
CREATE OR REPLACE FUNCTION calculate_retention(
    p_trainer_id UUID,
    p_reference_month DATE
) RETURNS TABLE (
    students_start INTEGER,
    students_end INTEGER,
    cancellations INTEGER,
    retention_rate DECIMAL(5,2),
    retention_eligible BOOLEAN
) AS $$
DECLARE
    v_month_start DATE;
    v_month_end DATE;
    v_min_portfolio INTEGER;
BEGIN
    -- Normalize to first day of month
    v_month_start := DATE_TRUNC('month', p_reference_month)::DATE;
    v_month_end := (DATE_TRUNC('month', p_reference_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_min_portfolio := get_min_portfolio_size();
    
    -- Count students active at start of month
    -- Exclude archived students
    SELECT COUNT(*)::INTEGER INTO students_start
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date < v_month_start
      AND (
          s.status != 'cancelled' 
          OR (s.status = 'cancelled' AND s.end_date >= v_month_start)
      );
    
    -- Count students active at end of month
    -- Exclude archived students
    SELECT COUNT(*)::INTEGER INTO students_end
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.start_date <= v_month_end
      AND s.status = 'active';
    
    -- Count cancellations during the month
    -- Exclude archived students (if archived, they don't count as churn, just removed)
    SELECT COUNT(*)::INTEGER INTO cancellations
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.status = 'cancelled'
      AND s.end_date BETWEEN v_month_start AND v_month_end
      AND s.start_date < v_month_start; 
    
    -- Check eligibility
    retention_eligible := students_start >= v_min_portfolio;
    
    -- Calculate retention rate
    IF students_start > 0 THEN
        retention_rate := ROUND(((students_start - cancellations)::DECIMAL / students_start) * 100, 2);
    ELSE
        retention_rate := 0.00;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Update calculate_referrals to exclude archived students
CREATE OR REPLACE FUNCTION calculate_referrals(
    p_trainer_id UUID,
    p_reference_month DATE
) RETURNS INTEGER AS $$
DECLARE
    v_month_start DATE;
    v_month_end DATE;
    v_count INTEGER;
BEGIN
    v_month_start := DATE_TRUNC('month', p_reference_month)::DATE;
    v_month_end := (DATE_TRUNC('month', p_reference_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM students s
    WHERE s.referred_by_trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.origin = 'referral'
      AND s.start_date BETWEEN v_month_start AND v_month_end
      AND s.referral_validated_at IS NOT NULL;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Update calculate_management to exclude archived students
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

    -- Portfolio size (Active, non-archived students)
    SELECT COUNT(*)::INTEGER INTO portfolio_size
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'
      AND s.is_archived = FALSE; 

    -- Managed count: Active, non-archived students with assessments working window
    SELECT COUNT(DISTINCT s.id)::INTEGER INTO managed_count
    FROM students s
    JOIN student_assessments sa ON s.id = sa.student_id
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'
      AND s.is_archived = FALSE
      AND sa.performed_at BETWEEN (v_calculation_date - v_window_days * INTERVAL '1 day')::DATE AND v_calculation_date;

    IF portfolio_size > 0 THEN
        management_rate := ROUND((managed_count::DECIMAL / portfolio_size) * 100, 2);
    ELSE
        management_rate := 0.00;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Update pending referrals count in get_trainer_dashboard_data logic
-- NOTE: The logic is embedded in the large function `get_trainer_dashboard_data`.
-- We need to replace that function entirely to filter archived students in the "pending" query.

CREATE OR REPLACE FUNCTION get_trainer_dashboard_data(
    p_trainer_id UUID,
    p_reference_month DATE DEFAULT NULL
) RETURNS TABLE (
    reference_month DATE,
    students_start INTEGER,
    students_end INTEGER,
    cancellations INTEGER,
    retention_rate DECIMAL(5,2),
    retention_target DECIMAL(5,2),
    retention_eligible BOOLEAN,
    retention_achieved BOOLEAN,
    referrals_count INTEGER,
    referrals_target INTEGER,
    referrals_achieved BOOLEAN,
    referrals_pending INTEGER,
    portfolio_size INTEGER,
    managed_count INTEGER,
    management_rate DECIMAL(5,2),
    management_target DECIMAL(5,2),
    management_achieved BOOLEAN,
    reward_amount DECIMAL(10,2),
    is_finalized BOOLEAN
) AS $$
DECLARE
    v_reference_month DATE;
    v_rule game_rules;
    v_config JSONB;
    v_retention RECORD;
    v_referrals_validated INTEGER;
    v_management RECORD;
BEGIN
    v_reference_month := COALESCE(p_reference_month, DATE_TRUNC('month', CURRENT_DATE)::DATE);
    v_reference_month := DATE_TRUNC('month', v_reference_month)::DATE;
    
    -- Check for existing finalized snapshot
    SELECT ps.reference_month,
           ps.students_start,
           ps.students_end,
           ps.cancellations,
           ps.retention_rate,
           ps.retention_target,
           ps.retention_eligible,
           ps.retention_achieved,
           ps.referrals_count,
           ps.referrals_target,
           ps.referrals_achieved,
           0, -- pending placeholder
           ps.portfolio_size,
           ps.managed_count,
           ps.management_rate,
           ps.management_target,
           ps.management_achieved,
           ps.reward_amount,
           ps.is_finalized
    INTO reference_month, students_start, students_end, cancellations,
         retention_rate, retention_target, retention_eligible, retention_achieved,
         referrals_count, referrals_target, referrals_achieved, referrals_pending,
         portfolio_size, managed_count, management_rate, management_target,
         management_achieved, reward_amount, is_finalized
    FROM performance_snapshots ps
    WHERE ps.trainer_id = p_trainer_id
      AND ps.reference_month = v_reference_month
      AND ps.is_finalized = TRUE;
    
    IF FOUND THEN
        -- Calculate pending referrals even for finalized snapshots (live data)
        SELECT COUNT(*)::INTEGER INTO referrals_pending
        FROM students s
        WHERE s.referred_by_trainer_id = p_trainer_id
          AND s.is_archived = FALSE
          AND s.origin = 'referral'
          AND s.referral_validated_at IS NULL
          AND s.status = 'active';
        
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Calculate live data
    reference_month := v_reference_month;
    is_finalized := FALSE;
    
    v_rule := get_active_game_rule();
    v_config := v_rule.kpi_config;
    
    -- Calculate KPIs
    SELECT * INTO v_retention FROM calculate_retention(p_trainer_id, v_reference_month);
    v_referrals_validated := calculate_referrals(p_trainer_id, v_reference_month);
    SELECT * INTO v_management FROM calculate_management(p_trainer_id, v_reference_month);
    
    students_start := v_retention.students_start;
    students_end := v_retention.students_end;
    cancellations := v_retention.cancellations;
    retention_rate := v_retention.retention_rate;
    retention_target := COALESCE((v_config->'retention'->>'target')::DECIMAL, 90);
    retention_eligible := v_retention.retention_eligible;
    retention_achieved := retention_eligible AND retention_rate >= retention_target;
    
    referrals_count := v_referrals_validated;
    referrals_target := COALESCE((v_config->'referrals'->>'target')::INTEGER, 1);
    referrals_achieved := referrals_count >= referrals_target;
    
    -- Count pending referrals
    SELECT COUNT(*)::INTEGER INTO referrals_pending
    FROM students s
    WHERE s.referred_by_trainer_id = p_trainer_id
      AND s.is_archived = FALSE
      AND s.origin = 'referral'
      AND s.referral_validated_at IS NULL
      AND s.status = 'active';
    
    portfolio_size := v_management.portfolio_size;
    managed_count := v_management.managed_count;
    management_rate := v_management.management_rate;
    management_target := COALESCE((v_config->'management'->>'target')::DECIMAL, 75);
    management_achieved := management_rate >= management_target;
    
    -- Calculate reward
    reward_amount := calculate_reward(retention_achieved, referrals_achieved, management_achieved, v_rule.id);
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;
