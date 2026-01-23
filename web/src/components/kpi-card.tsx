'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string | number;
    target: string | number;
    achieved: boolean;
    eligible?: boolean;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    className?: string;
}

export function KPICard({
    title,
    value,
    target,
    achieved,
    eligible = true,
    subtitle,
    trend,
    className,
}: KPICardProps) {
    const isIneligible = !eligible;

    return (
        <div
            className={cn(
                'rounded-xl border p-6 transition-all',
                achieved && eligible
                    ? 'border-emerald-200 bg-emerald-50'
                    : isIneligible
                        ? 'border-zinc-200 bg-zinc-50'
                        : 'border-zinc-200 bg-white',
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-zinc-500">{title}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className={cn(
                            'text-3xl font-bold',
                            achieved && eligible
                                ? 'text-emerald-600'
                                : isIneligible
                                    ? 'text-zinc-400'
                                    : 'text-zinc-900'
                        )}>
                            {value}
                        </span>
                        {trend && (
                            <span className={cn(
                                'flex items-center text-sm',
                                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-zinc-500'
                            )}>
                                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                                {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                        Meta: {target}
                    </p>
                    {subtitle && (
                        <p className="mt-2 text-xs text-zinc-400">{subtitle}</p>
                    )}
                </div>
                <div className={cn(
                    'rounded-full p-2',
                    achieved && eligible
                        ? 'bg-emerald-100'
                        : isIneligible
                            ? 'bg-zinc-100'
                            : 'bg-red-100'
                )}>
                    {achieved && eligible ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : isIneligible ? (
                        <AlertCircle className="h-5 w-5 text-zinc-400" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                    )}
                </div>
            </div>

            {isIneligible && (
                <div className="mt-4 rounded-lg bg-zinc-100 px-3 py-2">
                    <p className="text-xs text-zinc-500">
                        Inelegível — carteira mínima não atingida
                    </p>
                </div>
            )}
        </div>
    );
}
