-- Habilitar RLS em todas as tabelas de nutrição
ALTER TABLE nutrition_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_lab_results ENABLE ROW LEVEL SECURITY;

-- === NUTRITION_CONSULTATIONS ===
CREATE POLICY nutrition_consultations_manager_all ON nutrition_consultations
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_consultations_own_all ON nutrition_consultations
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === NUTRITION_ANAMNESIS ===
CREATE POLICY nutrition_anamnesis_manager_all ON nutrition_anamnesis
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_anamnesis_own_all ON nutrition_anamnesis
    FOR ALL TO authenticated
    USING (consultation_id IN (
        SELECT id FROM nutrition_consultations
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (consultation_id IN (
        SELECT id FROM nutrition_consultations
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === NUTRITION_METRICS ===
CREATE POLICY nutrition_metrics_manager_all ON nutrition_metrics
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_metrics_own_all ON nutrition_metrics
    FOR ALL TO authenticated
    USING (consultation_id IN (
        SELECT id FROM nutrition_consultations
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ))
    WITH CHECK (consultation_id IN (
        SELECT id FROM nutrition_consultations
        WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
    ));

-- === NUTRITION_MEAL_PLANS ===
CREATE POLICY nutrition_meal_plans_manager_all ON nutrition_meal_plans
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_meal_plans_own_all ON nutrition_meal_plans
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));

-- === NUTRITION_LAB_RESULTS ===
CREATE POLICY nutrition_lab_results_manager_all ON nutrition_lab_results
    FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY nutrition_lab_results_own_all ON nutrition_lab_results
    FOR ALL TO authenticated
    USING (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()))
    WITH CHECK (professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid()));
