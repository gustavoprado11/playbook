'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createStudent } from '@/app/actions/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import type { Trainer, Profile } from '@/types/database';

interface NewStudentFormProps {
    trainers: (Trainer & { profile: Profile })[];
}

export function NewStudentForm({ trainers }: NewStudentFormProps) {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [origin, setOrigin] = useState<string>('organic');
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await createStudent(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    const trainerOptions = trainers.map(t => ({
        value: t.id,
        label: t.profile?.full_name || 'Sem nome',
    }));

    const originOptions = [
        { value: 'organic', label: 'Orgânico' },
        { value: 'referral', label: 'Indicação' },
        { value: 'marketing', label: 'Marketing' },
    ];

    return (
        <>
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/students">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Novo Aluno</h1>
                    <p className="mt-1 text-zinc-500">Cadastrar um novo aluno no estúdio</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informações do Aluno</CardTitle>
                    <CardDescription>
                        Preencha os dados do novo aluno
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={handleSubmit} className="space-y-4">
                        <Input
                            name="full_name"
                            label="Nome completo"
                            placeholder="Maria Santos"
                            required
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                name="email"
                                type="email"
                                label="E-mail"
                                placeholder="maria@email.com"
                            />

                            <Input
                                name="phone"
                                type="tel"
                                label="Telefone"
                                placeholder="(11) 99999-9999"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Treinador responsável</Label>
                            <Select name="trainer_id" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {trainerOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Origem</Label>
                                <Select
                                    name="origin"
                                    value={origin}
                                    onValueChange={setOrigin}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {originOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Input
                                name="start_date"
                                type="date"
                                label="Data de início"
                                defaultValue={new Date().toISOString().split('T')[0]}
                            />
                        </div>

                        {origin === 'referral' && (
                            <div className="space-y-2">
                                <Label>Indicado por qual treinador?</Label>
                                <Select name="referred_by_trainer_id" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {trainerOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="w-full">
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                                Observações
                            </label>
                            <textarea
                                name="notes"
                                rows={3}
                                className="flex w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Observações opcionais..."
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Link href="/dashboard/manager/students" className="flex-1">
                                <Button type="button" variant="outline" className="w-full">
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" className="flex-1" isLoading={isLoading}>
                                Cadastrar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
