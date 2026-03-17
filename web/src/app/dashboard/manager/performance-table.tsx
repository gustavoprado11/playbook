'use client';

import { formatPercent, formatCurrency } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { LiveTrainerKPI } from '@/app/actions/manager';
import { PerformanceKPIPopover } from './performance-kpi-popover';

interface PerformanceTableProps {
    trainers: LiveTrainerKPI[];
    referenceMonth: string;
}

export function PerformanceTable({ trainers, referenceMonth }: PerformanceTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-zinc-200">
                        <th className="py-3 px-4 text-left text-sm font-medium text-zinc-500">Treinador</th>
                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Retenção</th>
                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Indicações</th>
                        <th className="py-3 px-4 text-center text-sm font-medium text-zinc-500">Gestão</th>
                        <th className="py-3 px-4 text-right text-sm font-medium text-zinc-500">Bônus Est.</th>
                    </tr>
                </thead>
                <tbody>
                    {trainers.map((trainer) => (
                        <tr key={trainer.trainerId} className="border-b border-zinc-100">
                            <td className="py-3 px-4">
                                <p className="font-medium text-zinc-900">{trainer.trainerName}</p>
                            </td>
                            <td className="py-3 px-4 text-center">
                                {trainer.retentionEligible ? (
                                    <PerformanceKPIPopover
                                        trainerId={trainer.trainerId}
                                        trainerName={trainer.trainerName}
                                        kpiType="retention"
                                        referenceMonth={referenceMonth}
                                    >
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                            trainer.retentionAchieved
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {formatPercent(trainer.retentionRate)}
                                            {trainer.retentionAchieved
                                                ? <CheckCircle2 className="h-3 w-3" />
                                                : <XCircle className="h-3 w-3" />}
                                        </span>
                                    </PerformanceKPIPopover>
                                ) : (
                                    <PerformanceKPIPopover
                                        trainerId={trainer.trainerId}
                                        trainerName={trainer.trainerName}
                                        kpiType="retention"
                                        referenceMonth={referenceMonth}
                                        ineligibleMessage="Treinador inelegível — portfólio abaixo do mínimo."
                                    >
                                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                                            —
                                        </span>
                                    </PerformanceKPIPopover>
                                )}
                            </td>
                            <td className="py-3 px-4 text-center">
                                <PerformanceKPIPopover
                                    trainerId={trainer.trainerId}
                                    trainerName={trainer.trainerName}
                                    kpiType="referrals"
                                    referenceMonth={referenceMonth}
                                >
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                        trainer.referralsAchieved
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {trainer.referralsCount}
                                        {trainer.referralsAchieved
                                            ? <CheckCircle2 className="h-3 w-3" />
                                            : <XCircle className="h-3 w-3" />}
                                    </span>
                                </PerformanceKPIPopover>
                            </td>
                            <td className="py-3 px-4 text-center">
                                {trainer.portfolioSize > 0 ? (
                                    <PerformanceKPIPopover
                                        trainerId={trainer.trainerId}
                                        trainerName={trainer.trainerName}
                                        kpiType="management"
                                        referenceMonth={referenceMonth}
                                    >
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                            trainer.managementAchieved
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {formatPercent(trainer.managementRate)}
                                            {trainer.managementAchieved
                                                ? <CheckCircle2 className="h-3 w-3" />
                                                : <XCircle className="h-3 w-3" />}
                                        </span>
                                    </PerformanceKPIPopover>
                                ) : (
                                    <PerformanceKPIPopover
                                        trainerId={trainer.trainerId}
                                        trainerName={trainer.trainerName}
                                        kpiType="management"
                                        referenceMonth={referenceMonth}
                                        ineligibleMessage="Nenhum aluno ativo no portfólio."
                                    >
                                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                                            —
                                        </span>
                                    </PerformanceKPIPopover>
                                )}
                            </td>
                            <td className="py-3 px-4 text-right">
                                {trainer.retentionEligible ? (
                                    <span className="font-medium text-zinc-900">
                                        {formatCurrency(trainer.rewardAmount)}
                                    </span>
                                ) : (
                                    <span className="text-xs text-zinc-400">Inelegível</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
