'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchStudentsToClaim, claimStudentAsTrainer, type StudentSearchResult } from '@/app/actions/patients';

export function ClaimStudentSearch() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<StudentSearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [searching, startSearch] = useTransition();
    const [saving, startSave] = useTransition();

    function runSearch(value: string) {
        setQuery(value);
        if (value.trim().length < 2) {
            setResults([]); setSearched(false);
            return;
        }
        startSearch(async () => {
            const found = await searchStudentsToClaim(value);
            setResults(found);
            setSearched(true);
        });
    }

    function claim(studentId: string) {
        startSave(async () => {
            const r = await claimStudentAsTrainer(studentId);
            if (r.error) { toast.error(r.error); return; }
            toast.success('Aluno adicionado à sua carteira');
            router.push('/dashboard/trainer/students');
            router.refresh();
        });
    }

    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Já cadastrado?</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
                Se a pessoa já foi cadastrada (ex.: por um nutricionista ou fisioterapeuta), adicione à sua carteira sem recadastrar.
            </p>
            <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                    value={query}
                    onChange={(e) => runSearch(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou telefone…"
                    className="pl-9"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
            </div>

            {results.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg border border-zinc-200 p-1">
                    {results.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-zinc-50">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-zinc-900">{s.full_name}</p>
                                <p className="truncate text-xs text-zinc-400">{[s.email, s.phone].filter(Boolean).join(' · ') || 'Sem treinador'}</p>
                            </div>
                            <Button size="sm" variant="outline" disabled={saving} onClick={() => claim(s.id)}>
                                Adicionar à minha carteira
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {searched && results.length === 0 && (
                <p className="mt-2 text-xs text-zinc-400">
                    Nenhum cadastro sem treinador encontrado. Preencha o formulário abaixo para cadastrar um novo aluno.
                </p>
            )}
        </div>
    );
}
