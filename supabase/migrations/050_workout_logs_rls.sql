-- ============================================
-- 050 — RLS do log de execução (A4) — student-scoped
-- ============================================
-- Espelha 047: root attends_student(student_id) + is_manager(); filho sobe a cadeia.

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_logs_all ON workout_logs;
CREATE POLICY workout_logs_all ON workout_logs FOR ALL TO authenticated
    USING (public.is_manager() OR public.attends_student(student_id))
    WITH CHECK (public.is_manager() OR public.attends_student(student_id));

DROP POLICY IF EXISTS set_logs_all ON set_logs;
CREATE POLICY set_logs_all ON set_logs FOR ALL TO authenticated
    USING (public.is_manager() OR workout_log_id IN
        (SELECT id FROM workout_logs WHERE public.attends_student(student_id)))
    WITH CHECK (public.is_manager() OR workout_log_id IN
        (SELECT id FROM workout_logs WHERE public.attends_student(student_id)));
