'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';
import { Search, MoreVertical, KeyRound } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ProfessionBadge } from '@/components/profession-badge';
import { toggleProfessionalStatus, resetProfessionalPassword } from '@/app/actions/professionals';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import type { ProfessionType } from '@/types/database';

interface ProfessionalRow {
    id: string;
    profile_id: string;
    profession_type: ProfessionType;
    start_date: string;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    profile: { full_name: string; email: string } | null;
    student_count: { count: number }[];
}

interface Props {
    professionals: ProfessionalRow[];
}

export function ProfessionalsTable({ professionals }: Props) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'nutritionist' | 'physiotherapist'>('all');
    const [resetDialog, setResetDialog] = useState<ProfessionalRow | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const filtered = useMemo(() => {
        return professionals.filter(p => {
            const matchesSearch = p.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                p.profile?.email?.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'all' || p.profession_type === filter;
            return matchesSearch && matchesFilter;
        });
    }, [professionals, search, filter]);

    async function handleToggleStatus(id: string) {
        const result = await toggleProfessionalStatus(id);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Status atualizado');
            router.refresh();
        }
    }

    async function handleResetPassword() {
        if (!resetDialog) return;
        setResetLoading(true);
        const result = await resetProfessionalPassword(resetDialog.id, password, confirmPassword);
        setResetLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Senha redefinida com sucesso');
            setResetDialog(null);
            setPassword('');
            setConfirmPassword('');
        }
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Buscar por nome ou e-mail..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'nutritionist', 'physiotherapist'] as const).map((f) => (
                        <Button
                            key={f}
                            variant={filter === f ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'Todos' : f === 'nutritionist' ? 'Nutricionistas' : 'Fisioterapeutas'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-zinc-200 bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Início</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Pacientes</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-zinc-400">
                                    Nenhum profissional encontrado
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.profile?.full_name}</TableCell>
                                    <TableCell className="text-zinc-500">{p.profile?.email}</TableCell>
                                    <TableCell>
                                        <ProfessionBadge type={p.profession_type} />
                                    </TableCell>
                                    <TableCell className="text-zinc-500">{formatDate(p.start_date)}</TableCell>
                                    <TableCell>
                                        <button
                                            onClick={() => handleToggleStatus(p.id)}
                                            className={cn(
                                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors',
                                                p.is_active
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                            )}
                                        >
                                            {p.is_active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {p.student_count?.[0]?.count || 0}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setResetDialog(p)}>
                                                    <KeyRound className="mr-2 h-4 w-4" />
                                                    Redefinir senha
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

            {/* Reset Password Dialog */}
            <Dialog open={!!resetDialog} onOpenChange={() => { setResetDialog(null); setPassword(''); setConfirmPassword(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Redefinir Senha</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-zinc-500">
                        Redefinir senha de <strong>{resetDialog?.profile?.full_name}</strong>
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
                        <Button variant="outline" onClick={() => setResetDialog(null)}>Cancelar</Button>
                        <Button onClick={handleResetPassword} isLoading={resetLoading}>Redefinir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
