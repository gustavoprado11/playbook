'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RetentionCorrelation } from '@/app/actions/kpis';

export function RetentionComparison({ data }: { data: RetentionCorrelation[] }) {
    if (data.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-zinc-500 text-sm">
                    Dados insuficientes para análise de retenção por segmento.
                </CardContent>
            </Card>
        );
    }

    const maxRetention = Math.max(...data.map(d => d.retentionRate));
    const minRetention = Math.min(...data.map(d => d.retentionRate));

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Retenção × Acompanhamento</CardTitle>
                <p className="text-sm text-zinc-500">Correlação entre tipo de acompanhamento e permanência do aluno</p>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-50/50">
                            <TableRow>
                                <TableHead>Segmento</TableHead>
                                <TableHead className="text-center">Alunos</TableHead>
                                <TableHead className="text-center">Cancel. 90d</TableHead>
                                <TableHead className="text-center">Retenção</TableHead>
                                <TableHead className="text-center">Tempo Médio</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.segment}>
                                    <TableCell className="font-medium">{row.segment}</TableCell>
                                    <TableCell className="text-center">{row.studentCount}</TableCell>
                                    <TableCell className="text-center">
                                        <span className={cn(row.cancellationsLast90Days > 0 ? 'text-red-600 font-medium' : 'text-zinc-500')}>
                                            {row.cancellationsLast90Days}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={cn(
                                            'font-semibold',
                                            row.retentionRate === maxRetention && data.length > 1 ? 'text-emerald-600' : '',
                                            row.retentionRate === minRetention && maxRetention !== minRetention ? 'text-red-600' : '',
                                        )}>
                                            {row.retentionRate.toFixed(1)}%
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center text-zinc-600">
                                        {row.avgMonthsActive} meses
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <p className="text-xs text-zinc-400 mt-3">
                    * Correlação observada, não implica causalidade. Cancelamentos nos últimos 90 dias.
                </p>
            </CardContent>
        </Card>
    );
}
