-- =====================================================
-- Migration 037: Evolução do paciente (fisioterapia)
-- Log cronológico em texto livre registrado pelo fisioterapeuta na ficha.
-- =====================================================

CREATE TABLE IF NOT EXISTS physio_evolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physio_evolutions_student ON physio_evolutions(student_id);
CREATE INDEX IF NOT EXISTS idx_physio_evolutions_professional ON physio_evolutions(professional_id);

CREATE TRIGGER update_physio_evolutions_updated_at
    BEFORE UPDATE ON physio_evolutions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE physio_evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_evolutions_manager_all ON physio_evolutions
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_evolutions_own_all ON physio_evolutions
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON physio_evolutions TO authenticated;
