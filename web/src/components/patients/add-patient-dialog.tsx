'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    searchStudentsForLinking,
    addPatientForProfessional,
    type StudentSearchResult,
} from '@/app/actions/patients';

export function AddPatientDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<StudentSearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [searching, startSearch] = useTransition();
    const [saving, startSave] = useTransition();
    // formulário de novo paciente
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    function reset() {
        setQuery(''); setResults([]); setSearched(false); setEmail(''); setPhone('');
    }

    function runSearch(value: string) {
        setQuery(value);
        if (value.trim().length < 2) {
            setResults([]); setSearched(false);
            return;
        }
        startSearch(async () => {
            const found = await searchStudentsForLinking(value);
            setResults(found);
            setSearched(true);
        });
    }

    function link(studentId: string) {
        startSave(async () => {
            const r = await addPatientForProfessional({ existingStudentId: studentId });
            if (r.error) { toast.error(r.error); return; }
            toast.success('Paciente adicionado à sua carteira');
            setOpen(false); reset(); router.refresh();
        });
    }

    function createNew() {
        const name = query.trim();
        if (!name) return;
        startSave(async () => {
            const r = await addPatientForProfessional({
                newStudent: { full_name: name, email: email.trim() || undefined, phone: phone.trim() || undefined },
            });
            if (r.error) { toast.error(r.error); return; }
            toast.success('Paciente cadastrado e vinculado');
            setOpen(false); reset(); router.refresh();
        });
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar paciente
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Adicionar paciente</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                            Buscar pelo nome, e-mail ou telefone
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                                value={query}
                                onChange={(e) => runSearch(e.target.value)}
                                placeholder="Digite ao menos 2 letras…"
                                className="pl-9"
                                autoFocus
                            />
                            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                            Se a pessoa já estiver cadastrada (por um treinador ou outro profissional), vincule — não recadastre.
                        </p>
                    </div>

                    {results.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-zinc-200 p-1">
                            {results.map((s) => (
                                <div key={s.id} className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-zinc-50">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-zinc-900">{s.full_name}</p>
                                        <p className="truncate text-xs text-zinc-400">
                                            {[s.email, s.phone].filter(Boolean).join(' · ') || (s.has_trainer ? 'Aluno de treino' : 'Sem treinador')}
                                        </p>
                                    </div>
                                    {s.already_linked ? (
                                        <span className="shrink-0 text-xs font-medium text-zinc-400">Já na carteira</span>
                                    ) : (
                                        <Button size="sm" variant="outline" disabled={saving} onClick={() => link(s.id)}>
                                            Vincular
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {searched && results.length === 0 && (
                        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-3">
                            <p className="text-sm text-zinc-600">
                                Nenhum cadastro encontrado para <strong>&quot;{query.trim()}&quot;</strong>. Criar novo paciente:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" />
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone (opcional)" />
                            </div>
                            <Button size="sm" disabled={saving} isLoading={saving} onClick={createNew} className="w-full">
                                Criar &quot;{query.trim()}&quot; e vincular
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
