-- ============================================
-- Migration 021: RLS para professionals e student_professionals
-- ============================================

-- Habilitar RLS
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_professionals ENABLE ROW LEVEL SECURITY;

-- PROFESSIONALS: Manager vê todos; profissional vê apenas o próprio
CREATE POLICY professionals_manager_all ON professionals
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY professionals_own_select ON professionals
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- STUDENT_PROFESSIONALS: Manager vê todos; profissional vê apenas seus vínculos
CREATE POLICY student_professionals_manager_all ON student_professionals
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY student_professionals_own_select ON student_professionals
    FOR SELECT TO authenticated
    USING (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY student_professionals_own_insert ON student_professionals
    FOR INSERT TO authenticated
    WITH CHECK (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY student_professionals_own_update ON student_professionals
    FOR UPDATE TO authenticated
    USING (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        professional_id IN (
            SELECT id FROM professionals WHERE profile_id = auth.uid()
        )
    );
