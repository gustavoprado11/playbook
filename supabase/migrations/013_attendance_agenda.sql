-- =====================================================
-- Migration: 013_attendance_agenda.sql
-- Description: Weekly schedule templates, attendance tracking and public reception link
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'attendance_status'
    ) THEN
        CREATE TYPE attendance_status AS ENUM ('pending', 'present', 'absent');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS weekly_schedule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_origin TEXT,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
    start_time TIME NOT NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT weekly_schedule_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_trainer_weekday
    ON weekly_schedule_templates(trainer_id, weekday, start_time)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_student
    ON weekly_schedule_templates(student_id)
    WHERE is_active = TRUE AND student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_template_id UUID NOT NULL REFERENCES weekly_schedule_templates(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_origin TEXT,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    status attendance_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    marked_by UUID REFERENCES profiles(id),
    marked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT attendance_records_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    ),
    CONSTRAINT attendance_records_unique UNIQUE (schedule_template_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_date
    ON attendance_records(session_date, start_time);

CREATE INDEX IF NOT EXISTS idx_attendance_records_trainer_date
    ON attendance_records(trainer_id, session_date);

CREATE TABLE IF NOT EXISTS attendance_public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL DEFAULT 'Recepcao',
    access_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION sync_attendance_from_template()
RETURNS TRIGGER AS $$
BEGIN
    SELECT
        wst.student_id,
        wst.guest_name,
        wst.guest_origin,
        wst.trainer_id,
        wst.start_time
    INTO
        NEW.student_id,
        NEW.guest_name,
        NEW.guest_origin,
        NEW.trainer_id,
        NEW.start_time
    FROM weekly_schedule_templates wst
    WHERE wst.id = NEW.schedule_template_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_weekly_schedule_templates_updated_at ON weekly_schedule_templates;
CREATE TRIGGER update_weekly_schedule_templates_updated_at
    BEFORE UPDATE ON weekly_schedule_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_public_links_updated_at ON attendance_public_links;
CREATE TRIGGER update_attendance_public_links_updated_at
    BEFORE UPDATE ON attendance_public_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sync_attendance_from_template ON attendance_records;
CREATE TRIGGER trg_sync_attendance_from_template
    BEFORE INSERT OR UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION sync_attendance_from_template();

ALTER TABLE weekly_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_public_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage weekly schedules" ON weekly_schedule_templates;
CREATE POLICY "Managers manage weekly schedules" ON weekly_schedule_templates
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Trainers manage own weekly schedules" ON weekly_schedule_templates;
CREATE POLICY "Trainers manage own weekly schedules" ON weekly_schedule_templates
    FOR ALL
    USING (trainer_id = public.get_trainer_id())
    WITH CHECK (trainer_id = public.get_trainer_id());

DROP POLICY IF EXISTS "Managers manage attendance records" ON attendance_records;
CREATE POLICY "Managers manage attendance records" ON attendance_records
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Trainers manage own attendance records" ON attendance_records;
CREATE POLICY "Trainers manage own attendance records" ON attendance_records
    FOR ALL
    USING (trainer_id = public.get_trainer_id())
    WITH CHECK (trainer_id = public.get_trainer_id());

DROP POLICY IF EXISTS "Managers manage attendance public links" ON attendance_public_links;
CREATE POLICY "Managers manage attendance public links" ON attendance_public_links
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_schedule_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_public_links TO authenticated;
