-- ============================================
-- MÓDULO FISIOTERAPIA — Upload de anexos
-- A tabela physio_attachments e a action deletePhysioAttachment já existiam,
-- mas faltava: (1) o bucket de storage 'physio-attachments', (2) o nome
-- original do arquivo para exibição, e (3) suporte a anexo a nível de
-- paciente (laudo externo), que não pertence a uma sessão/protocolo interno.
-- ============================================

-- 1. Nome original do arquivo (para exibição)
ALTER TABLE physio_attachments
    ADD COLUMN IF NOT EXISTS file_name TEXT;

-- 2. Permitir anexo a nível de paciente (sem sessão/protocolo).
--    Um relatório externo (ex.: laudo timbrado) é um documento do paciente,
--    não necessariamente de uma sessão interna. student_id já é NOT NULL,
--    então é âncora suficiente.
ALTER TABLE physio_attachments
    DROP CONSTRAINT IF EXISTS physio_attachments_has_parent;

-- 3. RLS: além de sessão/protocolo do próprio profissional, autorizar quando
--    o paciente está vinculado (ativo) ao profissional autenticado.
DROP POLICY IF EXISTS physio_attachments_own_all ON physio_attachments;
CREATE POLICY physio_attachments_own_all ON physio_attachments
    FOR ALL TO authenticated
    USING (
        student_id IN (
            SELECT sp.student_id FROM student_professionals sp
            JOIN professionals p ON p.id = sp.professional_id
            WHERE p.profile_id = auth.uid() AND sp.status = 'active'
        )
        OR (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    )
    WITH CHECK (
        student_id IN (
            SELECT sp.student_id FROM student_professionals sp
            JOIN professionals p ON p.id = sp.professional_id
            WHERE p.profile_id = auth.uid() AND sp.status = 'active'
        )
        OR (session_id IS NOT NULL AND session_id IN (
            SELECT id FROM physio_sessions
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
        OR (treatment_plan_id IS NOT NULL AND treatment_plan_id IN (
            SELECT id FROM physio_treatment_plans
            WHERE professional_id IN (SELECT id FROM professionals WHERE profile_id = auth.uid())
        ))
    );

-- 4. Bucket de storage privado (espelha a config de 'assessment-photos')
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'physio-attachments',
    'physio-attachments',
    false,
    10485760,  -- 10MB (laudos podem ter várias páginas/imagens)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Políticas de storage restritas ao bucket
DROP POLICY IF EXISTS "Physio can upload attachments" ON storage.objects;
CREATE POLICY "Physio can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'physio-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Physio can view attachments" ON storage.objects;
CREATE POLICY "Physio can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'physio-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Physio can delete attachments" ON storage.objects;
CREATE POLICY "Physio can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'physio-attachments' AND auth.role() = 'authenticated');
