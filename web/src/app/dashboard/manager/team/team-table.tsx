'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import {
    Search, MoreVertical, User, Archive, UserCheck, KeyRound, Pencil,
    Plus, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import { ProfessionBadge } from '@/components/profession-badge';
import type { TeamMember, ProfessionType } from '@/types/database';
import { toggleTrainerStatus } from '@/app/actions/manager';
import { toggleProfessionalStatus, resetProfessionalPassword } from '@/app/actions/professionals';
import { EditTrainerDialog } from '@/app/dashboard/manager/trainers/edit-trainer-dialog';
import { ResetPasswordDialog } from '@/app/dashboard/manager/trainers/reset-password-dialog';
import { toast } from 'sonner';

type TypeFilter = 'all' | 'trainer' | 'nutritionist' | 'physiotherapist';

interface TeamTableProps {
    members: TeamMember[];
}

export function TeamTable({ members }: TeamTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialType = (searchParams.get('type') as TypeFilter) || 'all';

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialType);
    const [showInactive, setShowInactive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Trainer action states
    const [trainerToEdit, setTrainerToEdit] = useState<TeamMember | null>(null);
    const [trainerToResetPassword, setTrainerToResetPassword] = useState<TeamMember | null>(null);
    const [memberToToggle, setMemberToToggle] = useState<TeamMember | null>(null);

    // Professional reset password state
    const [profResetDialog, setProfResetDialog] = useState<TeamMember | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const filtered = useMemo(() => {
        return members.filter(m => {
            const matchesSearch = !search ||
                m.name.toLowerCase().includes(search.toLowerCase()) ||
                m.email.toLowerCase().includes(search.toLowerCase());
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            const matchesStatus = showInactive || m.isActive;
            return matchesSearch && matchesType && matchesStatus;
        });
    }, [members, search, typeFilter, showInactive]);

    const handleToggleStatus = async () => {
        if (!memberToToggle) return;
        setIsLoading(true);
        try {
            if (memberToToggle.type === 'trainer') {
                await toggleTrainerStatus(memberToToggle.id, !memberToToggle.isActive);
            } else {
                await toggleProfessionalStatus(memberToToggle.id);
            }
            setMemberToToggle(null);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao alterar status');
        } finally {
            setIsLoading(false);
        }
    };

    async function handleResetProfPassword() {
        if (!profResetDialog) return;
        setResetLoading(true);
        const result = await resetProfessionalPassword(profResetDialog.id, password, confirmPassword);
        setResetLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Senha redefinida com sucesso');
            setProfResetDialog(null);
            setPassword('');
            setConfirmPassword('');
        }
    }

    // Convert TeamMember to trainer format for existing dialogs
    const toTrainerFormat = (m: TeamMember) => ({
        id: m.trainerId || m.id,
        profile_id: m.profileId,
        start_date: m.startDate,
        is_active: m.isActive,
        notes: m.notes,
        created_at: '',
        updated_at: '',
        profile: {
            id: m.profileId,
            email: m.email,
            full_name: m.name,
            role: 'trainer' as const,
            profession_type: null,
            avatar_url: m.avatarUrl,
            created_at: '',
            updated_at: '',
        },
    });

    const typeFilterOptions: { value: TypeFilter; label: string }[] = [
        { value: 'all', label: 'Todos' },
        { value: 'trainer', label: 'Treinadores' },
        { value: 'nutritionist', label: 'Nutricionistas' },
        { value: 'physiotherapist', label: 'Fisioterapeutas' },
    ];

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {typeFilterOptions.map(opt => (
                        <Button
                            key={opt.value}
                            variant={typeFilter === opt.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter(opt.value)}
                            className="rounded-full"
                        >
                            {opt.label}
                        </Button>
                    ))}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowInactive(!showInactive)}
                        className={cn('rounded-full ml-1', showInactive && 'bg-zinc-100')}
                    >
                        {showInactive ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                        Inativos
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Buscar por nome ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/manager/trainers/new">Novo Treinador</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/manager/professionals/new?type=nutritionist">Novo Nutricionista</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/manager/professionals/new?type=physiotherapist">Novo Fisioterapeuta</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-zinc-50/50">
                        <TableRow>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-center">Alunos</TableHead>
                            <TableHead>Início</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                                    Nenhum profissional encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((member) => (
                                <TableRow key={`${member.type}-${member.id}`} className="hover:bg-zinc-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-zinc-900">{member.name}</p>
                                                <p className="text-xs text-zinc-500">{member.email || '-'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ProfessionBadge type={member.type as ProfessionType} />
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                        {member.activeStudents}
                                    </TableCell>
                                    <TableCell className="text-zinc-600">
                                        {formatDate(member.startDate)}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={cn(
                                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                                member.isActive
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-zinc-100 text-zinc-500'
                                            )}
                                        >
                                            {member.isActive ? 'Ativo' : 'Inativo'}
                                        </span>
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

                                                {member.type === 'trainer' ? (
                                                    <>
                                                        <DropdownMenuItem onClick={() => setTrainerToEdit(member)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Editar Dados
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setTrainerToResetPassword(member)}>
                                                            <KeyRound className="mr-2 h-4 w-4" />
                                                            Redefinir Senha
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => setProfResetDialog(member)}>
                                                        <KeyRound className="mr-2 h-4 w-4" />
                                                        Redefinir Senha
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator />

                                                {member.isActive ? (
                                                    <DropdownMenuItem
                                                        onClick={() => setMemberToToggle(member)}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Archive className="mr-2 h-4 w-4" />
                                                        {member.type === 'trainer' ? 'Arquivar' : 'Desativar'}
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        onClick={() => setMemberToToggle(member)}
                                                        className="text-emerald-600 focus:text-emerald-600"
                                                    >
                                                        <UserCheck className="mr-2 h-4 w-4" />
                                                        {member.type === 'trainer' ? 'Reativar' : 'Ativar'}
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

            {/* Toggle Status Dialog */}
            <AlertDialog open={!!memberToToggle} onOpenChange={(open) => !open && setMemberToToggle(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {memberToToggle?.isActive
                                ? (memberToToggle.type === 'trainer' ? 'Arquivar Treinador?' : 'Desativar Profissional?')
                                : (memberToToggle?.type === 'trainer' ? 'Reativar Treinador?' : 'Ativar Profissional?')
                            }
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {memberToToggle?.isActive
                                ? `${memberToToggle?.name} deixará de ter acesso ao sistema e não aparecerá nas listas ativas.`
                                : `${memberToToggle?.name} voltará a ter acesso ao sistema e aparecerá nas listas ativas.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            className={memberToToggle?.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Trainer Edit Dialog */}
            {trainerToEdit && (
                <EditTrainerDialog
                    trainer={toTrainerFormat(trainerToEdit)}
                    open={!!trainerToEdit}
                    onOpenChange={(open) => !open && setTrainerToEdit(null)}
                />
            )}

            {/* Trainer Reset Password Dialog */}
            {trainerToResetPassword && (
                <ResetPasswordDialog
                    trainer={toTrainerFormat(trainerToResetPassword)}
                    open={!!trainerToResetPassword}
                    onOpenChange={(open) => !open && setTrainerToResetPassword(null)}
                />
            )}

            {/* Professional Reset Password Dialog */}
            <Dialog open={!!profResetDialog} onOpenChange={() => { setProfResetDialog(null); setPassword(''); setConfirmPassword(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Redefinir Senha</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-zinc-500">
                        Redefinir senha de <strong>{profResetDialog?.name}</strong>
                    </p>
                    <div className="space-y-3">
                        <Input
                            type="password"
                            label="Nova senha"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                        />
                        <Input
                            type="password"
                            label="Confirmar senha"
                            placeholder="Repita a senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={6}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProfResetDialog(null)}>Cancelar</Button>
                        <Button onClick={handleResetProfPassword} isLoading={resetLoading}>Redefinir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
