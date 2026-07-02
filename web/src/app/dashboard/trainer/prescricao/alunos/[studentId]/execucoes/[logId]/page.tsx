import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { getWorkoutLog } from '@/app/actions/prescription';
import { WorkoutLogForm } from './workout-log-form';

export default async function WorkoutLogPage({
    params,
}: {
    params: Promise<{ studentId: string; logId: string }>;
}) {
    const { studentId, logId } = await params;

    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const log = await getWorkoutLog(logId);
    if (!log || log.student_id !== studentId) notFound();

    const supabase = await createClient();
    const { data: student } = await supabase
        .from('students')
        .select('full_name')
        .eq('id', studentId)
        .single();

    return <WorkoutLogForm log={log} studentId={studentId} studentName={student?.full_name ?? 'Aluno'} />;
}
