'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    Search,
    MoreVertical,
    History,
    PlusCircle,
    Users,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ArrowUpDown,
    Archive,
    ArrowRightLeft,
} from 'lucide-react';
import Link from 'next/link';
import { trainerArchiveStudent, trainerTransferStudent } from '@/app/actions/manager';
import type { Profile } from '@/types/database';
import type { Student } from '@/types/database';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrainerOption {
    id: string;
    profile: Pick<Profile, 'full_name'>;
}

interface StudentTableProps {
    students: Student[];
    assessmentMap: Map<string, string>; // studentId -> date
    trainers?: TrainerOption[];
}

type FilterStatus = 'all' | 'late' | 'on_time' | 'due_soon';
type SortField = 'name' | 'last_assessment' | 'status';

export function StudentTable({ students, assessmentMap, trainers = [] }: StudentTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [sort, setSort] = useState<SortField>('status');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
    const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [isPending, startTransition] = useTransition();

    const today = new Date();
    const windowDays = 60;

    // Helper to calculate student status
    const getStudentStatus = (student: Student) => {
        const lastDateStr = assessmentMap.get(student.id);
        const lastDate = lastDateStr ? new Date(lastDateStr) : null;

        let status: 'late' | 'on_time' | 'due_soon' = 'late';
        let daysDiff = 0;
        let nextDueDate = addDays(today, -1); // Default to past

        if (lastDate) {
            daysDiff = differenceInDays(today, lastDate);
            nextDueDate = addDays(lastDate, windowDays);
            const daysUntilDue = differenceInDays(nextDueDate, today);

            if (daysDiff > windowDays) {
                status = 'late';
            } else if (daysUntilDue <= 7) {
                status = 'due_soon';
            } else {
                status = 'on_time';
            }
        } else {
            status = 'late'; // Never assessed = late
            nextDueDate = today; // Due immediately
        }

        return { status, lastDate, nextDueDate, daysDiff };
    };

    // Filter and Sort
    const filteredStudents = useMemo(() => {
        return students
            .map(s => ({ ...s, ...getStudentStatus(s) }))
            .filter(s => {
                // Search
                if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())) return false;

                // Filter
                if (filter === 'late') return s.status === 'late';
                if (filter === 'on_time') return s.status === 'on_time';
                if (filter === 'due_soon') return s.status === 'due_soon'; // A subset of on_time/late technically, but here defined status

                return true;
            })
            .sort((a, b) => {
                const dir = sortDirection === 'asc' ? 1 : -1;

                if (sort === 'name') {
                    return a.full_name.localeCompare(b.full_name) * dir;
                }
                if (sort === 'last_assessment') {
                    const dateA = a.lastDate?.getTime() || 0;
                    const dateB = b.lastDate?.getTime() || 0;
                    return (dateA - dateB) * dir;
                }
                if (sort === 'status') {
                    // Priority: Late > Due Soon > On Time
                    const priority = { late: 0, due_soon: 1, on_time: 2 };
                    return (priority[a.status] - priority[b.status]) * dir;
                }
                return 0;
            });
    }, [students, assessmentMap, search, filter, sort, sortDirection]);

    // Stats
    const stats = useMemo(() => {
        const processed = students.map(s => getStudentStatus(s));
        return {
            total: students.length,
            onTime: processed.filter(s => s.status === 'on_time' || s.status === 'due_soon').length,
            late: processed.filter(s => s.status === 'late').length,
            dueSoon: processed.filter(s => s.status === 'due_soon').length
        };
    }, [students, assessmentMap]);

    const toggleSort = (field: SortField) => {
        if (sort === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSort(field);
            setSortDirection('asc');
        }
    };

    function handleArchive() {
        if (!archiveTarget) return;
        startTransition(async () => {
            try {
                await trainerArchiveStudent(archiveTarget.id);
                toast.success(`${archiveTarget.name} foi arquivado`);
                setArchiveTarget(null);
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao arquivar aluno');
            }
        });
    }

    function handleTransfer() {
        if (!transferTarget || !selectedTrainerId) return;
        startTransition(async () => {
            try {
                await trainerTransferStudent(transferTarget.id, selectedTrainerId);
                toast.success(`${transferTarget.name} foi transferido`);
                setTransferTarget(null);
                setSelectedTrainerId('');
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao transferir aluno');
            }
        });
    }

    return (
        <div className="space-y-6">
            {/* Header Stats & Controls */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                        <Users className="h-5 w-5 text-zinc-500" />
                        Visão Geral da Carteira
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-zinc-900">{stats.onTime}/{stats.total}</span>
                        <span className="text-sm text-zinc-500">alunos com avaliação em dia</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="rounded-full"
                    >
                        Todos
                    </Button>
                    <Button
                        variant={filter === 'late' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('late')}
                        className={cn("rounded-full gap-2", filter === 'late' && "bg-red-600 hover:bg-red-700")}
                    >
                        <AlertCircle className="h-4 w-4" />
                        Em Atraso ({stats.late})
                    </Button>
                    <Button
                        variant={filter === 'due_soon' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('due_soon')}
                        className={cn("rounded-full gap-2", filter === 'due_soon' && "bg-amber-100 text-amber-900 border-amber-200")}
                    >
                        <Calendar className="h-4 w-4" />
                        Vencendo ({stats.dueSoon})
                    </Button>
                    <Button
                        variant={filter === 'on_time' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('on_time')}
                        className={cn("rounded-full gap-2", filter === 'on_time' && "bg-emerald-100 text-emerald-900 border-emerald-200")}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Em Dia
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                    placeholder="Buscar aluno por nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 max-w-md bg-white"
                />
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-zinc-50/50">
                        <TableRow>
                            <TableHead className="w-[30%] cursor-pointer hover:text-zinc-900" onClick={() => toggleSort('name')}>
                                <div className="flex items-center gap-1">
                                    Aluno
                                    <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:text-zinc-900" onClick={() => toggleSort('status')}>
                                <div className="flex items-center gap-1">
                                    Status
                                    <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:text-zinc-900" onClick={() => toggleSort('last_assessment')}>
                                <div className="flex items-center gap-1">
                                    Última Avaliação
                                    <ArrowUpDown className="h-3 w-3" />
                                </div>
                            </TableHead>
                            <TableHead>Próxima Ação</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                    Nenhum aluno encontrado com os filtros atuais.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student.id} className="group hover:bg-zinc-50/50">
                                    <TableCell className="font-medium text-zinc-900">
                                        <div className="flex flex-col">
                                            <span>{student.full_name}</span>
                                            <span className="text-xs text-zinc-500 font-normal">
                                                Início: {new Date(student.start_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {student.status === 'late' && (
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                                Em Atraso
                                            </span>
                                        )}
                                        {student.status === 'due_soon' && (
                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                                Vence em breve
                                            </span>
                                        )}
                                        {student.status === 'on_time' && (
                                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                                Em Dia
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-zinc-900">
                                                {student.lastDate
                                                    ? format(student.lastDate, "dd 'de' MMM, yyyy", { locale: ptBR })
                                                    : 'Nunca avaliado'}
                                            </span>
                                            {student.lastDate && (
                                                <span className="text-xs text-zinc-500">
                                                    há {student.daysDiff} dias
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "text-sm font-medium",
                                                student.status === 'late' ? "text-red-600" : "text-zinc-700"
                                            )}>
                                                Avaliar até {format(student.nextDueDate, "dd/MM", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-white">
                                                <Link href={`/dashboard/trainer/students/${student.id}`}>
                                                    <DropdownMenuItem>
                                                        <History className="mr-2 h-4 w-4" />
                                                        Ver Histórico
                                                    </DropdownMenuItem>
                                                </Link>
                                                <Link href={`/dashboard/trainer/students/${student.id}?action=new-assessment`}>
                                                    <DropdownMenuItem>
                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                        Nova Avaliação
                                                    </DropdownMenuItem>
                                                </Link>
                                                {trainers.length > 0 && (
                                                    <DropdownMenuItem
                                                        onClick={() => setTransferTarget({ id: student.id, name: student.full_name })}
                                                    >
                                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                                        Transferir aluno
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setArchiveTarget({ id: student.id, name: student.full_name })}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Archive className="mr-2 h-4 w-4" />
                                                    Arquivar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!archiveTarget} onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar aluno</AlertDialogTitle>
                        <AlertDialogDescription>
                            O aluno será removido da sua lista e de todos os horários da agenda.
                            Esta ação pode ser desfeita pelo gestor.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleArchive}
                            disabled={isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isPending ? 'Arquivando...' : 'Arquivar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!transferTarget} onOpenChange={(v) => { if (!v) { setTransferTarget(null); setSelectedTrainerId(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transferir aluno</DialogTitle>
                        <DialogDescription>
                            {transferTarget?.name} será transferido para outro treinador e removido da sua lista e agenda.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium text-zinc-700 mb-2 block">
                            Treinador destino
                        </label>
                        <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecionar treinador" />
                            </SelectTrigger>
                            <SelectContent>
                                {trainers.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.profile.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setTransferTarget(null); setSelectedTrainerId(''); }} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button onClick={handleTransfer} disabled={isPending || !selectedTrainerId}>
                            {isPending ? 'Transferindo...' : 'Transferir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
