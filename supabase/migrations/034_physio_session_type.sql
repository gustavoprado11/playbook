-- =====================================================
-- Migration 034: Tipo de atendimento nas entries da agenda de fisioterapia
-- avaliacao | recovery | sessao (default sessao). Só nas tabelas de fisio.
-- =====================================================

ALTER TABLE physio_schedule_base_entries
    ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'sessao'
    CHECK (session_type IN ('avaliacao', 'recovery', 'sessao'));

ALTER TABLE physio_schedule_week_entries
    ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'sessao'
    CHECK (session_type IN ('avaliacao', 'recovery', 'sessao'));
