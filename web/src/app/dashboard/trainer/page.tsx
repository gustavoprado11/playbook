import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { KPICard } from '@/components/kpi-card';
import { RewardCard } from '@/components/reward-card';
import { formatPercent, formatMonthYear, getFirstDayOfMonth } from '@/lib/utils';
import type { TrainerDashboardData } from '@/types/database';

async function getTrainerDashboardData(trainerId: string, referenceMonth: string): Promise<TrainerDashboardData | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .rpc('get_trainer_dashboard_data', {
            p_trainer_id: trainerId,
            p_reference_month: referenceMonth,
        });

    if (error || !data || data.length === 0) {
        return null;
    }

    return data[0] as TrainerDashboardData;
}

export default async function TrainerDashboardPage() {
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

    const referenceMonth = getFirstDayOfMonth();
    const data = await getTrainerDashboardData(trainerId, referenceMonth);

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-zinc-500">Nenhum dado disponível para este mês.</p>
            </div>
        );
    }

    const kpisAchieved = [
        data.retention_achieved,
        data.referrals_achieved,
        data.management_achieved,
    ].filter(Boolean).length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Meu Desempenho</h1>
                <p className="mt-1 text-zinc-500">
                    {formatMonthYear(data.reference_month)}
                    {data.is_finalized && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Finalizado
                        </span>
                    )}
                </p>
            </div>

            {/* Reward Card */}
            <RewardCard
                amount={data.reward_amount}
                kpisAchieved={kpisAchieved}
                totalKpis={3}
                isFinalized={data.is_finalized}
            />

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* KPI 01: Retention */}
                <KPICard
                    title="Retenção de Alunos"
                    value={formatPercent(data.retention_rate)}
                    target={formatPercent(data.retention_target)}
                    achieved={data.retention_achieved}
                    eligible={data.retention_eligible}
                    subtitle={`${data.students_start} alunos no início • ${data.cancellations} cancelamentos`}
                />

                {/* KPI 02: Referrals */}
                <KPICard
                    title="Indicações Validadas"
                    value={data.referrals_count}
                    target={`≥ ${data.referrals_target}`}
                    achieved={data.referrals_achieved}
                    subtitle={data.referrals_pending > 0 ? `${data.referrals_pending} aguardando validação` : undefined}
                />

                {/* KPI 03: Management */}
                <KPICard
                    title="Gestão de Resultados"
                    value={formatPercent(data.management_rate)}
                    target={formatPercent(data.management_target)}
                    achieved={data.management_achieved}
                    subtitle={`${data.managed_count}/${data.portfolio_size} alunos com gestão em dia`}
                />
            </div>

            {/* Info card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-zinc-900">Critérios de Performance</h2>
                <div className="mt-4 space-y-4 text-sm text-zinc-600">
                    <div className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">1</span>
                        <p><strong>Retenção:</strong> Mantenha pelo menos 90% dos seus alunos ativos. Você precisa ter no mínimo 5 alunos para ser elegível.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">2</span>
                        <p><strong>Indicações:</strong> Traga pelo menos 1 novo aluno por indicação. A indicação só conta após 30 dias de permanência.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">3</span>
                        <p><strong>Gestão:</strong> Mantenha o checklist de resultados atualizado para pelo menos 75% dos seus alunos.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
