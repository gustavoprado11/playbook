'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, MoreVertical, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProgramTemplate } from '@/app/actions/prescription';
import type { ProgramTemplate } from '@/types/database';

interface ProgramsListProps {
    programs: ProgramTemplate[];
}

export function ProgramsList({ programs }: ProgramsListProps) {
    const router = useRouter();
    const [archivingId, setArchivingId] = useState<string | null>(null);

    const handleArchive = async () => {
        if (!archivingId) return;
        try {
            await deleteProgramTemplate(archivingId);
            toast.success('Programa arquivado');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao arquivar programa');
        } finally {
            setArchivingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Programas</h1>
                    <p className="mt-1 text-zinc-500">
                        Modelos de treino montados por fases (Exos), reutilizáveis com seus alunos.
                    </p>
                </div>
                <Link href="/dashboard/trainer/prescricao/programas/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo programa
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {programs.length} programa{programs.length === 1 ? '' : 's'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {programs.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-500">
                            Nenhum programa ainda. Clique em &quot;Novo programa&quot; para montar o primeiro.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Objetivo</TableHead>
                                        <TableHead>Sessões</TableHead>
                                        <TableHead className="w-10" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {programs.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium text-zinc-900">
                                                <Link
                                                    href={`/dashboard/trainer/prescricao/programas/${p.id}`}
                                                    className="hover:text-emerald-700 hover:underline"
                                                >
                                                    {p.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-zinc-600">{p.goal || '—'}</TableCell>
                                            <TableCell className="text-zinc-600">
                                                {p.sessions?.length ?? 0}
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
                                                            <Link href={`/dashboard/trainer/prescricao/programas/${p.id}`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setArchivingId(p.id)}
                                                            className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                                        >
                                                            <Archive className="mr-2 h-4 w-4" />
                                                            Arquivar
                                                        </DropdownMenuItem>
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

            <AlertDialog open={!!archivingId} onOpenChange={(open) => !open && setArchivingId(null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar programa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ele deixará de aparecer na lista. Nenhum aluno é afetado (isto é um modelo).
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
