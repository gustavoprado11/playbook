import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, FileText } from 'lucide-react';
import { getDashboardAlerts } from '@/app/actions/alerts';
import { DashboardAlerts } from '@/components/dashboard-alerts';

export default async function PhysiotherapistDashboardPage() {
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'physiotherapist') {
        redirect('/dashboard');
    }

    const supabase = await createClient();

    const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('profession_type', 'physiotherapist')
        .single();

    if (!professional) {
        redirect('/dashboard');
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [patientsResult, sessionsResult, plansResult, alerts] = await Promise.all([
        supabase
            .from('student_professionals')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .eq('status', 'active'),
        supabase
            .from('physio_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .gte('session_date', monthStart),
        supabase
            .from('physio_treatment_plans')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', professional.id)
            .eq('status', 'active'),
        getDashboardAlerts(),
    ]);

    const stats = [
        {
            title: 'Pacientes Ativos',
            value: patientsResult.count || 0,
            icon: Users,
        },
        {
            title: 'Sessões no Mês',
            value: sessionsResult.count || 0,
            icon: Activity,
        },
        {
            title: 'Protocolos Ativos',
            value: plansResult.count || 0,
            icon: FileText,
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Painel do Fisioterapeuta</h1>
                <p className="mt-1 text-zinc-500">Bem-vindo(a), {profile.full_name}</p>
            </div>

            <DashboardAlerts alerts={alerts} />

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
