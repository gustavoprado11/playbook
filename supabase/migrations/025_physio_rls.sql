-- Habilitar RLS
ALTER TABLE physio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_session_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE physio_attachments ENABLE ROW LEVEL SECURITY;

-- === PHYSIO_SESSIONS ===
CREATE POLICY physio_sessions_manager_all ON physio_sessions
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_sessions_own_all ON physio_sessions
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === PHYSIO_ANAMNESIS ===
CREATE POLICY physio_anamnesis_manager_all ON physio_anamnesis
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_anamnesis_own_all ON physio_anamnesis
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_METRICS ===
CREATE POLICY physio_metrics_manager_all ON physio_metrics
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_metrics_own_all ON physio_metrics
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_TREATMENT_PLANS ===
CREATE POLICY physio_treatment_plans_manager_all ON physio_treatment_plans
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_treatment_plans_own_all ON physio_treatment_plans
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === PHYSIO_SESSION_EVOLUTION ===
CREATE POLICY physio_evolution_manager_all ON physio_session_evolution
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_evolution_own_all ON physio_session_evolution
    FOR ALL TO authenticated
    USING (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (session_id IN (
        SELECT id FROM physio_sessions
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === PHYSIO_ATTACHMENTS ===
CREATE POLICY physio_attachments_manager_all ON physio_attachments
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY physio_attachments_own_all ON physio_attachments
    FOR ALL TO authenticated
    USING (
        (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR
        (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    )
    WITH CHECK (
        (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR
        (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    );
