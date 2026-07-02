-- ============================================
-- RLS — MÓDULO PRESCRIÇÃO DE TREINO (A0)
-- ============================================
-- Templates NÃO são student-scoped -> sem attends_student aqui (entra no A3).
-- 2 camadas: is_manager() (tudo) + dono (created_by = auth.uid()).
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.

-- ============================================
-- TAXONOMIA: leitura p/ todo autenticado (ativos), escrita só manager.
-- ============================================
ALTER TABLE movement_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_methods  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movement_patterns_read   ON movement_patterns;
DROP POLICY IF EXISTS movement_patterns_manage ON movement_patterns;
CREATE POLICY movement_patterns_read ON movement_patterns FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_manager());
CREATE POLICY movement_patterns_manage ON movement_patterns FOR ALL TO authenticated
    USING (public.is_manager()) WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS block_categories_read   ON block_categories;
DROP POLICY IF EXISTS block_categories_manage ON block_categories;
CREATE POLICY block_categories_read ON block_categories FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_manager());
CREATE POLICY block_categories_manage ON block_categories FOR ALL TO authenticated
    USING (public.is_manager()) WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS training_methods_read   ON training_methods;
DROP POLICY IF EXISTS training_methods_manage ON training_methods;
CREATE POLICY training_methods_read ON training_methods FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_manager());
CREATE POLICY training_methods_manage ON training_methods FOR ALL TO authenticated
    USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ============================================
-- CATÁLOGO: leitura de ativos p/ todo autenticado (+ dono/manager veem inativos);
-- INSERT por qualquer autenticado com created_by = auth.uid();
-- UPDATE/DELETE por dono ou manager.
-- ============================================
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercises_read   ON exercises;
DROP POLICY IF EXISTS exercises_insert ON exercises;
DROP POLICY IF EXISTS exercises_update ON exercises;
DROP POLICY IF EXISTS exercises_delete ON exercises;
CREATE POLICY exercises_read ON exercises FOR SELECT TO authenticated
    USING (is_active = TRUE OR public.is_manager() OR created_by = auth.uid());
CREATE POLICY exercises_insert ON exercises FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());
CREATE POLICY exercises_update ON exercises FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR public.is_manager())
    WITH CHECK (created_by = auth.uid() OR public.is_manager());
CREATE POLICY exercises_delete ON exercises FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.is_manager());

-- ============================================
-- ÁRVORE DE TEMPLATE: dono = program_templates.created_by.
-- Cada nível resolve a posse subindo a cadeia até program_templates. Manager vê/edita tudo.
-- ============================================

-- program_templates (dono direto)
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS program_templates_all ON program_templates;
CREATE POLICY program_templates_all ON program_templates FOR ALL TO authenticated
    USING (created_by = auth.uid() OR public.is_manager())
    WITH CHECK (created_by = auth.uid() OR public.is_manager());

-- session_templates -> posse via program_templates
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_templates_all ON session_templates;
CREATE POLICY session_templates_all ON session_templates FOR ALL TO authenticated
    USING (public.is_manager() OR program_template_id IN
        (SELECT id FROM program_templates WHERE created_by = auth.uid()))
    WITH CHECK (public.is_manager() OR program_template_id IN
        (SELECT id FROM program_templates WHERE created_by = auth.uid()));

-- block_templates -> posse via session->program
ALTER TABLE block_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS block_templates_all ON block_templates;
CREATE POLICY block_templates_all ON block_templates FOR ALL TO authenticated
    USING (public.is_manager() OR session_template_id IN
        (SELECT st.id FROM session_templates st
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()))
    WITH CHECK (public.is_manager() OR session_template_id IN
        (SELECT st.id FROM session_templates st
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()));

-- item_templates -> posse via block->session->program
ALTER TABLE item_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS item_templates_all ON item_templates;
CREATE POLICY item_templates_all ON item_templates FOR ALL TO authenticated
    USING (public.is_manager() OR block_template_id IN
        (SELECT bt.id FROM block_templates bt
         JOIN session_templates st ON st.id = bt.session_template_id
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()))
    WITH CHECK (public.is_manager() OR block_template_id IN
        (SELECT bt.id FROM block_templates bt
         JOIN session_templates st ON st.id = bt.session_template_id
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()));

-- set_templates -> posse via item->block->session->program
ALTER TABLE set_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS set_templates_all ON set_templates;
CREATE POLICY set_templates_all ON set_templates FOR ALL TO authenticated
    USING (public.is_manager() OR item_template_id IN
        (SELECT it.id FROM item_templates it
         JOIN block_templates bt ON bt.id = it.block_template_id
         JOIN session_templates st ON st.id = bt.session_template_id
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()))
    WITH CHECK (public.is_manager() OR item_template_id IN
        (SELECT it.id FROM item_templates it
         JOIN block_templates bt ON bt.id = it.block_template_id
         JOIN session_templates st ON st.id = bt.session_template_id
         JOIN program_templates pt ON pt.id = st.program_template_id
         WHERE pt.created_by = auth.uid()));
