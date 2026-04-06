'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { NutritionLabResult, LabResultEntry } from '@/types/database';

const statusColors: Record<string, string> = {
    normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    low: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels: Record<string, string> = {
    normal: 'Normal',
    low: 'Baixo',
    high: 'Alto',
};

interface LabResultCardProps {
    result: NutritionLabResult;
}

export function LabResultCard({ result }: LabResultCardProps) {
    const entries = Object.entries(result.results || {}) as [string, LabResultEntry][];

    return (
        <Card className="border-zinc-200">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base font-medium text-zinc-900">{result.exam_type}</CardTitle>
                    <span className="text-xs text-zinc-500">{formatDate(result.exam_date)}</span>
                </div>
            </CardHeader>
            <CardContent>
                {entries.length > 0 ? (
                    <div className="space-y-2">
                        {entries.map(([name, entry]) => (
                            <div key={name} className="flex items-center justify-between text-sm py-1 border-b border-zinc-50 last:border-0">
                                <span className="text-zinc-700 font-medium">{name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-600">
                                        {entry.value} {entry.unit}
                                    </span>
                                    <span className="text-xs text-zinc-400">Ref: {entry.reference}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColors[entry.status] || 'bg-zinc-100 text-zinc-600'}`}>
                                        {statusLabels[entry.status] || entry.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500">Nenhum resultado registrado.</p>
                )}
                {result.notes && (
                    <p className="text-sm text-zinc-500 mt-3 border-t border-zinc-100 pt-2">
                        <span className="font-medium text-zinc-700">Obs:</span> {result.notes}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
