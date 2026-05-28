-- =====================================================
-- Migration 027: RLS tightening (boas práticas)
-- Migra todas as policies de role `public` (inclui `anon`) para `authenticated`.
-- Efeitos:
--   - Remove leitura anônima de game_rules, protocol_metrics,
--     assessment_protocols e test_types (config/catálogo de negócio).
--   - Alinha todas as tabelas ao padrão já usado nas tabelas da Fase 1.
-- NÃO altera USING/WITH CHECK: apenas o conjunto de roles da policy.
-- Catálogo (assessment_protocols/protocol_metrics) permanece editável por
-- treinadores — comportamento intencional, mantido.
--
-- Observação: a página pública de agenda (/agenda/[token]) lê via service role
-- (createAdminClient), que bypassa RLS — portanto não é afetada por estas mudanças.
-- =====================================================

-- assessment_attachments
ALTER POLICY "Trainers can delete own student attachments" ON assessment_attachments TO authenticated;
ALTER POLICY "Trainers can insert attachments for own students" ON assessment_attachments TO authenticated;
ALTER POLICY "Managers can view all attachments" ON assessment_attachments TO authenticated;
ALTER POLICY "Trainers can view own student attachments" ON assessment_attachments TO authenticated;

-- assessment_protocols
ALTER POLICY "Managers manage protocols" ON assessment_protocols TO authenticated;
ALTER POLICY "Trainers manage protocols" ON assessment_protocols TO authenticated;
ALTER POLICY "Everyone view active protocols" ON assessment_protocols TO authenticated;

-- assessment_results
ALTER POLICY "Managers manage result values" ON assessment_results TO authenticated;
ALTER POLICY "Trainers delete own result values" ON assessment_results TO authenticated;
ALTER POLICY "Trainers insert own result values" ON assessment_results TO authenticated;
ALTER POLICY "Managers view all result values" ON assessment_results TO authenticated;
ALTER POLICY "Trainers view own result values" ON assessment_results TO authenticated;
ALTER POLICY "Trainers update own result values" ON assessment_results TO authenticated;

-- attendance_public_links
ALTER POLICY "Managers manage attendance public links" ON attendance_public_links TO authenticated;

-- attendance_records
ALTER POLICY "Managers manage attendance records" ON attendance_records TO authenticated;
ALTER POLICY "Trainers manage own attendance records" ON attendance_records TO authenticated;

-- game_rules
ALTER POLICY "Managers can delete game rules" ON game_rules TO authenticated;
ALTER POLICY "Managers can create game rules" ON game_rules TO authenticated;
ALTER POLICY "Everyone can view game rules" ON game_rules TO authenticated;
ALTER POLICY "Managers can update game rules" ON game_rules TO authenticated;

-- performance_snapshots
ALTER POLICY "Managers have full access to snapshots" ON performance_snapshots TO authenticated;
ALTER POLICY "Trainers can view own snapshots" ON performance_snapshots TO authenticated;

-- profiles
ALTER POLICY "Managers can create profiles" ON profiles TO authenticated;
ALTER POLICY "Managers can view all profiles" ON profiles TO authenticated;
ALTER POLICY "Users can view own profile" ON profiles TO authenticated;
ALTER POLICY "Users can update own profile" ON profiles TO authenticated;

-- protocol_metrics
ALTER POLICY "Managers manage metrics" ON protocol_metrics TO authenticated;
ALTER POLICY "Trainers manage metrics" ON protocol_metrics TO authenticated;
ALTER POLICY "Everyone view metrics" ON protocol_metrics TO authenticated;

-- schedule_base_entries
ALTER POLICY "Managers manage schedule base entries" ON schedule_base_entries TO authenticated;
ALTER POLICY "Trainers manage own schedule base entries" ON schedule_base_entries TO authenticated;

-- schedule_base_slots
ALTER POLICY "Managers manage schedule base slots" ON schedule_base_slots TO authenticated;
ALTER POLICY "Trainers manage own schedule base slots" ON schedule_base_slots TO authenticated;

-- schedule_week_entries
ALTER POLICY "Managers manage schedule week entries" ON schedule_week_entries TO authenticated;
ALTER POLICY "Trainers manage own schedule week entries" ON schedule_week_entries TO authenticated;

-- schedule_week_slots
ALTER POLICY "Managers manage schedule week slots" ON schedule_week_slots TO authenticated;
ALTER POLICY "Trainers manage own schedule week slots" ON schedule_week_slots TO authenticated;

-- student_assessments
ALTER POLICY "Managers manage assessments" ON student_assessments TO authenticated;
ALTER POLICY "Trainers delete own student assessments" ON student_assessments TO authenticated;
ALTER POLICY "Trainers insert own student assessments" ON student_assessments TO authenticated;
ALTER POLICY "Managers view all assessments" ON student_assessments TO authenticated;
ALTER POLICY "Trainers view own student assessments" ON student_assessments TO authenticated;
ALTER POLICY "Trainers update own student assessments" ON student_assessments TO authenticated;

-- student_events
ALTER POLICY "Users can create events" ON student_events TO authenticated;
ALTER POLICY "Managers can view all events" ON student_events TO authenticated;
ALTER POLICY "Trainers can view own student events" ON student_events TO authenticated;

-- student_results
ALTER POLICY "Trainers insert own student results" ON student_results TO authenticated;
ALTER POLICY "Managers view all results" ON student_results TO authenticated;
ALTER POLICY "Trainers view own student results" ON student_results TO authenticated;

-- students
ALTER POLICY "Managers have full access to students" ON students TO authenticated;
ALTER POLICY "Trainers can create own students" ON students TO authenticated;
ALTER POLICY "Trainers can view own students" ON students TO authenticated;
ALTER POLICY "Trainers can update own students" ON students TO authenticated;

-- test_types
ALTER POLICY "Managers can delete test types" ON test_types TO authenticated;
ALTER POLICY "Managers can create test types" ON test_types TO authenticated;
ALTER POLICY "Everyone can view active test types" ON test_types TO authenticated;
ALTER POLICY "Managers can update test types" ON test_types TO authenticated;

-- trainer_activity_log
ALTER POLICY "Authenticated users can insert activity logs" ON trainer_activity_log TO authenticated;
ALTER POLICY "Managers can view all activity logs" ON trainer_activity_log TO authenticated;
ALTER POLICY "Trainers can view own activity logs" ON trainer_activity_log TO authenticated;

-- trainers
ALTER POLICY "Managers have full access to trainers" ON trainers TO authenticated;
ALTER POLICY "Trainers can view all trainers" ON trainers TO authenticated;

-- weekly_schedule_templates
ALTER POLICY "Managers manage weekly schedules" ON weekly_schedule_templates TO authenticated;
ALTER POLICY "Trainers manage own weekly schedules" ON weekly_schedule_templates TO authenticated;
