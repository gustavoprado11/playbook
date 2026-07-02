'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, MoreVertical, Pencil, Archive, Search, ClipboardList, Activity, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { assignProgramTemplate, archiveAssignedProgram, startWorkoutLog, createDraftAssignedProgram } from '@/app/actions/prescription';
import { ClearanceBanner } from '@/components/clearances/clearance-banner';
import type { AssignedProgram, ProgramTemplate, WorkoutLog, StudentSessionForLog, StudentClearance } from '@/types/database';

function formatLogDate(d: string) {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

interface StudentPrescriptionProps {
    studentId: string;
    studentName: string;
    assignments: AssignedProgram[];
    templates: ProgramTemplate[];
    logs: WorkoutLog[];
    sessionsForLog: StudentSessionForLog[];
    clearances?: StudentClearance[];
    embedded?: boolean;
}

export function StudentPrescription({ studentId, studentName, assignments, templates, logs, sessionsForLog, clearances, embedded }: StudentPrescriptionProps) {
    const router = useRouter();
    const [assignOpen, setAssignOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [archivingId, setArchivingId] = useState<string | null>(null);
    const [logOpen, setLogOpen] = useState(false);
    const [startingId, setStartingId] = useState<string | null>(null);
    const [creatingNew, setCreatingNew] = useState(false);

    const handleCreateNew = async () => {
        setCreatingNew(true);
        try {
            const assignedId = await createDraftAssignedProgram(studentId);
            toast.success('Programa criado');
            router.push(`/dashboard/trainer/prescricao/alunos/${studentId}/${assignedId}`);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao criar programa');
            setCreatingNew(false);
        }
    };

    const handleStartLog = async (assignedSessionId: string) => {
        setStartingId(assignedSessionId);
        try {
            const logId = await startWorkoutLog(assignedSessionId);
            toast.success('Registro iniciado');
            setLogOpen(false);
            router.push(`/dashboard/trainer/prescricao/alunos/${studentId}/execucoes/${logId}`);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao iniciar registro');
            setStartingId(null);
        }
    };

    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const handleAssign = async (templateId: string) => {
        setAssigningId(templateId);
        try {
            const assignedId = await assignProgramTemplate(templateId, studentId);
            toast.success('Programa atribuído');
            setAssignOpen(false);
            router.push(`/dashboard/trainer/prescricao/alunos/${studentId}/${assignedId}`);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao atribuir programa');
            setAssigningId(null);
        }
    };

    const handleArchive = async () => {
        if (!archivingId) return;
        try {
            await archiveAssignedProgram(archivingId, studentId);
            toast.success('Programa arquivado');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao arquivar');
        } finally {
            setArchivingId(null);
        }
    };

    const actionButtons = (
        <>
            {sessionsForLog.length > 0 && (
                <Button variant="outline" onClick={() => setLogOpen(true)}>
                    <Activity className="mr-2 h-4 w-4" />
                    Registrar execução
                </Button>
            )}
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Atribuir template
            </Button>
            <Button onClick={handleCreateNew} disabled={creatingNew}>
                <Plus className="mr-2 h-4 w-4" />
                {creatingNew ? 'Criando...' : 'Novo programa'}
            </Button>
        </>
    );

    return (
        <div className="space-y-6">
            {embedded ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {actionButtons}
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/trainer/students">
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-zinc-900">{studentName}</h1>
                                <p className="text-sm text-zinc-500">Programas de treino do aluno</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">{actionButtons}</div>
                    </div>
                    {clearances && <ClearanceBanner clearances={clearances} />}
                </>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {assignments.length} programa{assignments.length === 1 ? '' : 's'} atribuído{assignments.length === 1 ? '' : 's'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {assignments.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-500">
                            Nenhum programa ainda. Clique em &quot;Novo programa&quot; para montar do zero, ou &quot;Atribuir template&quot; para partir de um modelo.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Objetivo</TableHead>
                                        <TableHead>Sessões</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-10" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignments.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="font-medium text-zinc-900">
                                                <Link
                                                    href={`/dashboard/trainer/prescricao/alunos/${studentId}/${a.id}`}
                                                    className="hover:text-emerald-700 hover:underline"
                                                >
                                                    {a.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-zinc-600">{a.goal || '—'}</TableCell>
                                            <TableCell className="text-zinc-600">{a.sessions?.length ?? 0}</TableCell>
                                            <TableCell>
                                                <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
                                                    {a.status === 'active' ? 'Ativo' : 'Arquivado'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-white">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/trainer/prescricao/alunos/${studentId}/${a.id}`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {a.status === 'active' && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => setArchivingId(a.id)}
                                                                    className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                                                >
                                                                    <Archive className="mr-2 h-4 w-4" />
                                                                    Arquivar
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Execution history */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-5 w-5" />
                        Histórico de execuções
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="py-8 text-center text-sm text-zinc-500">Nenhuma execução registrada.</p>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {logs.map((l) => {
                                const total = l.sets?.length ?? 0;
                                const done = (l.sets ?? []).filter((s) => s.completed).length;
                                return (
                                    <Link
                                        key={l.id}
                                        href={`/dashboard/trainer/prescricao/alunos/${studentId}/execucoes/${l.id}`}
                                        className="flex items-center justify-between py-3 hover:text-emerald-700"
                                    >
                                        <div>
                                            <span className="font-medium text-zinc-800">{l.session_name ?? 'Sessão'}</span>
                                            <span className="ml-2 text-sm text-zinc-500">{formatLogDate(l.performed_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500">{done}/{total} séries</span>
                                            {l.overall_rpe != null && <Badge variant="secondary">RPE {l.overall_rpe}</Badge>}
                                            <ChevronRight className="h-4 w-4 text-zinc-300" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Register execution dialog */}
            <Dialog open={logOpen} onOpenChange={(open) => !open && setLogOpen(false)}>
                <DialogContent className="max-w-lg bg-white">
                    <DialogHeader>
                        <DialogTitle>Registrar execução</DialogTitle>
                        <DialogDescription>
                            Escolha a sessão que o aluno realizou. Um registro será criado com o prescrito para você preencher os valores reais.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-100 p-1">
                        {sessionsForLog.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-zinc-500">Nenhuma sessão ativa. Atribua um programa primeiro.</p>
                        ) : (
                            sessionsForLog.map((s) => (
                                <button
                                    key={s.assigned_session_id}
                                    type="button"
                                    disabled={!!startingId}
                                    onClick={() => handleStartLog(s.assigned_session_id)}
                                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-emerald-50 disabled:opacity-50"
                                >
                                    <span className="font-medium text-zinc-800">{s.session_name}</span>
                                    <span className="text-xs text-zinc-400">{s.program_name}</span>
                                </button>
                            ))
                        )}
                    </div>
                    {startingId && <p className="mt-2 text-center text-xs text-zinc-500">Preparando registro…</p>}
                </DialogContent>
            </Dialog>

            {/* Assign template dialog */}
            <Dialog open={assignOpen} onOpenChange={(open) => { if (!open) { setAssignOpen(false); setSearch(''); } }}>
                <DialogContent className="max-w-lg bg-white">
                    <DialogHeader>
                        <DialogTitle>Atribuir template a {studentName}</DialogTitle>
                        <DialogDescription>
                            Escolha um programa da biblioteca. Uma cópia (snapshot) será criada para este aluno.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar template..."
                                className="pl-8"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-100 p-1">
                            {filteredTemplates.length === 0 ? (
                                <p className="px-2 py-6 text-center text-sm text-zinc-500">
                                    Nenhum template encontrado.
                                </p>
                            ) : (
                                filteredTemplates.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={!!assigningId}
                                        onClick={() => handleAssign(t.id)}
                                        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-emerald-50 disabled:opacity-50"
                                    >
                                        <span className="flex items-center gap-2 font-medium text-zinc-800">
                                            <ClipboardList className="h-4 w-4 text-zinc-400" />
                                            {t.name}
                                        </span>
                                        {t.goal && <span className="text-xs text-zinc-400">{t.goal}</span>}
                                    </button>
                                ))
                            )}
                        </div>
                        {assigningId && <p className="text-center text-xs text-zinc-500">Criando cópia para o aluno…</p>}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Archive confirmation */}
            <AlertDialog open={!!archivingId} onOpenChange={(open) => !open && setArchivingId(null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar programa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O programa deixará de aparecer como ativo para este aluno.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700">
                            Sim, arquivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
