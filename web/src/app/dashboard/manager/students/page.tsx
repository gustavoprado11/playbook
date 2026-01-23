import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import type { Student, Trainer, Profile } from '@/types/database';
import { ManagerStudentTable } from './student-table';

async function getStudents() {
    const supabase = await createClient();

    const { data: students, error } = await supabase
        .from('students')
        .select('*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*))')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching students:', error);
        return [];
    }

    return (students || []) as (Student & { trainer: Trainer & { profile: Profile } })[];
}

async function getTrainers() {
    const supabase = await createClient();
    const { data } = await supabase
        .from('trainers')
        .select('*, profile:profiles(*)')
        .eq('is_active', true)
        .order('created_at');

    return (data || []) as (Trainer & { profile: Profile })[];
}

export default async function ManagerStudentsPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const [students, trainers] = await Promise.all([
        getStudents(),
        getTrainers()
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Alunos</h1>
                    <p className="mt-1 text-zinc-500">
                        Gerencie os alunos do estúdio
                    </p>
                </div>
                <Link href="/dashboard/manager/students/new">
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Novo Aluno
                    </Button>
                </Link>
            </div>

            <ManagerStudentTable students={students} trainers={trainers} />
        </div>
    );
}
