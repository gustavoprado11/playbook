import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import type { TeamMember } from '@/types/database';
import { TeamTable } from './team-table';

export default async function TeamPage() {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const supabase = await createClient();

    // Buscar em paralelo
    const [trainersResult, professionalsResult] = await Promise.all([
        supabase
            .from('trainers')
            .select('*, profile:profiles!profile_id(*)')
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false }),

        supabase
            .from('professionals')
            .select(`
                *,
                profile:profiles!profile_id(full_name, email, avatar_url),
                student_count:student_professionals(count)
            `)
            .in('profession_type', ['nutritionist', 'physiotherapist'])
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false }),
    ]);

    // Contar alunos ativos por treinador
    const { data: studentCounts } = await supabase
        .from('students')
        .select('trainer_id')
        .eq('status', 'active')
        .eq('is_archived', false);

    const trainerStudentMap = new Map<string, number>();
    studentCounts?.forEach(s => {
        if (s.trainer_id) {
            trainerStudentMap.set(s.trainer_id, (trainerStudentMap.get(s.trainer_id) || 0) + 1);
        }
    });

    // Normalizar para formato unificado
    const trainers: TeamMember[] = (trainersResult.data || []).map(t => ({
        id: t.id,
        profileId: t.profile_id,
        name: t.profile?.full_name || '',
        email: t.profile?.email || '',
        avatarUrl: t.profile?.avatar_url,
        type: 'trainer' as const,
        startDate: t.start_date,
        isActive: t.is_active,
        notes: t.notes,
        activeStudents: trainerStudentMap.get(t.id) || 0,
        trainerId: t.id,
    }));

    const professionals: TeamMember[] = (professionalsResult.data || []).map(p => ({
        id: p.id,
        profileId: p.profile_id,
        name: p.profile?.full_name || '',
        email: p.profile?.email || '',
        avatarUrl: p.profile?.avatar_url,
        type: p.profession_type as 'nutritionist' | 'physiotherapist',
        startDate: p.start_date,
        isActive: p.is_active,
        notes: p.notes,
        activeStudents: p.student_count?.[0]?.count || 0,
    }));

    const allMembers = [...trainers, ...professionals];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Equipe</h1>
                <p className="mt-1 text-zinc-500">
                    Gerencie todos os profissionais do estúdio
                </p>
            </div>
            <TeamTable members={allMembers} />
        </div>
    );
}
