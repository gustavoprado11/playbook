-- =====================================================
-- Migration: 018_trainers_can_see_team.sql
-- Description: Allow trainers to see all other trainers (same team)
-- =====================================================

-- Replace restrictive policy with team-wide visibility
DROP POLICY IF EXISTS "Trainers can view own record" ON trainers;

CREATE POLICY "Trainers can view all trainers" ON trainers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'trainer'
        )
    );
