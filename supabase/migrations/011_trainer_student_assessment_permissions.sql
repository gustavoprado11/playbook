-- =====================================================
-- Migration: 011_trainer_student_assessment_permissions.sql
-- Description: Allow trainers to create students and manage assessments/results
-- =====================================================

-- Students: trainers can create students in their own portfolio
CREATE POLICY "Trainers can create own students" ON students
    FOR INSERT
    WITH CHECK (trainer_id = public.get_trainer_id());

-- Assessments: managers can fully manage, trainers can update/delete their own students' assessments
CREATE POLICY "Managers manage assessments" ON student_assessments
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY "Trainers update own student assessments" ON student_assessments
    FOR UPDATE
    USING (
        student_id IN (
            SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
        )
    )
    WITH CHECK (
        student_id IN (
            SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
        )
    );

CREATE POLICY "Trainers delete own student assessments" ON student_assessments
    FOR DELETE
    USING (
        student_id IN (
            SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
        )
    );

-- Assessment results: managers can fully manage, trainers can update/delete values from their own students' assessments
CREATE POLICY "Managers manage result values" ON assessment_results
    FOR ALL
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE POLICY "Trainers update own result values" ON assessment_results
    FOR UPDATE
    USING (
        assessment_id IN (
            SELECT id FROM student_assessments WHERE student_id IN (
                SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
            )
        )
    )
    WITH CHECK (
        assessment_id IN (
            SELECT id FROM student_assessments WHERE student_id IN (
                SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
            )
        )
    );

CREATE POLICY "Trainers delete own result values" ON assessment_results
    FOR DELETE
    USING (
        assessment_id IN (
            SELECT id FROM student_assessments WHERE student_id IN (
                SELECT id FROM students WHERE trainer_id = public.get_trainer_id()
            )
        )
    );
