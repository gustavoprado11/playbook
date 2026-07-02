-- ============================================
-- 049 — Log de execução (A4) — coach-facing
-- ============================================
-- Registro IMUTÁVEL do que o aluno de fato fez numa sessão. Snapshota o prescrito
-- (exercise_name + planned_*) + os valores reais (*_done, rpe, completed). Editar a
-- prescrição (A3) depois NÃO altera logs passados. assigned_*_id = FK nullable
-- ON DELETE SET NULL (só rastreio). Sem FK composto de fase (phase é só rótulo).

CREATE TABLE IF NOT EXISTS workout_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assigned_program_id UUID REFERENCES assigned_programs(id) ON DELETE SET NULL,  -- rastreio
    assigned_session_id UUID REFERENCES assigned_sessions(id) ON DELETE SET NULL,  -- rastreio
    session_name        TEXT,                          -- snapshot
    performed_at        DATE NOT NULL DEFAULT CURRENT_DATE,
    overall_rpe         NUMERIC(3,1),
    notes               TEXT,
    logged_by           UUID REFERENCES profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_student   ON workout_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_performed ON workout_logs(performed_at DESC);

DROP TRIGGER IF EXISTS set_workout_logs_updated_at ON workout_logs;
CREATE TRIGGER set_workout_logs_updated_at BEFORE UPDATE ON workout_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS set_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id   UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    assigned_set_id  UUID REFERENCES assigned_sets(id) ON DELETE SET NULL,  -- rastreio
    -- snapshot do prescrito
    exercise_name    TEXT NOT NULL,
    group_label      TEXT,
    phase            TEXT,
    category_key     TEXT,
    set_number       INTEGER,
    planned_reps     INTEGER,
    planned_reps_max INTEGER,
    planned_load_kg  NUMERIC(6,2),
    planned_duration_seconds INTEGER,
    planned_distance_m       INTEGER,
    planned_target_zone      TEXT,
    -- valores reais
    reps_done            INTEGER,
    load_kg_done         NUMERIC(6,2),
    duration_done_seconds INTEGER,
    distance_done_m      INTEGER,
    rpe                  NUMERIC(3,1),
    completed            BOOLEAN NOT NULL DEFAULT FALSE,
    notes                TEXT,
    order_index          INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_set_logs_log ON set_logs(workout_log_id);
