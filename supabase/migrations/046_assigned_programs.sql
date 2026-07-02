-- ============================================
-- 046 — Árvore ATRIBUÍDA por aluno (A3)
-- ============================================
-- Instância por aluno: cópia CONGELADA de um program_template, customizável por
-- aluno sem afetar o template de origem. Espelha as tabelas *_template (042) com:
--   - assigned_programs.student_id (student-scoped; entra o attends_student na 047)
--   - source_template_id / exercise_id como FK NULLABLE ON DELETE SET NULL (só rastreio)
--   - assigned_items guarda SNAPSHOTS (cópias do exercício no momento da atribuição):
--     exercise_name/movement_pattern_key/primary_muscles/secondary_muscles/video_url/cues.
-- Aditivo, idempotente. SEM FK em tabelas clínicas.

CREATE TABLE IF NOT EXISTS assigned_programs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES program_templates(id) ON DELETE SET NULL, -- rastreio
    name               TEXT NOT NULL,
    description        TEXT,
    goal               TEXT,
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    assigned_by        UUID REFERENCES profiles(id),
    start_date         DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assigned_programs_student ON assigned_programs(student_id);
CREATE INDEX IF NOT EXISTS idx_assigned_programs_status  ON assigned_programs(status);

DROP TRIGGER IF EXISTS set_assigned_programs_updated_at ON assigned_programs;
CREATE TRIGGER set_assigned_programs_updated_at BEFORE UPDATE ON assigned_programs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS assigned_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_program_id UUID NOT NULL REFERENCES assigned_programs(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    order_index         INTEGER NOT NULL DEFAULT 0,
    scheduled_days      INTEGER[] NOT NULL DEFAULT '{}',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assigned_sessions_program ON assigned_sessions(assigned_program_id);

DROP TRIGGER IF EXISTS set_assigned_sessions_updated_at ON assigned_sessions;
CREATE TRIGGER set_assigned_sessions_updated_at BEFORE UPDATE ON assigned_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK COMPOSTO (phase,category_key) → block_categories (taxonomia estável, referenciável).
CREATE TABLE IF NOT EXISTS assigned_blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_session_id UUID NOT NULL REFERENCES assigned_sessions(id) ON DELETE CASCADE,
    phase               TEXT NOT NULL CHECK (phase IN
                          ('preparacao_movimento','potencia_forca','dse','regeneracao')),
    category_key        TEXT NOT NULL,
    order_index         INTEGER NOT NULL DEFAULT 0,
    label               TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assigned_blocks_category_in_phase
        FOREIGN KEY (phase, category_key)
        REFERENCES block_categories(phase, category_key)
);
CREATE INDEX IF NOT EXISTS idx_assigned_blocks_session ON assigned_blocks(assigned_session_id);

-- SNAPSHOTS: exercise_* são CÓPIAS (sem FK). exercise_id fica só p/ rastreio (SET NULL).
CREATE TABLE IF NOT EXISTS assigned_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_block_id    UUID NOT NULL REFERENCES assigned_blocks(id) ON DELETE CASCADE,
    exercise_id          UUID REFERENCES exercises(id) ON DELETE SET NULL, -- rastreio
    exercise_name        TEXT NOT NULL,                 -- snapshot
    movement_pattern_key TEXT,                          -- snapshot
    primary_muscles      TEXT[] NOT NULL DEFAULT '{}',  -- snapshot
    secondary_muscles    TEXT[] NOT NULL DEFAULT '{}',  -- snapshot
    video_url            TEXT,                          -- snapshot
    cues                 TEXT,                          -- snapshot
    custom_name          TEXT,
    group_label          TEXT,
    order_index          INTEGER NOT NULL DEFAULT 0,
    method_key           TEXT REFERENCES training_methods(method_key),
    rounds               INTEGER,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assigned_items_block    ON assigned_items(assigned_block_id);
CREATE INDEX IF NOT EXISTS idx_assigned_items_exercise ON assigned_items(exercise_id);

-- Série idêntica a set_templates (inclui load_pct_1rm / VBT nullable, ocultos na UI v1).
CREATE TABLE IF NOT EXISTS assigned_sets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_item_id UUID NOT NULL REFERENCES assigned_items(id) ON DELETE CASCADE,
    set_number       INTEGER NOT NULL DEFAULT 1,
    set_type         TEXT,
    reps             INTEGER,
    reps_max         INTEGER,
    each_side        BOOLEAN NOT NULL DEFAULT FALSE,
    load_kg          NUMERIC(6,2),
    load_pct_1rm     NUMERIC(5,2),
    rir              INTEGER,
    tempo            TEXT,
    rest_seconds     INTEGER,
    round_number     INTEGER,
    duration_seconds INTEGER,
    distance_m       INTEGER,
    target_zone      TEXT,
    target_velocity_ms NUMERIC(4,2),
    velocity_loss_pct  NUMERIC(5,2),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assigned_sets_item ON assigned_sets(assigned_item_id);
