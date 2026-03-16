-- =====================================================
-- Migration: 015_expand_activity_types.sql
-- Description: Add new activity types and update summary view
-- =====================================================

-- 1. Drop old constraint and add expanded one
ALTER TABLE trainer_activity_log DROP CONSTRAINT IF EXISTS trainer_activity_log_activity_type_check;

ALTER TABLE trainer_activity_log ADD CONSTRAINT trainer_activity_log_activity_type_check
CHECK (activity_type IN (
    'login',
    'result_management',
    'student_status_update',
    'referral_registered',
    'student_registered',
    'schedule_update',
    'student_archived'
));

-- 2. Update summary view to include new types
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
        THEN tal.occurred_at END) AS last_referral_registered,
    MAX(CASE WHEN tal.activity_type = 'student_registered'
        THEN tal.occurred_at END) AS last_student_registered,
    MAX(CASE WHEN tal.activity_type = 'schedule_update'
        THEN tal.occurred_at END) AS last_schedule_update,
    MAX(CASE WHEN tal.activity_type = 'student_archived'
        THEN tal.occurred_at END) AS last_student_archived
FROM trainers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN trainer_activity_log tal ON t.id = tal.trainer_id
WHERE t.is_active = TRUE
GROUP BY t.id, p.full_name;

GRANT SELECT ON trainer_activity_summary TO authenticated;
