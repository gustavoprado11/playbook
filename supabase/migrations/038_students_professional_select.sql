-- Allow professionals (physio/nutri) to SELECT students they actively attend.
-- Gap from migration 035 (shared student registry): professionals could be linked
-- via student_professionals but had no SELECT policy on students, so embedded
-- student data came back null (patient lists/records/agenda showed empty).
-- Uses the existing attends_student() helper (active professional link OR trainer).
CREATE POLICY "Professionals can view attended students"
ON public.students FOR SELECT TO authenticated
USING (public.attends_student(id));
