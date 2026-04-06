'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PhysioTreatmentPlan } from '@/types/database';

const statusLabels: Record<string, string> = {
    active: 'Ativo',
    completed: 'Concluído',
    paused: 'Pausado',
    cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export function TreatmentStatusBadge({ status }: { status: string }) {
    return (
        <Badge className={statusColors[status] || 'bg-zinc-100 text-zinc-800'}>
            {statusLabels[status] || status}
        </Badge>
    );
}

export function TreatmentPlanCard({
    plan,
    sessionsCount,
}: {
    plan: PhysioTreatmentPlan;
    sessionsCount?: number;
}) {
    const progress = plan.estimated_sessions
        ? Math.min(100, Math.round(((sessionsCount || 0) / plan.estimated_sessions) * 100))
        : null;

    return (
        <Card className={plan.status === 'active' ? 'border-emerald-200 bg-emerald-50/30' : ''}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base">{plan.diagnosis}</CardTitle>
                        <p className="text-xs text-zinc-500">
                            {new Date(plan.start_date).toLocaleDateString('pt-BR')}
                            {plan.end_date && ` - ${new Date(plan.end_date).toLocaleDateString('pt-BR')}`}
                        </p>
                    </div>
                    <TreatmentStatusBadge status={plan.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {plan.objectives?.length > 0 && (
                    <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">Objetivos</p>
                        <ul className="list-inside list-disc text-sm text-zinc-700">
                            {plan.objectives.map((obj, i) => (
                                <li key={i}>{obj}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {plan.exercises?.length > 0 && (
                    <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">Exercícios ({plan.exercises.length})</p>
                        <div className="flex flex-wrap gap-1">
                            {plan.exercises.map((ex, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                    {ex.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {plan.modalities?.length > 0 && (
                    <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">Modalidades</p>
                        <div className="flex flex-wrap gap-1">
                            {plan.modalities.map((mod, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                    {mod.name} - {mod.duration}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {progress !== null && (
                    <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                            <span>Progresso</span>
                            <span>{sessionsCount || 0}/{plan.estimated_sessions} sessões</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {plan.frequency && (
                    <p className="text-xs text-zinc-500">Frequência: {plan.frequency}</p>
                )}
            </CardContent>
        </Card>
    );
}
