-- =====================================================
-- Migration: 016_trainer_transfer.sql
-- Description: Add student_transferred activity type
-- =====================================================

-- 1. Expand activity_type constraint
ALTER TABLE trainer_activity_log DROP CONSTRAINT IF EXISTS trainer_activity_log_activity_type_check;

ALTER TABLE trainer_activity_log ADD CONSTRAINT trainer_activity_log_activity_type_check
CHECK (activity_type IN (
    'login',
    'result_management',
    'student_status_update',
    'referral_registered',
    'student_registered',
    'schedule_update',
    'student_archived',
    'student_transferred'
));
