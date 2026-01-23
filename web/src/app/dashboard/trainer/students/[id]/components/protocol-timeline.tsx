'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import type { ProtocolGroup } from '@/lib/assessment-logic';
import { EvolutionSummary } from './evolution-summary';

interface ProtocolTimelineProps {
    group: ProtocolGroup;
}

export function ProtocolTimeline({ group }: ProtocolTimelineProps) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <h3 className="text-lg font-semibold text-zinc-900">{group.protocolName}</h3>
                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded uppercase">
                            {group.pillar}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-9 p-0"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                        <span className="sr-only">Toggle</span>
                    </Button>
                </div>

                <div className={cn(
                    "space-y-6 transition-all duration-300 ease-in-out",
                    isOpen ? "opacity-100" : "grid-rows-[0fr] opacity-0 h-0 overflow-hidden"
                )}>
                    {/* Evolution Summary Block */}
                    <EvolutionSummary evolution={group.latestEvolution} protocolName={group.protocolName} />

                    {/* Timeline List */}
                    <div className="relative border-l-2 border-zinc-100 ml-4 space-y-8 pb-4 pt-2">
                        {group.assessments.map((assessment) => (
                            <div key={assessment.id} className="relative pl-8">
                                {/* Dot */}
                                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-zinc-300 ring-4 ring-white" />

                                <div className="bg-white rounded-lg border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
                                                <Calendar className="h-4 w-4" />
                                                {formatDate(assessment.performed_at)}
                                            </div>
                                            {assessment.notes && (
                                                <p className="text-sm text-zinc-600 italic bg-zinc-50 px-2 py-1 rounded inline-block mt-1">
                                                    "{assessment.notes}"
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {assessment.results?.map(result => (
                                            <div key={result.id}>
                                                <span className="text-xs text-zinc-500 block">{result.metric?.name}</span>
                                                <span className="font-semibold text-zinc-900">
                                                    {result.value} <span className="text-xs font-normal text-zinc-400">{result.metric?.unit}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
