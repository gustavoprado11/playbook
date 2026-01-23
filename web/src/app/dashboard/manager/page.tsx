import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent, formatMonthYear, getFirstDayOfMonth } from '@/lib/utils';
import { Users, UserCheck, TrendingUp, Coins } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Trainer, PerformanceSnapshot, Profile } from '@/types/database';

async function getManagerStats() {
    const supabase = await createClient();
    const referenceMonth = getFirstDayOfMonth();

    // Get trainers count
    const { count: trainersCount } = await supabase
        .from('trainers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    // Get students count
    const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    // Get snapshots for current month
    const { data: snapshots } = await supabase
        .from('performance_snapshots')
        .select('*, trainer:trainers(*, profile:profiles(*))')
        .eq('reference_month', referenceMonth);

    const totalReward = snapshots?.reduce((sum, s) => sum + Number(s.reward_amount), 0) || 0;
    const avgRetention = snapshots?.length
        ? snapshots.reduce((sum, s) => sum + Number(s.retention_rate), 0) / snapshots.length
        : 0;

    return {
        trainersCount: trainersCount || 0,
        studentsCount: studentsCount || 0,
        totalReward,
        avgRetention,
        snapshots: snapshots || [],
    };
}

export default async function ManagerDashboardPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'manager') {
        redirect('/dashboard');
    }

    const stats = await getManagerStats();
    const referenceMonth = getFirstDayOfMonth();

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
                                <p className="text-2xl font-bold text-zinc-900">{stats.trainersCount}</p>
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
                                <p className="text-2xl font-bold text-zinc-900">{stats.studentsCount}</p>
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
                                <p className="text-2xl font-bold text-zinc-900">{formatPercent(stats.avgRetention)}</p>
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
                                <p className="text-2xl font-bold text-zinc-900">{formatCurrency(stats.totalReward)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Trainers Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Performance dos Treinadores</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.snapshots.length === 0 ? (
                        <p className="text-center py-8 text-zinc-500">
                            Nenhum snapshot gerado para este mês.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-200">
                                        <th className="py-3 px-4 text-left text-sm font-medium text-zinc-500">Treinador</th>
                                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Retenção</th>
                                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Indicações</th>
                                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Gestão</th>
                                        <th className="py-3 px-4 text-right text-sm font-medium text-zinc-500">Recompensa</th>
                                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.snapshots.map((snapshot) => {
                                        const trainer = snapshot.trainer as Trainer & { profile: Profile };
                                        return (
                                            <tr key={snapshot.id} className="border-b border-zinc-100">
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-zinc-900">{trainer?.profile?.full_name || 'N/A'}</p>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${snapshot.retention_achieved
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : snapshot.retention_eligible
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-zinc-100 text-zinc-500'
                                                        }`}>
                                                        {formatPercent(snapshot.retention_rate)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${snapshot.referrals_achieved
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {snapshot.referrals_count}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${snapshot.management_achieved
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {formatPercent(snapshot.management_rate)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-zinc-900">
                                                    {formatCurrency(snapshot.reward_amount)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {snapshot.is_finalized ? (
                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                                            Finalizado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                                                            Aberto
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
