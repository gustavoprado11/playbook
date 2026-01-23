'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTrainer } from '@/app/actions/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function NewTrainerPage() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await createTrainer(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/trainers">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Novo Treinador</h1>
                    <p className="mt-1 text-zinc-500">Cadastrar um novo treinador no sistema</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informações do Treinador</CardTitle>
                    <CardDescription>
                        O treinador receberá um e-mail para definir sua senha
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={handleSubmit} className="space-y-4">
                        <Input
                            name="full_name"
                            label="Nome completo"
                            placeholder="João Silva"
                            required
                        />

                        <Input
                            name="email"
                            type="email"
                            label="E-mail"
                            placeholder="joao@email.com"
                            required
                        />

                        <Input
                            name="start_date"
                            type="date"
                            label="Data de início"
                            defaultValue={new Date().toISOString().split('T')[0]}
                        />

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
                            <Link href="/dashboard/manager/trainers" className="flex-1">
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
        </div>
    );
}
