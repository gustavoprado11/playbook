import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, UtensilsCrossed, Calendar } from 'lucide-react';

export default async function NutritionistDashboardPage() {
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'nutritionist') {
        redirect('/dashboard');
    }

    const supabase = await createClient();

    // Get professional ID
    const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('profession_type', 'nutritionist')
        .single();

    if (!professional) {
        redirect('/dashboard');
    }

    // Fetch summary data in parallel
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [patientsResult, consultationsResult, mealPlansResult] = await Promise.all([
        supabase
            .from('student_professionals')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .eq('status', 'active'),
        supabase
            .from('nutrition_consultations')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .gte('consultation_date', monthStart),
        supabase
            .from('nutrition_meal_plans')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .eq('is_active', true),
    ]);

    const stats = [
        {
            title: 'Pacientes Ativos',
            value: patientsResult.count || 0,
            icon: Users,
        },
        {
            title: 'Consultas no Mês',
            value: consultationsResult.count || 0,
            icon: ClipboardList,
        },
        {
            title: 'Planos Ativos',
            value: mealPlansResult.count || 0,
            icon: UtensilsCrossed,
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Painel do Nutricionista</h1>
                <p className="mt-1 text-zinc-500">Bem-vindo(a), {profile.full_name}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-500">
                                    {stat.title}
                                </CardTitle>
                                <Icon className="h-4 w-4 text-zinc-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
