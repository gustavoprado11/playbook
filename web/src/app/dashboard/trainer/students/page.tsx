import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { StudentTable } from './student-table';
import type { Student } from '@/types/database';

async function getTrainerStudents(trainerId: string) {
    const supabase = await createClient();

    const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .order('full_name');

    return (students || []) as Student[];
}


async function getLatestAssessments(trainerId: string) {
    const supabase = await createClient();

    // Fetch all assessments for this trainer's students
    // We can't easily do a "distinct on" via simple client query if strict types, 
    // but we can fetch them and process in JS or use a joined query.
    // Let's fetch assessments for students of this trainer.

    // First get student IDs (we already have them in getTrainerStudents but parallel fetch makes it harder to share)
    // Let's rely on RLS: trainers only see their own students' assessments.
    // So we can just fetch all assessments visible to this trainer.

    const { data } = await supabase
        .from('student_assessments')
        .select('student_id, performed_at')
        .order('performed_at', { ascending: false });

    // Process to get latest per student
    const latestMap = new Map<string, string>(); // studentId -> date string

    if (data) {
        for (const assessment of data) {
            if (!latestMap.has(assessment.student_id)) {
                latestMap.set(assessment.student_id, assessment.performed_at);
            }
        }
    }

    return latestMap;
}

export default async function TrainerStudentsPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const trainerId = await getTrainerId();
    if (!trainerId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-zinc-500">Perfil de treinador não encontrado.</p>
            </div>
        );
    }

    const [students, latestAssessments] = await Promise.all([
        getTrainerStudents(trainerId),
        getLatestAssessments(trainerId),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Meus Alunos</h1>
                <p className="mt-1 text-zinc-500">
                    Gerencie o status de avaliação da sua carteira
                </p>
            </div>

            <StudentTable
                students={students}
                assessmentMap={latestAssessments}
            />
        </div>
    );
}
