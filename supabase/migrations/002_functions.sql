-- =====================================================
-- PLAYBOOK SYSTEM - KPI CALCULATION FUNCTIONS
-- Migration: 002_functions.sql
-- Description: Functions for calculating KPIs and rewards
-- =====================================================

-- =====================================================
-- FUNCTION: get_active_game_rule
-- Returns the currently active game rule
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_game_rule()
RETURNS game_rules AS $$
DECLARE
    v_rule game_rules;
BEGIN
    SELECT * INTO v_rule
    FROM game_rules
    WHERE is_active = TRUE
      AND effective_from <= CURRENT_DATE
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1;
    
    RETURN v_rule;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: get_min_portfolio_size
-- Returns the minimum portfolio size from active rule
-- =====================================================

CREATE OR REPLACE FUNCTION get_min_portfolio_size()
RETURNS INTEGER AS $$
DECLARE
    v_rule game_rules;
BEGIN
    v_rule := get_active_game_rule();
    
    IF v_rule IS NULL THEN
        RETURN 5; -- Default fallback
    END IF;
    
    RETURN COALESCE((v_rule.kpi_config->>'min_portfolio_size')::INTEGER, 5);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: get_referral_validation_days
-- Returns the referral validation period from active rule
-- =====================================================

CREATE OR REPLACE FUNCTION get_referral_validation_days()
RETURNS INTEGER AS $$
DECLARE
    v_rule game_rules;
BEGIN
    v_rule := get_active_game_rule();
    
    IF v_rule IS NULL THEN
        RETURN 30; -- Default fallback
    END IF;
    
    RETURN COALESCE((v_rule.kpi_config->>'referral_validation_days')::INTEGER, 30);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: calculate_retention
-- Calculates KPI 01 for a trainer in a specific month
-- =====================================================

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
    -- A student was active at month start if:
    -- - Started before the month
    -- - And was not cancelled before the month started
    SELECT COUNT(*)::INTEGER INTO students_start
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.start_date < v_month_start
      AND (
          s.status != 'cancelled' 
          OR (s.status = 'cancelled' AND s.end_date >= v_month_start)
      );
    
    -- Count students active at end of month
    SELECT COUNT(*)::INTEGER INTO students_end
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.start_date <= v_month_end
      AND s.status = 'active';
    
    -- Count cancellations during the month
    SELECT COUNT(*)::INTEGER INTO cancellations
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'cancelled'
      AND s.end_date BETWEEN v_month_start AND v_month_end
      AND s.start_date < v_month_start; -- Only count students who existed before the month
    
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

-- =====================================================
-- FUNCTION: calculate_referrals
-- Calculates KPI 02 for a trainer in a specific month
-- Only counts validated referrals (30+ days active)
-- =====================================================

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
    
    -- Count referrals that:
    -- 1. Were referred by this trainer
    -- 2. Started in the reference month
    -- 3. Have been validated (stayed 30+ days)
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM students s
    WHERE s.referred_by_trainer_id = p_trainer_id
      AND s.origin = 'referral'
      AND s.start_date BETWEEN v_month_start AND v_month_end
      AND s.referral_validated_at IS NOT NULL;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: calculate_management
