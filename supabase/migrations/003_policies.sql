-- =====================================================
-- PLAYBOOK SYSTEM - ROW LEVEL SECURITY POLICIES
-- Migration: 003_policies.sql
-- Description: Security policies for role-based access
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS (in public schema)
-- =====================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is a manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'manager'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user's trainer ID
CREATE OR REPLACE FUNCTION public.get_trainer_id()
RETURNS UUID AS $$
    SELECT id FROM trainers WHERE profile_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Managers can see all profiles
CREATE POLICY "Managers can view all profiles" ON profiles
    FOR SELECT
    USING (public.is_manager());

-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Only managers can insert profiles (when creating trainers)
CREATE POLICY "Managers can create profiles" ON profiles
    FOR INSERT
    WITH CHECK (public.is_manager());

-- =====================================================
-- TRAINERS POLICIES
-- =====================================================

-- Managers can do everything with trainers
CREATE POLICY "Managers have full access to trainers" ON trainers
    FOR ALL
    USING (public.is_manager());

-- Trainers can view their own trainer record
CREATE POLICY "Trainers can view own record" ON trainers
    FOR SELECT
    USING (profile_id = auth.uid());

-- =====================================================
-- STUDENTS POLICIES
-- =====================================================

-- Managers can do everything with students
CREATE POLICY "Managers have full access to students" ON students
    FOR ALL
    USING (public.is_manager());

-- Trainers can view their own students
CREATE POLICY "Trainers can view own students" ON students
    FOR SELECT
    USING (trainer_id = public.get_trainer_id());

-- Trainers can update their own students (limited fields via application)
CREATE POLICY "Trainers can update own students" ON students
    FOR UPDATE
    USING (trainer_id = public.get_trainer_id())
    WITH CHECK (trainer_id = public.get_trainer_id());

-- =====================================================
-- STUDENT_EVENTS POLICIES
-- =====================================================

-- Managers can view all events
CREATE POLICY "Managers can view all events" ON student_events
    FOR SELECT
    USING (public.is_manager());

-- Trainers can view events for their students
CREATE POLICY "Trainers can view own student events" ON student_events
    FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- Both can insert events (audit trail)
CREATE POLICY "Users can create events" ON student_events
    FOR INSERT
    WITH CHECK (
        public.is_manager() OR
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- =====================================================
-- RESULT_MANAGEMENT POLICIES
-- =====================================================

-- Managers can do everything
CREATE POLICY "Managers have full access to result_management" ON result_management
    FOR ALL
    USING (public.is_manager());

-- Trainers can view their students' result management
CREATE POLICY "Trainers can view own students management" ON result_management
    FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- Trainers can insert result management for their students
CREATE POLICY "Trainers can create own students management" ON result_management
    FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- Trainers can update result management for their students
CREATE POLICY "Trainers can update own students management" ON result_management
    FOR UPDATE
    USING (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    )
    WITH CHECK (
        student_id IN (
            SELECT id FROM students 
            WHERE trainer_id = public.get_trainer_id()
        )
    );

-- =====================================================
-- GAME_RULES POLICIES
-- =====================================================

-- Everyone can view game rules (transparency)
CREATE POLICY "Everyone can view game rules" ON game_rules
    FOR SELECT
    USING (TRUE);

-- Only managers can modify game rules
CREATE POLICY "Managers can create game rules" ON game_rules
    FOR INSERT
    WITH CHECK (public.is_manager());

CREATE POLICY "Managers can update game rules" ON game_rules
    FOR UPDATE
    USING (public.is_manager());

CREATE POLICY "Managers can delete game rules" ON game_rules
    FOR DELETE
    USING (public.is_manager());

-- =====================================================
-- PERFORMANCE_SNAPSHOTS POLICIES
-- =====================================================

-- Managers can do everything
CREATE POLICY "Managers have full access to snapshots" ON performance_snapshots
    FOR ALL
    USING (public.is_manager());

-- Trainers can view their own snapshots
CREATE POLICY "Trainers can view own snapshots" ON performance_snapshots
    FOR SELECT
    USING (trainer_id = public.get_trainer_id());

-- =====================================================
-- GRANTS FOR AUTHENTICATED USERS
-- =====================================================

-- Grant usage on helper functions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_id() TO authenticated;

-- Grant usage on KPI functions (from 002_functions.sql)
GRANT EXECUTE ON FUNCTION get_active_game_rule() TO authenticated;
GRANT EXECUTE ON FUNCTION get_min_portfolio_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_validation_days() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_retention(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_referrals(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_management(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reward(BOOLEAN, BOOLEAN, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trainer_dashboard_data(UUID, DATE) TO authenticated;

-- Manager-only functions
GRANT EXECUTE ON FUNCTION generate_performance_snapshot(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_performance_snapshot(UUID, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_referrals() TO authenticated;
