'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { exportPerformancePDF, exportPerformanceXLSX } from '@/lib/export-utils';
import type { PerformanceReport } from '@/app/actions/reports';

function fmt(v: number) { return `${v.toFixed(1)}%`; }
function curr(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }

interface Props {
    report: PerformanceReport | null;
    months: string[];
    selectedMonth: string;
}

export function PerformanceReportView({ report, months, selectedMonth }: Props) {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">Performance Mensal</h1>
                    <p className="text-zinc-500 text-sm">KPIs de retenção, indicações e gestão por treinador</p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={selectedMonth}
                    onChange={(e) => router.push(`/dashboard/manager/reports/performance?month=${e.target.value}`)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                    {months.length === 0 && <option value="">Nenhum snapshot</option>}
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                {report && (
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => exportPerformancePDF(report)}>
                            <FileText className="mr-1.5 h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportPerformanceXLSX(report)}>
                            <Table2 className="mr-1.5 h-4 w-4" /> XLSX
                        </Button>
                    </div>
                )}
            </div>

            {!report ? (
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed">
                    Nenhum snapshot de performance encontrado para este período.
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{fmt(report.totals.avgRetention)}</p><p className="text-xs text-zinc-500">Retenção Média</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{report.totals.totalReferrals}</p><p className="text-xs text-zinc-500">Total Indicações</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-zinc-900">{fmt(report.totals.avgManagement)}</p><p className="text-xs text-zinc-500">Gestão Média</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{curr(report.totals.totalRewards)}</p><p className="text-xs text-zinc-500">Total Recompensas</p></CardContent></Card>
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-zinc-50/50">
                                <TableRow>
                                    <TableHead>Treinador</TableHead>
                                    <TableHead className="text-center">Alunos</TableHead>
                                    <TableHead className="text-center">Cancel.</TableHead>
                                    <TableHead className="text-center">Retenção</TableHead>
                                    <TableHead className="text-center">Indicações</TableHead>
                                    <TableHead className="text-center">Gestão</TableHead>
                                    <TableHead className="text-right">Recompensa</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.rows.map((r, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{r.trainerName}</TableCell>
                                        <TableCell className="text-center">{r.studentsStart}</TableCell>
                                        <TableCell className="text-center">{r.cancellations}</TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn('font-medium', r.retentionAchieved ? 'text-emerald-600' : 'text-red-600')}>
                                                {fmt(r.retentionRate)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn('font-medium', r.referralsAchieved ? 'text-emerald-600' : 'text-red-600')}>
                                                {r.referralsCount}/{r.referralsTarget}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn('font-medium', r.managementAchieved ? 'text-emerald-600' : 'text-red-600')}>
                                                {fmt(r.managementRate)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{curr(r.rewardAmount)}</TableCell>
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
