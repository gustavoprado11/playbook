'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus, UtensilsCrossed, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MetricTrend } from '@/app/actions/kpis';

const trendConfig = {
    improving: { icon: TrendingDown, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Melhorando' },
    declining: { icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50', label: 'Em declínio' },
    stable: { icon: Minus, color: 'text-zinc-500', bg: 'bg-zinc-50', label: 'Estável' },
};

const metricLabels: Record<string, string> = {
    weight: 'Peso',
    bmi: 'IMC',
    body_fat: '% Gordura',
    pain: 'Dor',
};

function TrendItem({ t }: { t: MetricTrend }) {
    const config = trendConfig[t.trend];
    const Icon = config.icon;

    return (
        <Link href={`/dashboard/manager/students/${t.studentId}`} className="block">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors">
                <div className={cn('rounded-full p-1.5', config.bg)}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{t.studentName}</p>
                    <p className="text-xs text-zinc-500">{metricLabels[t.metric] || t.metric}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className={cn('text-sm font-semibold', config.color)}>
                        {t.changePercent > 0 ? '+' : ''}{t.changePercent}%
                    </p>
                    <p className="text-xs text-zinc-400">{t.dataPoints.length} pontos</p>
                </div>
            </div>
        </Link>
    );
}

interface Props {
    nutrition: MetricTrend[];
    physio: MetricTrend[];
}

export function MetricTrendsPanel({ nutrition, physio }: Props) {
    const improving = [...nutrition, ...physio].filter(t => t.trend === 'improving').slice(0, 5);
    const declining = [...nutrition, ...physio].filter(t => t.trend === 'declining').slice(0, 5);

    if (improving.length === 0 && declining.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-zinc-500 text-sm">
                    Dados insuficientes para análise de tendências. São necessárias pelo menos 2 medições por aluno.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Improving */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-emerald-600" />
                        <CardTitle className="text-base text-emerald-700">Melhor Evolução</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {improving.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-4">Nenhuma tendência de melhora detectada</p>
                    ) : (
                        improving.map(t => <TrendItem key={`${t.studentId}-${t.metric}`} t={t} />)
                    )}
                </CardContent>
            </Card>

            {/* Declining */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-red-600" />
                        <CardTitle className="text-base text-red-700">Atenção Necessária</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {declining.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-4">Nenhuma tendência negativa detectada</p>
                    ) : (
                        declining.map(t => <TrendItem key={`${t.studentId}-${t.metric}`} t={t} />)
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
