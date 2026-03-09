-- =====================================================
-- Migration: 012_trainer_protocol_permissions.sql
-- Description: Allow trainers to manage assessment protocols and metrics
-- =====================================================

CREATE POLICY "Trainers manage protocols" ON assessment_protocols
    FOR ALL
    USING (public.get_user_role() = 'trainer')
    WITH CHECK (public.get_user_role() = 'trainer');

CREATE POLICY "Trainers manage metrics" ON protocol_metrics
    FOR ALL
    USING (public.get_user_role() = 'trainer')
    WITH CHECK (public.get_user_role() = 'trainer');
