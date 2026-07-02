-- ============================================
-- 047 — RLS da árvore atribuída (A3) — student-scoped
-- ============================================
-- Root em attends_student(student_id) + is_manager(); filhos resolvem subindo a
-- cadeia até assigned_programs. Espelha 043 (template) trocando o teste de posse
-- por attends_student. Idempotente (DROP POLICY IF EXISTS antes de CREATE).

ALTER TABLE assigned_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_blocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_sets     ENABLE ROW LEVEL SECURITY;

-- assigned_programs (root)
DROP POLICY IF EXISTS assigned_programs_all ON assigned_programs;
CREATE POLICY assigned_programs_all ON assigned_programs FOR ALL TO authenticated
    USING (public.is_manager() OR public.attends_student(student_id))
    WITH CHECK (public.is_manager() OR public.attends_student(student_id));

-- assigned_sessions → via assigned_programs
DROP POLICY IF EXISTS assigned_sessions_all ON assigned_sessions;
CREATE POLICY assigned_sessions_all ON assigned_sessions FOR ALL TO authenticated
    USING (public.is_manager() OR assigned_program_id IN
        (SELECT id FROM assigned_programs WHERE public.attends_student(student_id)))
    WITH CHECK (public.is_manager() OR assigned_program_id IN
        (SELECT id FROM assigned_programs WHERE public.attends_student(student_id)));

-- assigned_blocks → via sessions→programs
DROP POLICY IF EXISTS assigned_blocks_all ON assigned_blocks;
CREATE POLICY assigned_blocks_all ON assigned_blocks FOR ALL TO authenticated
    USING (public.is_manager() OR assigned_session_id IN
        (SELECT s.id FROM assigned_sessions s
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)))
    WITH CHECK (public.is_manager() OR assigned_session_id IN
        (SELECT s.id FROM assigned_sessions s
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)));

-- assigned_items → via blocks→sessions→programs
DROP POLICY IF EXISTS assigned_items_all ON assigned_items;
CREATE POLICY assigned_items_all ON assigned_items FOR ALL TO authenticated
    USING (public.is_manager() OR assigned_block_id IN
        (SELECT b.id FROM assigned_blocks b
         JOIN assigned_sessions s ON s.id = b.assigned_session_id
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)))
    WITH CHECK (public.is_manager() OR assigned_block_id IN
        (SELECT b.id FROM assigned_blocks b
         JOIN assigned_sessions s ON s.id = b.assigned_session_id
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)));

-- assigned_sets → via items→blocks→sessions→programs
DROP POLICY IF EXISTS assigned_sets_all ON assigned_sets;
CREATE POLICY assigned_sets_all ON assigned_sets FOR ALL TO authenticated
    USING (public.is_manager() OR assigned_item_id IN
        (SELECT i.id FROM assigned_items i
         JOIN assigned_blocks b ON b.id = i.assigned_block_id
         JOIN assigned_sessions s ON s.id = b.assigned_session_id
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)))
    WITH CHECK (public.is_manager() OR assigned_item_id IN
        (SELECT i.id FROM assigned_items i
         JOIN assigned_blocks b ON b.id = i.assigned_block_id
         JOIN assigned_sessions s ON s.id = b.assigned_session_id
         JOIN assigned_programs p ON p.id = s.assigned_program_id
         WHERE public.attends_student(p.student_id)));
