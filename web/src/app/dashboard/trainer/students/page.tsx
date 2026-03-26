import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { StudentTable } from './student-table';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import type { Student } from '@/types/database';

async function getOtherTrainers(currentTrainerId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('trainers')
        .select('id, profile:profiles!inner(full_name)')
        .eq('is_active', true)
        .neq('id', currentTrainerId)
        .order('created_at');
    return (data || []).map((t: any) => ({
        id: t.id as string,
        profile: { full_name: (Array.isArray(t.profile) ? t.profile[0]?.full_name : t.profile?.full_name) || '' },
    }));
}

async function getTrainerStudents(trainerId: string) {
    const supabase = await createClient();

    const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .eq('is_archived', false)
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

    const [students, latestAssessments, otherTrainers] = await Promise.all([
        getTrainerStudents(trainerId),
        getLatestAssessments(trainerId),
        getOtherTrainers(trainerId),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Meus Alunos</h1>
                    <p className="mt-1 text-zinc-500">
                        Gerencie sua carteira e o status de avaliação dos alunos
                    </p>
                </div>
                <Link href="/dashboard/trainer/students/new">
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Novo Aluno
                    </Button>
                </Link>
            </div>

            <StudentTable
                students={students}
                assessmentMap={latestAssessments}
                trainers={otherTrainers}
            />
        </div>
    );
}
