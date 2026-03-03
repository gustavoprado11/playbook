-- =====================================================
-- PLAYBOOK SYSTEM - TRAINER ACTIVITY PANEL
-- Migration: 010_trainer_activity_panel.sql
-- Description: Track trainer activity for manager oversight
-- =====================================================

-- =====================================================
-- 1. ACTIVITY LOG TABLE
-- =====================================================

CREATE TABLE trainer_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'login',
        'result_management',
        'student_status_update',
        'referral_registered'
    )),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Compound index for the view query (MAX per trainer per type)
CREATE INDEX idx_trainer_activity_trainer_type
    ON trainer_activity_log(trainer_id, activity_type, occurred_at DESC);

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE trainer_activity_log ENABLE ROW LEVEL SECURITY;

-- Managers can view all activity logs
CREATE POLICY "Managers can view all activity logs" ON trainer_activity_log
    FOR SELECT
    USING (public.is_manager());

-- Trainers can view their own activity logs
CREATE POLICY "Trainers can view own activity logs" ON trainer_activity_log
    FOR SELECT
    USING (trainer_id = public.get_trainer_id());

-- Authenticated users can insert activity logs
-- (triggers run SECURITY DEFINER; app-layer login insert runs as authenticated user)
CREATE POLICY "Authenticated users can insert activity logs" ON trainer_activity_log
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. TRIGGER FUNCTIONS (all SECURITY DEFINER)
-- =====================================================

-- 3.1 Log assessment creation → result_management activity
CREATE OR REPLACE FUNCTION log_result_management()
RETURNS TRIGGER AS $$
DECLARE
    v_trainer_id UUID;
BEGIN
    -- Resolve trainer_id from the student
    SELECT s.trainer_id INTO v_trainer_id
    FROM students s
    WHERE s.id = NEW.student_id
    AND s.trainer_id IS NOT NULL;

    IF v_trainer_id IS NOT NULL THEN
        INSERT INTO trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            v_trainer_id,
            'result_management',
            jsonb_build_object(
                'student_id', NEW.student_id,
                'assessment_id', NEW.id,
                'protocol_id', NEW.protocol_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_result_management
    AFTER INSERT ON student_assessments
    FOR EACH ROW EXECUTE FUNCTION log_result_management();

-- 3.2 Log student status change → student_status_update activity
CREATE OR REPLACE FUNCTION log_student_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            NEW.trainer_id,
            'student_status_update',
            jsonb_build_object(
                'student_id', NEW.id,
                'old_status', OLD.status::TEXT,
                'new_status', NEW.status::TEXT
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_student_status_update
    AFTER UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION log_student_status_update();

-- 3.3 Log referral registration → referral_registered activity
CREATE OR REPLACE FUNCTION log_referral_registered()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when origin is 'referral' and there is a referring trainer
    IF NEW.origin = 'referral' AND NEW.referred_by_trainer_id IS NOT NULL THEN
        INSERT INTO trainer_activity_log (trainer_id, activity_type, metadata)
        VALUES (
            NEW.referred_by_trainer_id,  -- The trainer who REFERRED, not the student's trainer
            'referral_registered',
            jsonb_build_object(
                'student_id', NEW.id,
                'student_name', NEW.full_name,
                'assigned_trainer_id', NEW.trainer_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_referral_registered
    AFTER INSERT ON students
    FOR EACH ROW EXECUTE FUNCTION log_referral_registered();

-- =====================================================
-- 4. VIEW: Aggregated trainer activity for the panel
-- =====================================================

CREATE OR REPLACE VIEW trainer_activity_summary AS
SELECT
    t.id AS trainer_id,
    p.full_name AS trainer_name,
    MAX(CASE WHEN tal.activity_type = 'login'
        THEN tal.occurred_at END) AS last_login,
    MAX(CASE WHEN tal.activity_type = 'result_management'
        THEN tal.occurred_at END) AS last_result_management,
    MAX(CASE WHEN tal.activity_type = 'student_status_update'
        THEN tal.occurred_at END) AS last_student_status_update,
    MAX(CASE WHEN tal.activity_type = 'referral_registered'
        THEN tal.occurred_at END) AS last_referral_registered
FROM trainers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN trainer_activity_log tal ON t.id = tal.trainer_id
WHERE t.is_active = TRUE
GROUP BY t.id, p.full_name;

-- =====================================================
-- 5. GRANTS
-- =====================================================

GRANT SELECT ON trainer_activity_summary TO authenticated;
GRANT SELECT, INSERT ON trainer_activity_log TO authenticated;
