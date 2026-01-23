'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn, formatDate } from '@/lib/utils';
import { Search, MoreVertical, User, Archive, RefreshCcw, Pencil, Power, UserX, UserCheck } from 'lucide-react';
import type { Trainer, Profile } from '@/types/database';
import { toggleTrainerStatus } from '@/app/actions/manager';
import { EditTrainerDialog } from './edit-trainer-dialog';

interface ExtendedTrainer extends Trainer {
    profile?: Profile;
    stats?: {
        activeStudents: number;
        managementRate?: number;
        retentionRate?: number;
        referrals?: number;
    };
}

interface ManagerTrainerTableProps {
    trainers: ExtendedTrainer[];
}

export function ManagerTrainerTable({ trainers }: ManagerTrainerTableProps) {
    const [search, setSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Action State
    const [trainerToEdit, setTrainerToEdit] = useState<ExtendedTrainer | null>(null);
    const [trainerToToggle, setTrainerToToggle] = useState<ExtendedTrainer | null>(null);

    const filteredTrainers = useMemo(() => {
        return trainers.filter(t => {
            const matchesSearch =
                t.profile?.full_name.toLowerCase().includes(search.toLowerCase()) ||
                t.profile?.email.toLowerCase().includes(search.toLowerCase());

            const matchesStatus = showArchived ? !t.is_active : t.is_active;

            return matchesSearch && matchesStatus;
        });
    }, [trainers, search, showArchived]);

    const handleToggleStatus = async () => {
        if (!trainerToToggle) return;
        setIsLoading(true);
        try {
            await toggleTrainerStatus(trainerToToggle.id, !trainerToToggle.is_active);
            setTrainerToToggle(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao alterar status do treinador');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant={!showArchived ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowArchived(false)}
                        className="rounded-full"
                    >
                        Ativos
                    </Button>
                    <Button
                        variant={showArchived ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setShowArchived(true)}
                        className="rounded-full text-zinc-500"
                    >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivados
                    </Button>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Buscar treinador..."
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
                            <TableHead>Treinador</TableHead>
                            <TableHead className="text-center">Alunos Ativos</TableHead>
                            <TableHead className="text-center">Gestão (30d)</TableHead>
                            <TableHead className="text-center">Retenção</TableHead>
                            <TableHead>Início</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTrainers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                                    Nenhum treinador encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTrainers.map((trainer) => (
                                <TableRow key={trainer.id} className="hover:bg-zinc-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zinc-900">{trainer.profile?.full_name}</p>
                                                <p className="text-xs text-zinc-500">{trainer.profile?.email || '-'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                        {trainer.stats?.activeStudents || 0}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {trainer.stats?.managementRate !== undefined ? (
                                            <Badge variant={trainer.stats.managementRate >= 90 ? 'default' : 'secondary'} className={
                                                trainer.stats.managementRate >= 90 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                                                    'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                            }>
                                                {trainer.stats.managementRate}%
                                            </Badge>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {trainer.stats?.retentionRate !== undefined ? `${trainer.stats.retentionRate}%` : '-'}
                                    </TableCell>
                                    <TableCell className="text-zinc-600">
                                        {formatDate(trainer.start_date)}
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
                                                <DropdownMenuItem onClick={() => setTrainerToEdit(trainer)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Editar Dados
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />

                                                {trainer.is_active ? (
                                                    <DropdownMenuItem onClick={() => setTrainerToToggle(trainer)} className="text-red-600 focus:text-red-600">
                                                        <Archive className="mr-2 h-4 w-4" />
                                                        Arquivar
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => setTrainerToToggle(trainer)} className="text-emerald-600 focus:text-emerald-600">
                                                        <UserCheck className="mr-2 h-4 w-4" />
                                                        Reativar
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

            {/* Archive/Reactivate Dialog */}
            <AlertDialog open={!!trainerToToggle} onOpenChange={(open) => !open && setTrainerToToggle(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {trainerToToggle?.is_active ? 'Arquivar Treinador?' : 'Reativar Treinador?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {trainerToToggle?.is_active
                                ? `O treinador ${trainerToToggle?.profile?.full_name} deixará de ter acesso ao sistema e não aparecerá nas listas ativas.`
                                : `O treinador ${trainerToToggle?.profile?.full_name} voltará a ter acesso ao sistema e aparecerá nas listas ativas.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            className={trainerToToggle?.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Dialog */}
            {trainerToEdit && (
                <EditTrainerDialog
                    trainer={trainerToEdit}
                    open={!!trainerToEdit}
                    onOpenChange={(open) => !open && setTrainerToEdit(null)}
                />
            )}
        </div>
    );
}
