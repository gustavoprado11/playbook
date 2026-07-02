-- ============================================
-- 044 — Catálogo de exercícios COMPARTILHADO
-- ============================================
-- Decisão de produto (Gustavo, 03/jul/2026): o catálogo de exercícios é uma
-- biblioteca ÚNICA do estúdio (modelo Exos/AthleticLab), não silos por treinador.
-- Afrouxa UPDATE/DELETE de `exercises` do modelo author-owned (A0, migr 043)
-- para: QUALQUER treinador OU manager. SELECT e INSERT ficam iguais ao 043
-- (created_by continua registrando a autoria como metadado de proveniência).
-- Como o A3 usará snapshots do exercício, arquivar não quebra programas atribuídos.
--
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE. Só RLS — sem mudança de schema.

DROP POLICY IF EXISTS exercises_update ON exercises;
DROP POLICY IF EXISTS exercises_delete ON exercises;

-- Qualquer treinador (get_trainer_id() não-nulo) ou manager pode editar/arquivar.
CREATE POLICY exercises_update ON exercises FOR UPDATE TO authenticated
    USING (public.get_trainer_id() IS NOT NULL OR public.is_manager())
    WITH CHECK (public.get_trainer_id() IS NOT NULL OR public.is_manager());

CREATE POLICY exercises_delete ON exercises FOR DELETE TO authenticated
    USING (public.get_trainer_id() IS NOT NULL OR public.is_manager());
