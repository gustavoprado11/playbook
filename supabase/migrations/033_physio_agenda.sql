-- =====================================================
-- Migration 033: Agenda de fisioterapia (modelo spreadsheet paralelo)
-- Espelha a estrutura de 014 (schedule_*), mas keyed por professional_id
-- (fisioterapeuta). Não toca nas tabelas da agenda de treino.
-- =====================================================

-- Discriminador no link público de recepção (aditivo, default mantém treino)
ALTER TABLE attendance_public_links
    ADD COLUMN IF NOT EXISTS agenda TEXT NOT NULL DEFAULT 'training'
    CHECK (agenda IN ('training', 'physiotherapy'));

-- ===== BASE (template recorrente) =====
CREATE TABLE IF NOT EXISTS physio_schedule_base_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
    start_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 30),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT physio_base_slots_unique UNIQUE (professional_id, weekday, start_time)
);

CREATE TABLE IF NOT EXISTS physio_schedule_base_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES physio_schedule_base_slots(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    guest_name TEXT,
    guest_origin TEXT,
    position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0 AND position <= 30),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT physio_base_entries_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    ),
    CONSTRAINT physio_base_entries_unique UNIQUE (slot_id, position)
);

-- ===== SEMANA (materializada/editável) =====
CREATE TABLE IF NOT EXISTS physio_schedule_week_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_slot_id UUID REFERENCES physio_schedule_base_slots(id) ON DELETE SET NULL,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
    start_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 30),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT physio_week_slots_unique UNIQUE (professional_id, week_start, weekday, start_time)
);

CREATE TABLE IF NOT EXISTS physio_schedule_week_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_slot_id UUID NOT NULL REFERENCES physio_schedule_week_slots(id) ON DELETE CASCADE,
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
    CONSTRAINT physio_week_entries_participant_check CHECK (
        (student_id IS NOT NULL AND guest_name IS NULL) OR
        (student_id IS NULL AND guest_name IS NOT NULL)
    ),
    CONSTRAINT physio_week_entries_unique UNIQUE (week_slot_id, position)
);

CREATE INDEX IF NOT EXISTS idx_physio_base_slots_weekday
    ON physio_schedule_base_slots(professional_id, weekday, start_time) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_physio_week_slots_week
    ON physio_schedule_week_slots(week_start, professional_id, weekday, start_time);
CREATE INDEX IF NOT EXISTS idx_physio_base_entries_slot ON physio_schedule_base_entries(slot_id);
CREATE INDEX IF NOT EXISTS idx_physio_week_entries_slot ON physio_schedule_week_entries(week_slot_id);

-- ===== updated_at triggers =====
CREATE TRIGGER update_physio_base_slots_updated_at BEFORE UPDATE ON physio_schedule_base_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_physio_base_entries_updated_at BEFORE UPDATE ON physio_schedule_base_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_physio_week_slots_updated_at BEFORE UPDATE ON physio_schedule_week_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_physio_week_entries_updated_at BEFORE UPDATE ON physio_schedule_week_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== RLS =====
ALTER TABLE physio_schedule_base_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_schedule_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_schedule_week_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_schedule_week_entries ENABLE ROW LEVEL SECURITY;

-- base slots
CREATE POLICY physio_base_slots_manager_all ON physio_schedule_base_slots
    FOR ALL TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
CREATE POLICY physio_base_slots_own_all ON physio_schedule_base_slots
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- base entries (via slot ownership)
CREATE POLICY physio_base_entries_manager_all ON physio_schedule_base_entries
    FOR ALL TO authenticated
    USING (slot_id IN (SELECT id FROM physio_schedule_base_slots WHERE public.is_manager()))
    WITH CHECK (slot_id IN (SELECT id FROM physio_schedule_base_slots WHERE public.is_manager()));
CREATE POLICY physio_base_entries_own_all ON physio_schedule_base_entries
    FOR ALL TO authenticated
    USING (slot_id IN (SELECT id FROM physio_schedule_base_slots
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())))
    WITH CHECK (slot_id IN (SELECT id FROM physio_schedule_base_slots
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())));

-- week slots
CREATE POLICY physio_week_slots_manager_all ON physio_schedule_week_slots
    FOR ALL TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
CREATE POLICY physio_week_slots_own_all ON physio_schedule_week_slots
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- week entries (via slot ownership)
CREATE POLICY physio_week_entries_manager_all ON physio_schedule_week_entries
    FOR ALL TO authenticated
    USING (week_slot_id IN (SELECT id FROM physio_schedule_week_slots WHERE public.is_manager()))
    WITH CHECK (week_slot_id IN (SELECT id FROM physio_schedule_week_slots WHERE public.is_manager()));
CREATE POLICY physio_week_entries_own_all ON physio_schedule_week_entries
    FOR ALL TO authenticated
    USING (week_slot_id IN (SELECT id FROM physio_schedule_week_slots
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())))
    WITH CHECK (week_slot_id IN (SELECT id FROM physio_schedule_week_slots
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON physio_schedule_base_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON physio_schedule_base_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON physio_schedule_week_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON physio_schedule_week_entries TO authenticated;
