import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { calculateLiveKPIs } from '@/app/actions/manager';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent, formatMonthYear, getFirstDayOfMonth } from '@/lib/utils';
import { Users, UserCheck, TrendingUp, Coins, Radio, Lock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TrainerActivitySummary } from '@/types/database';
import { TrainerActivityPanel } from './trainer-activity-panel';
import { GenerateSnapshotButton } from './generate-snapshot-button';
import { PerformanceTable } from './performance-table';
import { getDashboardAlerts } from '@/app/actions/alerts';
import { DashboardAlerts } from '@/components/dashboard-alerts';

async function getBasicStats() {
    const supabase = await createClient();

    const [{ count: trainersCount }, { count: studentsCount }] = await Promise.all([
        supabase
            .from('trainers')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true),
        supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .eq('is_archived', false),
    ]);

    return {
        trainersCount: trainersCount || 0,
        studentsCount: studentsCount || 0,
    };
}

async function getTrainerActivity(): Promise<TrainerActivitySummary[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('trainer_activity_summary')
        .select('*');

    if (error) {
        console.error('Error fetching trainer activity:', error);
        return [];
    }

    return (data || []) as TrainerActivitySummary[];
}

export default async function ManagerDashboardPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const referenceMonth = getFirstDayOfMonth();
    const [basicStats, activity, liveData, alerts] = await Promise.all([
        getBasicStats(),
        getTrainerActivity(),
        calculateLiveKPIs(referenceMonth),
        getDashboardAlerts(),
    ]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Visão Geral</h1>
                    <p className="mt-1 text-zinc-500">{formatMonthYear(referenceMonth)}</p>
                </div>
                <Link href="/dashboard/manager/rules">
                    <Button variant="outline">Configurar Regras</Button>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-blue-100 p-3">
                                <UserCheck className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Treinadores</p>
                                <p className="text-2xl font-bold text-zinc-900">{basicStats.trainersCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-purple-100 p-3">
                                <Users className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Alunos Ativos</p>
                                <p className="text-2xl font-bold text-zinc-900">{basicStats.studentsCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-emerald-100 p-3">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Retenção Média</p>
                                <p className="text-2xl font-bold text-zinc-900">{formatPercent(liveData.avgRetention)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-amber-100 p-3">
                                <Coins className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-500">Recompensas Est.</p>
                                <p className="text-2xl font-bold text-zinc-900">{formatCurrency(liveData.totalReward)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dashboard Alerts */}
            <DashboardAlerts alerts={alerts} />

            {/* No active rule banner */}
            {!liveData.hasActiveRule && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800">
                        Configure uma{' '}
                        <Link href="/dashboard/manager/rules/new" className="font-medium underline">
                            Regra do Jogo
                        </Link>{' '}
                        para ativar o cálculo de bônus.
                    </p>
                </div>
            )}

            {/* Trainer Activity Panel */}
            <TrainerActivityPanel data={activity} />

            {/* Trainers Performance Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CardTitle>Performance dos Treinadores</CardTitle>
                            {liveData.isFinalized ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <Lock className="h-3 w-3" />
                                    Finalizado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    <Radio className="h-3 w-3" />
                                    Tempo real
                                </span>
                            )}
                        </div>
                        {!liveData.isFinalized && liveData.hasActiveRule && (
                            <GenerateSnapshotButton referenceMonth={referenceMonth} />
                        )}
                    </div>
                    {!liveData.isFinalized && (
                        <p className="text-xs text-zinc-400 mt-1">
                            Dados calculados em tempo real. O snapshot será gerado automaticamente ao final do mês.
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    {liveData.trainers.length === 0 ? (
                        <p className="text-center py-8 text-zinc-500">
                            Nenhum treinador ativo encontrado.
                        </p>
                    ) : (
                        <PerformanceTable trainers={liveData.trainers} referenceMonth={referenceMonth} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