-- Calculates KPI 03 for a trainer in a specific month
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
BEGIN
    v_reference_month := DATE_TRUNC('month', p_reference_month)::DATE;
    
    -- Count active students in portfolio
    SELECT COUNT(*)::INTEGER INTO portfolio_size
    FROM students s
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active';
    
    -- Count fully managed students
    -- All 3 checkboxes must be TRUE
    SELECT COUNT(*)::INTEGER INTO managed_count
    FROM students s
    JOIN result_management rm ON rm.student_id = s.id
    WHERE s.trainer_id = p_trainer_id
      AND s.status = 'active'
      AND rm.reference_month = v_reference_month
      AND rm.has_initial_assessment = TRUE
      AND rm.has_reassessment = TRUE
      AND rm.has_documented_result = TRUE;
    
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
-- FUNCTION: calculate_reward
-- Calculates the reward amount based on KPIs achieved
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_reward(
    p_retention_achieved BOOLEAN,
    p_referrals_achieved BOOLEAN,
    p_management_achieved BOOLEAN,
    p_game_rule_id UUID DEFAULT NULL
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_rule game_rules;
    v_reward DECIMAL(10,2) := 0;
    v_config JSONB;
    v_total_weight INTEGER := 0;
BEGIN
    -- Get the rule to use
    IF p_game_rule_id IS NOT NULL THEN
        SELECT * INTO v_rule FROM game_rules WHERE id = p_game_rule_id;
    ELSE
        v_rule := get_active_game_rule();
    END IF;
    
    IF v_rule IS NULL THEN
        RETURN 0;
    END IF;
    
    v_config := v_rule.kpi_config;
    
    IF v_rule.calculation_type = 'fixed' THEN
        -- Fixed: sum of fixed values for achieved KPIs
        IF p_retention_achieved AND (v_config->'retention'->>'enabled')::BOOLEAN THEN
            v_reward := v_reward + COALESCE((v_config->'retention'->>'fixed_value')::DECIMAL, 0);
        END IF;
        
        IF p_referrals_achieved AND (v_config->'referrals'->>'enabled')::BOOLEAN THEN
            v_reward := v_reward + COALESCE((v_config->'referrals'->>'fixed_value')::DECIMAL, 0);
        END IF;
        
        IF p_management_achieved AND (v_config->'management'->>'enabled')::BOOLEAN THEN
            v_reward := v_reward + COALESCE((v_config->'management'->>'fixed_value')::DECIMAL, 0);
        END IF;
    ELSE
        -- Weighted: percentage of base amount
        IF p_retention_achieved AND (v_config->'retention'->>'enabled')::BOOLEAN THEN
            v_total_weight := v_total_weight + COALESCE((v_config->'retention'->>'weight')::INTEGER, 0);
        END IF;
        
        IF p_referrals_achieved AND (v_config->'referrals'->>'enabled')::BOOLEAN THEN
            v_total_weight := v_total_weight + COALESCE((v_config->'referrals'->>'weight')::INTEGER, 0);
        END IF;
        
        IF p_management_achieved AND (v_config->'management'->>'enabled')::BOOLEAN THEN
            v_total_weight := v_total_weight + COALESCE((v_config->'management'->>'weight')::INTEGER, 0);
        END IF;
        
        v_reward := ROUND(v_rule.base_reward_amount * (v_total_weight::DECIMAL / 100), 2);
    END IF;
    
    RETURN v_reward;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCTION: generate_performance_snapshot
-- Creates or updates a performance snapshot for a trainer/month
-- =====================================================

CREATE OR REPLACE FUNCTION generate_performance_snapshot(
    p_trainer_id UUID,
    p_reference_month DATE
) RETURNS UUID AS $$
DECLARE
    v_reference_month DATE;
    v_rule game_rules;
    v_config JSONB;
    v_retention RECORD;
    v_referrals INTEGER;
    v_management RECORD;
    v_retention_achieved BOOLEAN;
    v_referrals_achieved BOOLEAN;
    v_management_achieved BOOLEAN;
    v_reward DECIMAL(10,2);
    v_snapshot_id UUID;
BEGIN
    v_reference_month := DATE_TRUNC('month', p_reference_month)::DATE;
    
    -- Check if snapshot exists and is finalized
    SELECT id INTO v_snapshot_id
    FROM performance_snapshots
    WHERE trainer_id = p_trainer_id
      AND reference_month = v_reference_month
      AND is_finalized = TRUE;
    
    IF v_snapshot_id IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot regenerate a finalized snapshot';
    END IF;
    
    -- Get active rule
    v_rule := get_active_game_rule();
    IF v_rule IS NULL THEN
        RAISE EXCEPTION 'No active game rule found';
    END IF;
    
    v_config := v_rule.kpi_config;
    
    -- Calculate KPIs
    SELECT * INTO v_retention FROM calculate_retention(p_trainer_id, v_reference_month);
    v_referrals := calculate_referrals(p_trainer_id, v_reference_month);
    SELECT * INTO v_management FROM calculate_management(p_trainer_id, v_reference_month);
    
    -- Determine achievements
    v_retention_achieved := v_retention.retention_eligible 
        AND v_retention.retention_rate >= COALESCE((v_config->'retention'->>'target')::DECIMAL, 90);
    
    v_referrals_achieved := v_referrals >= COALESCE((v_config->'referrals'->>'target')::INTEGER, 1);
    
    v_management_achieved := v_management.management_rate >= COALESCE((v_config->'management'->>'target')::DECIMAL, 75);
    
    -- Calculate reward
    v_reward := calculate_reward(v_retention_achieved, v_referrals_achieved, v_management_achieved, v_rule.id);
    
    -- Upsert snapshot
    INSERT INTO performance_snapshots (
        trainer_id,
        reference_month,
        students_start,
        students_end,
        cancellations,
        retention_rate,
        retention_target,
        retention_eligible,
        referrals_count,
        referrals_target,
        portfolio_size,
        managed_count,
        management_rate,
        management_target,
        game_rule_id,
        reward_amount
    ) VALUES (
        p_trainer_id,
        v_reference_month,
        v_retention.students_start,
        v_retention.students_end,
        v_retention.cancellations,
        v_retention.retention_rate,
        COALESCE((v_config->'retention'->>'target')::DECIMAL, 90),
        v_retention.retention_eligible,
        v_referrals,
        COALESCE((v_config->'referrals'->>'target')::INTEGER, 1),
        v_management.portfolio_size,
        v_management.managed_count,
        v_management.management_rate,
        COALESCE((v_config->'management'->>'target')::DECIMAL, 75),
        v_rule.id,
        v_reward
    )
    ON CONFLICT (trainer_id, reference_month) DO UPDATE SET
        students_start = EXCLUDED.students_start,
        students_end = EXCLUDED.students_end,
        cancellations = EXCLUDED.cancellations,
        retention_rate = EXCLUDED.retention_rate,
        retention_target = EXCLUDED.retention_target,
        retention_eligible = EXCLUDED.retention_eligible,
        referrals_count = EXCLUDED.referrals_count,
        referrals_target = EXCLUDED.referrals_target,
        portfolio_size = EXCLUDED.portfolio_size,
        managed_count = EXCLUDED.managed_count,
        management_rate = EXCLUDED.management_rate,
        management_target = EXCLUDED.management_target,
        game_rule_id = EXCLUDED.game_rule_id,
        reward_amount = EXCLUDED.reward_amount
    RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: finalize_performance_snapshot
-- Locks a snapshot, preventing further modifications
-- =====================================================

CREATE OR REPLACE FUNCTION finalize_performance_snapshot(
    p_trainer_id UUID,
    p_reference_month DATE,
    p_finalized_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_reference_month DATE;
    v_updated INTEGER;
BEGIN
    v_reference_month := DATE_TRUNC('month', p_reference_month)::DATE;
    
    -- First regenerate to ensure latest data
    PERFORM generate_performance_snapshot(p_trainer_id, v_reference_month);
    
    -- Then finalize
    UPDATE performance_snapshots
    SET is_finalized = TRUE,
        finalized_at = NOW(),
        finalized_by = p_finalized_by
    WHERE trainer_id = p_trainer_id
      AND reference_month = v_reference_month
      AND is_finalized = FALSE;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: validate_referrals
-- Validates referrals that have been active for 30+ days
-- Should be called daily via CRON
-- =====================================================

CREATE OR REPLACE FUNCTION validate_referrals()
RETURNS INTEGER AS $$
DECLARE
    v_validation_days INTEGER;
    v_updated INTEGER;
BEGIN
    v_validation_days := get_referral_validation_days();
    
    UPDATE students
    SET referral_validated_at = CURRENT_DATE
    WHERE origin = 'referral'
      AND referral_validated_at IS NULL
      AND status = 'active'
      AND start_date <= (CURRENT_DATE - v_validation_days);
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: get_trainer_dashboard_data
-- Returns all dashboard data for a trainer
-- =====================================================

CREATE OR REPLACE FUNCTION get_trainer_dashboard_data(
    p_trainer_id UUID,
    p_reference_month DATE DEFAULT NULL
) RETURNS TABLE (
    reference_month DATE,
    -- Retention
    students_start INTEGER,
    students_end INTEGER,
    cancellations INTEGER,
    retention_rate DECIMAL(5,2),
    retention_target DECIMAL(5,2),
    retention_eligible BOOLEAN,
    retention_achieved BOOLEAN,
    -- Referrals
    referrals_count INTEGER,
    referrals_target INTEGER,
    referrals_achieved BOOLEAN,
    referrals_pending INTEGER,
    -- Management
    portfolio_size INTEGER,
    managed_count INTEGER,
    management_rate DECIMAL(5,2),
    management_target DECIMAL(5,2),
    management_achieved BOOLEAN,
    -- Reward
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
           0, -- pending calculated below
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
        -- Calculate pending referrals even for finalized snapshots
        SELECT COUNT(*)::INTEGER INTO referrals_pending
        FROM students s
        WHERE s.referred_by_trainer_id = p_trainer_id
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
