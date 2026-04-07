'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Table2, Dumbbell, UtensilsCrossed, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';
import { ProfessionBadge } from '@/components/profession-badge';
import { exportStudentEvolutionPDF, exportStudentEvolutionXLSX } from '@/lib/export-utils';
import type { StudentEvolutionReport } from '@/app/actions/reports';
import type { ProfessionType } from '@/types/database';

const disciplineConfig: Record<string, { label: string; color: string; icon: typeof Dumbbell }> = {
    training: { label: 'Treino', color: 'bg-emerald-100 text-emerald-700', icon: Dumbbell },
    nutrition: { label: 'Nutrição', color: 'bg-amber-100 text-amber-700', icon: UtensilsCrossed },
    physiotherapy: { label: 'Fisioterapia', color: 'bg-blue-100 text-blue-700', icon: Activity },
};

interface Props {
    report: StudentEvolutionReport | null;
    students: { id: string; name: string }[];
    selectedStudentId: string;
    startDate: string;
    endDate: string;
}

export function StudentEvolutionView({ report, students, selectedStudentId, startDate, endDate }: Props) {
    const router = useRouter();
    const [studentId, setStudentId] = useState(selectedStudentId);
    const [start, setStart] = useState(startDate);
    const [end, setEnd] = useState(endDate);
    const [search, setSearch] = useState('');

    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    function apply() {
        if (!studentId) return;
        router.push(`/dashboard/manager/reports/student-evolution?studentId=${studentId}&start=${start}&end=${end}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">Evolução do Aluno</h1>
                    <p className="text-zinc-500 text-sm">Timeline integrada de treino, nutrição e fisioterapia</p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="w-64">
                    <label className="text-xs text-zinc-500 mb-1 block">Aluno</label>
                    <select
                        value={studentId}
                        onChange={e => setStudentId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Selecionar aluno...</option>
                        {filteredStudents.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Início</label>
                    <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-auto" />
                </div>
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Fim</label>
                    <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-auto" />
                </div>
                <Button onClick={apply} size="sm" disabled={!studentId}>Gerar</Button>

                {report && (
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={() => exportStudentEvolutionPDF(report)}>
                            <FileText className="mr-1.5 h-4 w-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportStudentEvolutionXLSX(report)}>
                            <Table2 className="mr-1.5 h-4 w-4" /> XLSX
                        </Button>
                    </div>
                )}
            </div>

            {!report ? (
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed">
                    {studentId ? 'Nenhum evento encontrado no período.' : 'Selecione um aluno para gerar o relatório.'}
                </div>
            ) : (
                <>
                    {/* Student info */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <div>
                                    <p className="font-semibold text-zinc-900">{report.studentName}</p>
                                    <p className="text-sm text-zinc-500">Treinador: {report.trainerName}</p>
                                </div>
                                {report.linkedProfessionals.length > 0 && (
                                    <div className="flex gap-2">
                                        {report.linkedProfessionals.map((p, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <ProfessionBadge type={p.type as ProfessionType} />
                                                <span className="text-sm text-zinc-600">{p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <span className="text-xs text-zinc-400 ml-auto">{report.rows.length} eventos no período</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <div className="rounded-lg border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-zinc-50/50">
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Disciplina</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descrição</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {report.rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-zinc-500">Nenhum evento no período.</TableCell></TableRow>
                                ) : report.rows.map((r, i) => {
                                    const config = disciplineConfig[r.discipline];
                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="text-zinc-500">{formatDate(r.date)}</TableCell>
                                            <TableCell>
                                                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', config?.color)}>
                                                    {config?.label || r.discipline}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{r.type}</TableCell>
                                            <TableCell className="text-zinc-500 text-sm max-w-xs truncate">{r.description}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}
