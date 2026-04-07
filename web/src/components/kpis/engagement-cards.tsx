'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EngagementKPI } from '@/app/actions/kpis';

const disciplineConfig = {
    nutrition: { label: 'Nutrição', icon: UtensilsCrossed, color: 'text-amber-600', progressColor: 'bg-amber-500', bgColor: 'bg-amber-100' },
    physiotherapy: { label: 'Fisioterapia', icon: Activity, color: 'text-blue-600', progressColor: 'bg-blue-500', bgColor: 'bg-blue-100' },
};

export function EngagementCards({ engagement }: { engagement: EngagementKPI[] }) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {engagement.map(e => {
                const config = disciplineConfig[e.discipline];
                const Icon = config.icon;
                const rate = Math.min(100, e.engagementRate);

                return (
                    <Card key={e.discipline}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <div className={cn('rounded-lg p-2', config.bgColor)}>
                                    <Icon className={cn('h-5 w-5', config.color)} />
                                </div>
                                <CardTitle className="text-base">{config.label}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Engagement rate */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1.5">
                                    <span className="text-zinc-500">Engajamento no mês</span>
                                    <span className="font-semibold">{rate.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-zinc-100">
                                    <div className={cn('h-full rounded-full transition-all', config.progressColor)} style={{ width: `${rate}%` }} />
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                    <p className="text-lg font-semibold text-zinc-900">{e.activeThisMonth}/{e.totalLinked}</p>
                                    <p className="text-xs text-zinc-500">Ativos/Vinculados</p>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-zinc-900">{e.avgActivitiesPerStudent.toFixed(1)}</p>
                                    <p className="text-xs text-zinc-500">Média/aluno</p>
                                </div>
                                <div>
                                    <p className={cn('text-lg font-semibold', e.inactiveOver30Days > 0 ? 'text-red-600' : 'text-zinc-900')}>
                                        {e.inactiveOver30Days}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {e.inactiveOver30Days > 0 && <AlertCircle className="inline h-3 w-3 text-red-500 mr-0.5" />}
                                        Inativos 30d+
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
