import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { listStudentAssignments, listProgramTemplates } from '@/app/actions/prescription';
import { StudentPrescription } from './student-prescription';

export default async function StudentPrescriptionPage({ params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params;

    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const supabase = await createClient();
    const { data: student } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('id', studentId)
        .single();

    if (!student) notFound();

    const [assignments, templates] = await Promise.all([
        listStudentAssignments(studentId),
        listProgramTemplates(),
    ]);

    return (
        <StudentPrescription
            studentId={student.id}
            studentName={student.full_name}
            assignments={assignments}
            templates={templates}
        />
    );
}
