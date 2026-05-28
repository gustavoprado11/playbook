-- ============================================
-- Migration 029: Liberações e restrições clínicas
-- Fisioterapeuta comunica ao treino o que pode/não pode ser feito
-- attends_student() vem da migration 028.
-- ============================================

CREATE TABLE IF NOT EXISTS student_clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    issued_by_professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    clearance_level TEXT NOT NULL CHECK (clearance_level IN (
        'cleared', 'cleared_with_notes', 'restricted', 'contraindicated'
    )),
    body_region TEXT,
    affected_movements TEXT[],
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted', 'expired')),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    review_date DATE,
    lifted_at TIMESTAMPTZ,
    lifted_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearances_student ON student_clearances(student_id);
CREATE INDEX IF NOT EXISTS idx_clearances_status ON student_clearances(status);
CREATE INDEX IF NOT EXISTS idx_clearances_student_status ON student_clearances(student_id, status);

CREATE TRIGGER set_clearances_updated_at
    BEFORE UPDATE ON student_clearances
    FOR EACH ROW EXECUTE FUNCTION update_professionals_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE student_clearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY clearances_manager_all ON student_clearances
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY clearances_attending_select ON student_clearances
    FOR SELECT TO authenticated
    USING (public.attends_student(student_id));

CREATE POLICY clearances_insert ON student_clearances
    FOR INSERT TO authenticated
    WITH CHECK (
        issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        AND public.attends_student(student_id)
    );

CREATE POLICY clearances_update_owner ON student_clearances
    FOR UPDATE TO authenticated
    USING (issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (issued_by_professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));
