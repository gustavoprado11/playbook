-- =====================================================
-- Migration: 014_spreadsheet_attendance_agenda.sql
-- Description: Spreadsheet-style base schedule and weekly editable agenda
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'attendance_status'
    ) THEN
        CREATE TYPE attendance_status AS ENUM ('pending', 'present', 'absent');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS attendance_public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL DEFAULT 'Recepcao',
    access_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_base_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
    start_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 30),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT schedule_base_slots_unique UNIQUE (trainer_id, weekday, start_time)
);

CREATE TABLE IF NOT EXISTS schedule_base_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES schedule_base_slots(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_origin TEXT,
    position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0 AND position <= 30),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT schedule_base_entries_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    ),
    CONSTRAINT schedule_base_entries_unique UNIQUE (slot_id, position)
);

CREATE TABLE IF NOT EXISTS schedule_week_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_slot_id UUID REFERENCES schedule_base_slots(id) ON DELETE SET NULL,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
    start_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 30),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT schedule_week_slots_unique UNIQUE (trainer_id, week_start, weekday, start_time)
);

CREATE TABLE IF NOT EXISTS schedule_week_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_slot_id UUID NOT NULL REFERENCES schedule_week_slots(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_origin TEXT,
    position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0 AND position <= 30),
    status attendance_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    marked_by UUID REFERENCES profiles(id),
    marked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT schedule_week_entries_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    ),
    CONSTRAINT schedule_week_entries_unique UNIQUE (week_slot_id, position)
);

CREATE INDEX IF NOT EXISTS idx_schedule_base_slots_weekday
    ON schedule_base_slots(trainer_id, weekday, start_time)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_schedule_week_slots_week
    ON schedule_week_slots(week_start, trainer_id, weekday, start_time);

DROP TRIGGER IF EXISTS update_attendance_public_links_updated_at ON attendance_public_links;
CREATE TRIGGER update_attendance_public_links_updated_at
    BEFORE UPDATE ON attendance_public_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_base_slots_updated_at ON schedule_base_slots;
CREATE TRIGGER update_schedule_base_slots_updated_at
    BEFORE UPDATE ON schedule_base_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_base_entries_updated_at ON schedule_base_entries;
CREATE TRIGGER update_schedule_base_entries_updated_at
    BEFORE UPDATE ON schedule_base_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_week_slots_updated_at ON schedule_week_slots;
CREATE TRIGGER update_schedule_week_slots_updated_at
    BEFORE UPDATE ON schedule_week_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_week_entries_updated_at ON schedule_week_entries;
CREATE TRIGGER update_schedule_week_entries_updated_at
    BEFORE UPDATE ON schedule_week_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE attendance_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_base_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_week_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_week_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers manage attendance public links" ON attendance_public_links;
CREATE POLICY "Managers manage attendance public links" ON attendance_public_links
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Managers manage schedule base slots" ON schedule_base_slots;
CREATE POLICY "Managers manage schedule base slots" ON schedule_base_slots
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Trainers manage own schedule base slots" ON schedule_base_slots;
CREATE POLICY "Trainers manage own schedule base slots" ON schedule_base_slots
    FOR ALL
    USING (trainer_id = public.get_trainer_id())
    WITH CHECK (trainer_id = public.get_trainer_id());

DROP POLICY IF EXISTS "Managers manage schedule base entries" ON schedule_base_entries;
CREATE POLICY "Managers manage schedule base entries" ON schedule_base_entries
    FOR ALL
    USING (
        slot_id IN (SELECT id FROM schedule_base_slots WHERE public.is_manager())
    )
    WITH CHECK (
        slot_id IN (SELECT id FROM schedule_base_slots WHERE public.is_manager())
    );

DROP POLICY IF EXISTS "Trainers manage own schedule base entries" ON schedule_base_entries;
CREATE POLICY "Trainers manage own schedule base entries" ON schedule_base_entries
    FOR ALL
    USING (
        slot_id IN (
            SELECT id FROM schedule_base_slots
            WHERE trainer_id = public.get_trainer_id()
        )
    )
    WITH CHECK (
        slot_id IN (
            SELECT id FROM schedule_base_slots
            WHERE trainer_id = public.get_trainer_id()
        )
    );

DROP POLICY IF EXISTS "Managers manage schedule week slots" ON schedule_week_slots;
CREATE POLICY "Managers manage schedule week slots" ON schedule_week_slots
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "Trainers manage own schedule week slots" ON schedule_week_slots;
CREATE POLICY "Trainers manage own schedule week slots" ON schedule_week_slots
    FOR ALL
    USING (trainer_id = public.get_trainer_id())
    WITH CHECK (trainer_id = public.get_trainer_id());

DROP POLICY IF EXISTS "Managers manage schedule week entries" ON schedule_week_entries;
CREATE POLICY "Managers manage schedule week entries" ON schedule_week_entries
    FOR ALL
    USING (
        week_slot_id IN (SELECT id FROM schedule_week_slots WHERE public.is_manager())
    )
    WITH CHECK (
        week_slot_id IN (SELECT id FROM schedule_week_slots WHERE public.is_manager())
    );

DROP POLICY IF EXISTS "Trainers manage own schedule week entries" ON schedule_week_entries;
CREATE POLICY "Trainers manage own schedule week entries" ON schedule_week_entries
    FOR ALL
    USING (
        week_slot_id IN (
            SELECT id FROM schedule_week_slots
            WHERE trainer_id = public.get_trainer_id()
        )
    )
    WITH CHECK (
        week_slot_id IN (
            SELECT id FROM schedule_week_slots
            WHERE trainer_id = public.get_trainer_id()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_public_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_base_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_base_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_week_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_week_entries TO authenticated;
