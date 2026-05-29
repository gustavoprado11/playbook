-- =====================================================
-- Migration 036: Status de atendimento do paciente (fisioterapia)
-- care_status: in_treatment | discharged (+ data da alta).
-- Coluna na relação aluno↔profissional; usada pela agenda/UI de fisio.
-- =====================================================

ALTER TABLE student_professionals
    ADD COLUMN IF NOT EXISTS care_status TEXT NOT NULL DEFAULT 'in_treatment'
    CHECK (care_status IN ('in_treatment', 'discharged'));

ALTER TABLE student_professionals
    ADD COLUMN IF NOT EXISTS discharged_at DATE;
