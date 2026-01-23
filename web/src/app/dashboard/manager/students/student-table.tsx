'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Badge not used

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
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
import { cn, formatDate } from '@/lib/utils';
import {
    Search,
    MoreVertical,
    User,
    Archive,
    RefreshCcw,
    UserX,
    UserCheck,
    Pencil,
    Filter
} from 'lucide-react';
import type { Student, Trainer, Profile } from '@/types/database';
import { updateStudent, archiveStudent, unarchiveStudent } from '@/app/actions/manager';
import { EditStudentDialog } from './edit-student-dialog';

interface ExtendedStudent extends Student {
    trainer?: Trainer & { profile?: Profile };
}

interface ManagerStudentTableProps {
    students: ExtendedStudent[];
    trainers: (Trainer & { profile: Profile })[];
}

type FilterStatus = 'all' | 'active' | 'paused' | 'cancelled' | 'archived';

export function ManagerStudentTable({ students, trainers }: ManagerStudentTableProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterStatus>('active');
    const [isLoading, setIsLoading] = useState(false);

    // Action State
    const [studentToArchive, setStudentToArchive] = useState<ExtendedStudent | null>(null);
    const [studentToEdit, setStudentToEdit] = useState<ExtendedStudent | null>(null);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            // Archive Filter Logic
            if (filter === 'archived') {
                if (!s.is_archived) return false;
            } else {
                if (s.is_archived) return false; // Hide archived by default for other filters
                if (filter !== 'all' && s.status !== filter) return false;
            }

            // Search Logic
            if (search) {
                const searchLower = search.toLowerCase();
                return (
                    s.full_name.toLowerCase().includes(searchLower) ||
                    s.email?.toLowerCase().includes(searchLower) ||
                    s.trainer?.profile?.full_name.toLowerCase().includes(searchLower)
                );
            }
            return true;
        });
    }, [students, search, filter]);

    const handleArchive = async () => {
        if (!studentToArchive) return;
        setIsLoading(true);
        try {
            await archiveStudent(studentToArchive.id);
            setStudentToArchive(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao arquivar aluno');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnarchive = async (id: string) => {
        setIsLoading(true);
        try {
            await unarchiveStudent(id);
        } catch (error) {
            console.error(error);
            alert('Erro ao desarquivar aluno');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = async (student: ExtendedStudent, newStatus: 'active' | 'paused' | 'cancelled') => {
        if (!confirm(`Deseja alterar o status para ${newStatus}?`)) return;

        setIsLoading(true);
        try {
            await updateStudent(student.id, { status: newStatus });
        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar status');
        } finally {
            setIsLoading(false);
        }
    };

    const statusColors = {
        active: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-red-100 text-red-700',
        paused: 'bg-amber-100 text-amber-700',
    };

    const statusLabels = {
        active: 'Ativo',
        cancelled: 'Cancelado',
        paused: 'Pausado',
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    <Button
                        variant={filter === 'active' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('active')}
                        className="rounded-full"
                    >
                        Ativos
                    </Button>
                    <Button
                        variant={filter === 'paused' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('paused')}
                        className="rounded-full"
                    >
                        Pausados
                    </Button>
                    <Button
                        variant={filter === 'cancelled' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('cancelled')}
                        className="rounded-full"
                    >
                        Cancelados
                    </Button>
                    <div className="h-4 w-px bg-zinc-200 mx-1" />
                    <Button
                        variant={filter === 'archived' ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('archived')}
                        className="rounded-full text-zinc-500"
                    >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivados
                    </Button>
                    <Button
                        variant={filter === 'all' ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="rounded-full text-zinc-500"
                    >
                        Todos
                    </Button>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Buscar aluno..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-zinc-50/50">
                        <TableRow>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Treinador</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Ínicio</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                    Nenhum aluno encontrado nesta visualização.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                                <TableRow key={student.id} className="hover:bg-zinc-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zinc-900">{student.full_name}</p>
                                                <p className="text-xs text-zinc-500">{student.email || '-'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-600">
                                        {student.trainer?.profile?.full_name || '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={cn(
                                            "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                                            statusColors[student.status]
                                        )}>
                                            {statusLabels[student.status]}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-zinc-600">
                                        {formatDate(student.start_date)}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setStudentToEdit(student)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Editar Dados
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />

                                                <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                                {student.status !== 'active' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange(student, 'active')}>
                                                        <UserCheck className="mr-2 h-4 w-4 text-emerald-600" />
                                                        Ativar
                                                    </DropdownMenuItem>
                                                )}
                                                {student.status !== 'paused' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange(student, 'paused')}>
                                                        <RefreshCcw className="mr-2 h-4 w-4 text-amber-600" />
                                                        Pausar
                                                    </DropdownMenuItem>
                                                )}
                                                {student.status !== 'cancelled' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange(student, 'cancelled')}>
                                                        <UserX className="mr-2 h-4 w-4 text-red-600" />
                                                        Cancelar
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator />

                                                {student.is_archived ? (
                                                    <DropdownMenuItem onClick={() => handleUnarchive(student.id)}>
                                                        <RefreshCcw className="mr-2 h-4 w-4" />
                                                        Desarquivar
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => setStudentToArchive(student)} className="text-red-600 focus:text-red-600">
                                                        <Archive className="mr-2 h-4 w-4" />
                                                        Arquivar
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Archive Dialog */}
            <AlertDialog open={!!studentToArchive} onOpenChange={(open) => !open && setStudentToArchive(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar Aluno?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O aluno <strong>{studentToArchive?.full_name}</strong> deixará de aparecer nas listas operacionais e não contará mais para os KPIs futuros.
                            <br /><br />
                            O histórico de avaliações será preservado. Esta ação pode ser desfeita filtrando por "Arquivados".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700">
                            Confirmar Arquivamento
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Dialog */}
            <EditStudentDialog
                student={studentToEdit}
                trainers={trainers}
                open={!!studentToEdit}
                onOpenChange={(open) => !open && setStudentToEdit(null)}
            />
        </div>
    );
}
