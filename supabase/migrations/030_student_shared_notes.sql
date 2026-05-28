-- ============================================
-- Migration 030: Notas compartilhadas do aluno
-- Mural visível a todos os profissionais que atendem o aluno.
-- attends_student() vem da migration 028.
-- ============================================

CREATE TABLE IF NOT EXISTS student_shared_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
    author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
        'general', 'goal', 'behavior', 'logistics', 'health'
    )),
    body TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_notes_student ON student_shared_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_shared_notes_pinned ON student_shared_notes(student_id, is_pinned);

CREATE TRIGGER set_shared_notes_updated_at
    BEFORE UPDATE ON student_shared_notes
    FOR EACH ROW EXECUTE FUNCTION update_professionals_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE student_shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_notes_manager_all ON student_shared_notes
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY shared_notes_attending_select ON student_shared_notes
    FOR SELECT TO authenticated
    USING (public.attends_student(student_id));

CREATE POLICY shared_notes_insert ON student_shared_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        public.attends_student(student_id)
        AND author_profile_id = auth.uid()
    );

CREATE POLICY shared_notes_update_author ON student_shared_notes
    FOR UPDATE TO authenticated
    USING (author_profile_id = auth.uid())
    WITH CHECK (author_profile_id = auth.uid());

CREATE POLICY shared_notes_delete_author ON student_shared_notes
    FOR DELETE TO authenticated
    USING (author_profile_id = auth.uid() OR public.is_manager());
