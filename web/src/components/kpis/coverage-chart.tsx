'use client';

import { Dumbbell, UtensilsCrossed, Activity, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CoverageKPI } from '@/app/actions/kpis';

const segments = [
    { key: 'trainingOnly', label: 'Só Treino', icon: Dumbbell, color: 'bg-zinc-500', barColor: 'bg-zinc-400', textColor: 'text-zinc-700' },
    { key: 'nutritionOnly', label: '+ Nutrição', icon: UtensilsCrossed, color: 'bg-amber-500', barColor: 'bg-amber-400', textColor: 'text-amber-700' },
    { key: 'physioOnly', label: '+ Fisioterapia', icon: Activity, color: 'bg-blue-500', barColor: 'bg-blue-400', textColor: 'text-blue-700' },
    { key: 'withBoth', label: 'Multidisciplinar', icon: Sparkles, color: 'bg-emerald-500', barColor: 'bg-emerald-400', textColor: 'text-emerald-700' },
];

export function CoverageChart({ coverage }: { coverage: CoverageKPI }) {
    const total = coverage.totalActiveStudents || 1;
    const nutritionOnly = coverage.withNutrition - coverage.withBoth;
    const physioOnly = coverage.withPhysio - coverage.withBoth;

    const values: Record<string, number> = {
        trainingOnly: coverage.trainingOnly,
        nutritionOnly,
        physioOnly,
        withBoth: coverage.withBoth,
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Cobertura Multidisciplinar</CardTitle>
                <p className="text-sm text-zinc-500">{coverage.totalActiveStudents} alunos ativos — {coverage.coverageRate.toFixed(0)}% com acompanhamento extra</p>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Stacked bar */}
                <div className="flex h-8 w-full overflow-hidden rounded-full bg-zinc-100">
                    {segments.map(seg => {
                        const value = values[seg.key] || 0;
                        const pct = (value / total) * 100;
                        if (pct === 0) return null;
                        return (
                            <div
                                key={seg.key}
                                className={`${seg.barColor} flex items-center justify-center text-white text-xs font-medium`}
                                style={{ width: `${pct}%` }}
                                title={`${seg.label}: ${value}`}
                            >
                                {pct > 10 ? value : ''}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {segments.map(seg => {
                        const Icon = seg.icon;
                        const value = values[seg.key] || 0;
                        const pct = ((value / total) * 100).toFixed(0);
                        return (
                            <div key={seg.key} className="flex items-center gap-2">
                                <div className={`rounded-full p-1.5 ${seg.color}`}>
                                    <Icon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                    <p className={`text-sm font-semibold ${seg.textColor}`}>{value}</p>
                                    <p className="text-xs text-zinc-500">{seg.label} ({pct}%)</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
