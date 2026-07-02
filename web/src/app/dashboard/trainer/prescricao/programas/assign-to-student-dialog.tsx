'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { assignProgramTemplate } from '@/app/actions/prescription';
import type { PrescribableStudent } from '@/types/database';

interface AssignToStudentButtonProps {
    templateId: string;
    students: PrescribableStudent[];
}

export function AssignToStudentButton({ templateId, students }: AssignToStudentButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);

    const filtered = students.filter((s) =>
        s.full_name.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const handleAssign = async (studentId: string) => {
        setAssigningId(studentId);
        try {
            const assignedId = await assignProgramTemplate(templateId, studentId);
            toast.success('Programa atribuído ao aluno');
            setOpen(false);
            router.push(`/dashboard/trainer/prescricao/alunos/${studentId}/${assignedId}`);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao atribuir');
            setAssigningId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Atribuir a aluno
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-white">
                <DialogHeader>
                    <DialogTitle>Atribuir programa a um aluno</DialogTitle>
                    <DialogDescription>
                        Uma cópia (snapshot) do template será criada e vinculada ao aluno escolhido.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar aluno..."
                            className="pl-8"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-100 p-1">
                        {filtered.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-zinc-500">Nenhum aluno encontrado.</p>
                        ) : (
                            filtered.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    disabled={!!assigningId}
                                    onClick={() => handleAssign(s.id)}
                                    className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                    {s.full_name}
                                </button>
                            ))
                        )}
                    </div>
                    {assigningId && <p className="text-center text-xs text-zinc-500">Criando cópia para o aluno…</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
}
