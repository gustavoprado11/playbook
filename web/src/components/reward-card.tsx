'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { Trophy, Coins } from 'lucide-react';

interface RewardCardProps {
    amount: number;
    kpisAchieved: number;
    totalKpis: number;
    isFinalized: boolean;
    className?: string;
}

export function RewardCard({
    amount,
    kpisAchieved,
    totalKpis,
    isFinalized,
    className,
}: RewardCardProps) {
    const allAchieved = kpisAchieved === totalKpis;

    return (
        <div
            className={cn(
                'rounded-xl border-2 p-6 transition-all',
                allAchieved
                    ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
                    : 'border-zinc-200 bg-white',
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Coins className={cn(
                            'h-5 w-5',
                            allAchieved ? 'text-amber-600' : 'text-zinc-400'
                        )} />
                        <p className="text-sm font-medium text-zinc-500">
                            {isFinalized ? 'Recompensa Final' : 'Recompensa Estimada'}
                        </p>
                    </div>
                    <p className={cn(
                        'mt-3 text-4xl font-bold',
                        amount > 0 ? 'text-emerald-600' : 'text-zinc-400'
                    )}>
                        {formatCurrency(amount)}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                        <div className="flex gap-1">
                            {Array.from({ length: totalKpis }).map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'h-2 w-8 rounded-full',
                                        i < kpisAchieved ? 'bg-emerald-500' : 'bg-zinc-200'
                                    )}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-zinc-500">
                            {kpisAchieved}/{totalKpis} KPIs
                        </span>
                    </div>
                </div>
                {allAchieved && (
                    <div className="rounded-full bg-amber-100 p-3">
                        <Trophy className="h-6 w-6 text-amber-600" />
                    </div>
                )}
            </div>

            {!isFinalized && (
                <p className="mt-4 text-xs text-zinc-400">
                    * Valor estimado baseado no desempenho atual. O valor final será definido no fechamento do mês.
                </p>
            )}
        </div>
    );
}
