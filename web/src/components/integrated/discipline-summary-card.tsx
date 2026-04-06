'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfessionBadge } from '@/components/profession-badge';
import { ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ProfessionType } from '@/types/database';

interface DisciplineSummaryCardProps {
    discipline: 'nutritionist' | 'physiotherapist';
    hasLinkedProfessional: boolean;
    professionalName?: string;
    stats: { label: string; value: string | number }[];
    lastActivityDate?: string;
    children?: React.ReactNode;
}

export function DisciplineSummaryCard({
    discipline,
    hasLinkedProfessional,
    professionalName,
    stats,
    lastActivityDate,
    children,
}: DisciplineSummaryCardProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card className="bg-white border-zinc-200">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ProfessionBadge type={discipline as ProfessionType} />
                        {hasLinkedProfessional ? (
                            <span className="text-sm font-medium text-zinc-700">{professionalName}</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                                <UserX className="h-3.5 w-3.5" />
                                Sem profissional vinculado
                            </span>
                        )}
                    </div>
                    {lastActivityDate && (
                        <span className="text-xs text-zinc-400">
                            Última atividade: {formatDate(lastActivityDate)}
                        </span>
                    )}
                </div>

                {/* Mini stats */}
                {stats.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-3">
                        {stats.map((s, i) => (
                            <div key={i} className="text-center">
                                <p className="text-lg font-semibold text-zinc-900">{s.value}</p>
                                <p className="text-xs text-zinc-500">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}
            </CardHeader>

            {children && (
                <>
                    <div className="px-6 pb-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="w-full text-zinc-500 hover:text-zinc-700"
                        >
                            {expanded ? (
                                <>
                                    <ChevronUp className="mr-1.5 h-4 w-4" />
                                    Ocultar detalhes
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="mr-1.5 h-4 w-4" />
                                    Ver detalhes
                                </>
                            )}
                        </Button>
                    </div>
                    {expanded && (
                        <CardContent className="border-t border-zinc-100 pt-4">
                            {children}
                        </CardContent>
                    )}
                </>
            )}
        </Card>
    );
}
