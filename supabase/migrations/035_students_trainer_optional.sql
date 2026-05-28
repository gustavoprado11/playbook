-- =====================================================
-- Migration 035: trainer_id opcional em students
-- Permite pacientes atendidos só por nutricionista/fisioterapeuta
-- (sem treinador). Alunos existentes mantêm o trainer_id.
-- =====================================================

ALTER TABLE students ALTER COLUMN trainer_id DROP NOT NULL;
