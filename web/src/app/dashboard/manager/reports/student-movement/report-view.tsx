'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';
import { exportStudentMovementPDF, exportStudentMovementXLSX } from '@/lib/export-utils';
import type { StudentMovementReport, StudentMovementRow } from '@/app/actions/reports';

const eventLabels: Record<string, string> = {
    new: 'Novo', cancelled: 'Cancelado', paused: 'Pausado', reactivated: 'Reativado', transferred: 'Transferido',
};
const eventColors: Record<string, string> = {
    new: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700', paused: 'bg-amber-100 text-amber-700', reactivated: 'bg-blue-100 text-blue-700', transferred: 'bg-purple-100 text-purple-700',
};

interface Props {
    report: StudentMovementReport | null;
    startDate: string;
    endDate: string;
}

export function StudentMovementView({ report, startDate, endDate }: Props) {
    const router = useRouter();
    const [start, setStart] = useState(startDate);
    const [end, setEnd] = useState(endDate);
    const [filter, setFilter] = useState<string>('all');

    const filtered = report?.rows.filter(r => filter === 'all' || r.eventType === filter) || [];

    function applyDates() {
        router.push(`/dashboard/manager/reports/student-movement?start=${start}&end=${end}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">Movimentação de Alunos</h1>
                    <p className="text-zinc-500 text-sm">Entradas, saídas e transferências no período</p>
                </div>
            </div>

            {/* Date controls */}
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Início</label>
                    <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-auto" />
                </div>
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Fim</label>
                    <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-auto" />
                </div>
                <Button onClick={applyDates} size="sm">Filtrar</Button>

                {report && (
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => exportStudentMovementPDF(report)}>
                            <FileText className="mr-1.5 h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportStudentMovementXLSX(report)}>
                            <Table2 className="mr-1.5 h-4 w-4" /> XLSX
                        </Button>
                    </div>
                )}
            </div>

            {!report ? (
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed">
                    Nenhum evento encontrado no período.
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
                        <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-emerald-600">+{report.summary.newStudents}</p><p className="text-xs text-zinc-500">Novos</p></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-red-600">-{report.summary.cancellations}</p><p className="text-xs text-zinc-500">Cancelados</p></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-amber-600">{report.summary.paused}</p><p className="text-xs text-zinc-500">Pausados</p></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-blue-600">{report.summary.reactivated}</p><p className="text-xs text-zinc-500">Reativados</p></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><p className="text-xl font-bold text-purple-600">{report.summary.transfers}</p><p className="text-xs text-zinc-500">Transferidos</p></CardContent></Card>
                        <Card><CardContent className="p-3 text-center"><p className={cn('text-xl font-bold', report.summary.netChange >= 0 ? 'text-emerald-600' : 'text-red-600')}>{report.summary.netChange >= 0 ? '+' : ''}{report.summary.netChange}</p><p className="text-xs text-zinc-500">Saldo</p></CardContent></Card>
                    </div>

                    {/* Filter */}
                    <div className="flex flex-wrap gap-2">
                        {['all', 'new', 'cancelled', 'paused', 'reactivated', 'transferred'].map(f => (
                            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="rounded-full">
                                {f === 'all' ? 'Todos' : eventLabels[f]}
                            </Button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-zinc-50/50">
                                <TableRow>
                                    <TableHead>Aluno</TableHead>
                                    <TableHead>Treinador</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Detalhes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-zinc-500">Nenhum evento encontrado.</TableCell></TableRow>
                                ) : filtered.map((r, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{r.studentName}</TableCell>
                                        <TableCell className="text-zinc-500">{r.trainerName}</TableCell>
                                        <TableCell>
                                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', eventColors[r.eventType])}>
                                                {eventLabels[r.eventType]}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-zinc-500">{formatDate(r.eventDate)}</TableCell>
                                        <TableCell className="text-zinc-400 text-sm">{r.details || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}
