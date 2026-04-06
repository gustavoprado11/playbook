'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dumbbell, UtensilsCrossed, Activity, Settings } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { TimelineEvent } from '@/app/actions/integrated';

const disciplineConfig = {
    training: { label: 'Treino', color: 'bg-emerald-600', textColor: 'text-emerald-600', icon: Dumbbell },
    nutrition: { label: 'Nutrição', color: 'bg-amber-500', textColor: 'text-amber-600', icon: UtensilsCrossed },
    physiotherapy: { label: 'Fisioterapia', color: 'bg-blue-600', textColor: 'text-blue-600', icon: Activity },
    admin: { label: 'Admin', color: 'bg-zinc-400', textColor: 'text-zinc-500', icon: Settings },
};

interface IntegratedTimelineProps {
    events: TimelineEvent[];
}

export function IntegratedTimeline({ events }: IntegratedTimelineProps) {
    const [filters, setFilters] = useState<Set<string>>(new Set(['training', 'nutrition', 'physiotherapy', 'admin']));

    const toggleFilter = (d: string) => {
        setFilters(prev => {
            const next = new Set(prev);
            if (next.has(d)) next.delete(d);
            else next.add(d);
            return next;
        });
    };

    const filtered = useMemo(
        () => events.filter(e => filters.has(e.discipline)),
        [events, filters]
    );

    if (events.length === 0) {
        return (
            <div className="text-center py-12 text-zinc-500 text-sm">
                Nenhum evento registrado para este aluno.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter toggles */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(disciplineConfig).map(([key, config]) => {
                    const active = filters.has(key);
                    const Icon = config.icon;
                    return (
                        <Button
                            key={key}
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleFilter(key)}
                            className="rounded-full gap-1.5"
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {config.label}
                        </Button>
                    );
                })}
            </div>

            {/* Timeline */}
            <div className="relative pl-8">
                {/* Vertical line */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-zinc-200" />

                <div className="space-y-4">
                    {filtered.map((event) => {
                        const config = disciplineConfig[event.discipline];
                        const Icon = config.icon;

                        return (
                            <div key={`${event.type}-${event.id}`} className="relative flex gap-4">
                                {/* Dot */}
                                <div className={`absolute -left-5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full ${config.color}`}>
                                    <Icon className="h-3 w-3 text-white" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 rounded-lg border border-zinc-100 bg-white p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">
                                                {event.title}
                                            </p>
                                            {event.description && (
                                                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                                                    {event.description}
                                                </p>
                                            )}
                                            {event.professional && (
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    {event.professional}
                                                </p>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-xs text-zinc-400">
                                            {formatDate(event.date)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {filtered.length === 0 && (
                <p className="text-center text-sm text-zinc-400 py-4">
                    Nenhum evento para os filtros selecionados.
                </p>
            )}
        </div>
    );
}
