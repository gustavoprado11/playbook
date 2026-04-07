'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { ProfessionBadge } from '@/components/profession-badge';
import { formatDate } from '@/lib/utils';
import { exportProfessionalActivityPDF, exportProfessionalActivityXLSX } from '@/lib/export-utils';
import type { ProfessionalActivityReport } from '@/app/actions/reports';
import type { ProfessionType } from '@/types/database';

interface Props {
    report: ProfessionalActivityReport | null;
    selectedMonth: string;
}

export function ProfessionalActivityView({ report, selectedMonth }: Props) {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">Atividade Profissional</h1>
                    <p className="text-zinc-500 text-sm">Consultas, sessões e planos por profissional</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => router.push(`/dashboard/manager/reports/professional-activity?month=${e.target.value}`)}
                    className="w-auto"
                />

                {report && (
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => exportProfessionalActivityPDF(report)}>
                            <FileText className="mr-1.5 h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportProfessionalActivityXLSX(report)}>
                            <Table2 className="mr-1.5 h-4 w-4" /> XLSX
                        </Button>
                    </div>
                )}
            </div>

            {!report || report.rows.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed">
                    Nenhum profissional ativo encontrado.
                </div>
            ) : (
                <div className="rounded-lg border bg-white overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-50/50">
                            <TableRow>
                                <TableHead>Profissional</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-center">Pacientes</TableHead>
                                <TableHead className="text-center">Atividades no Mês</TableHead>
                                <TableHead className="text-center">Planos Ativos</TableHead>
                                <TableHead>Última Atividade</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {report.rows.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.professionalName}</TableCell>
                                    <TableCell>
                                        <ProfessionBadge type={r.professionType as ProfessionType} />
                                    </TableCell>
                                    <TableCell className="text-center">{r.activePatients}</TableCell>
                                    <TableCell className="text-center font-medium">{r.activitiesThisMonth}</TableCell>
                                    <TableCell className="text-center">{r.activePlans}</TableCell>
                                    <TableCell className="text-zinc-500">{r.lastActivityDate ? formatDate(r.lastActivityDate) : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
