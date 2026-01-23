import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import type { Trainer, Profile } from '@/types/database';
import { ManagerTrainerTable } from './trainer-table';

async function getTrainersWithStats() {
    const supabase = await createClient();

    // 1. Fetch Trainers with Profiles
    const { data: trainers, error } = await supabase
        .from('trainers')
        .select('*, profile:profiles(*)')
        .order('created_at', { ascending: false });

    if (error || !trainers) return [];

    // 2. Fetch Active Students Counts per Trainer
    const { data: students } = await supabase
        .from('students')
        .select('trainer_id, created_at, status')
        .eq('status', 'active');

    // 3. Simple Stats Aggregation
    const statsMap = new Map<string, { activeStudents: number }>();

    // Initialize
    trainers.forEach(t => statsMap.set(t.id, { activeStudents: 0 }));

    // Count
    students?.forEach(s => {
        const current = statsMap.get(s.trainer_id) || { activeStudents: 0 };
        current.activeStudents++;
        statsMap.set(s.trainer_id, current);
    });

    // Merge
    return trainers.map(t => ({
        ...t,
        stats: statsMap.get(t.id)
    })) as (Trainer & { profile: Profile, stats: { activeStudents: number } })[];
}

export default async function ManagerTrainersPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const trainers = await getTrainersWithStats();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Treinadores</h1>
                    <p className="mt-1 text-zinc-500">
                        Gerencie a equipe de treinadores do estúdio
                    </p>
                </div>
                <Link href="/dashboard/manager/trainers/new">
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Novo Treinador
                    </Button>
                </Link>
            </div>

            <ManagerTrainerTable trainers={trainers} />
        </div>
    );
}
