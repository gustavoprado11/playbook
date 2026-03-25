-- =====================================================
-- Migration: 017_assessment_attachments.sql
-- Description: Add file attachments to assessments
-- =====================================================

-- 1. Create assessment_attachments table
CREATE TABLE assessment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES student_assessments(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_attachments_assessment_id
    ON assessment_attachments(assessment_id);

-- 2. RLS
ALTER TABLE assessment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can insert attachments for own students"
ON assessment_attachments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM student_assessments sa
        JOIN students s ON sa.student_id = s.id
        WHERE sa.id = assessment_attachments.assessment_id
        AND s.trainer_id = public.get_trainer_id()
    )
);

CREATE POLICY "Trainers can view own student attachments"
ON assessment_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM student_assessments sa
        JOIN students s ON sa.student_id = s.id
        WHERE sa.id = assessment_attachments.assessment_id
        AND s.trainer_id = public.get_trainer_id()
    )
);

CREATE POLICY "Managers can view all attachments"
ON assessment_attachments FOR SELECT
USING (public.is_manager());

CREATE POLICY "Trainers can delete own student attachments"
ON assessment_attachments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM student_assessments sa
        JOIN students s ON sa.student_id = s.id
        WHERE sa.id = assessment_attachments.assessment_id
        AND s.trainer_id = public.get_trainer_id()
    )
);

GRANT ALL ON assessment_attachments TO authenticated;

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assessment-photos',
    'assessment-photos',
    false,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
);

-- 4. Storage policies
CREATE POLICY "Authenticated users can upload assessment photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'assessment-photos'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view assessment photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'assessment-photos'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete assessment photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'assessment-photos'
    AND auth.role() = 'authenticated'
);
