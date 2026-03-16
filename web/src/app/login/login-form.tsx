'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const searchParams = useSearchParams();

    const authError = searchParams.get('error');
    const passwordReset = searchParams.get('password_reset');

    async function handleLogin(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await signIn(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    async function handleForgotPassword(formData: FormData) {
        const email = formData.get('email') as string;
        if (!email) {
            setResetError('Digite seu e-mail acima para redefinir a senha');
            return;
        }

        setResetLoading(true);
        setResetError(null);

        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
            setResetError('Não foi possível enviar o link. Tente novamente.');
        } else {
            setResetSent(true);
        }
        setResetLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-emerald-50/50">
                        <Image
                            src="/logo.png"
                            alt="Playbook Logo"
                            width={40}
                            height={40}
                            className="object-contain"
                            unoptimized
                            priority
                        />
                    </div>
                    <CardTitle className="text-2xl">Playbook</CardTitle>
                    <CardDescription>Entre com e-mail e senha</CardDescription>
                </CardHeader>
                <CardContent>
                    {authError && (
                        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                            Não foi possível completar o login. Tente novamente.
                        </div>
                    )}

                    {passwordReset === 'success' && (
                        <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">
                            Senha redefinida com sucesso. Faça login com sua nova senha.
                        </div>
                    )}

                    {resetSent ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-medium text-zinc-900">Link enviado!</p>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Acesse seu e-mail e clique no link para redefinir sua senha.
                                    O link expira em alguns minutos.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setResetSent(false)}
                                className="text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                Voltar para o login
                            </button>
                        </div>
                    ) : (
                        <form action={handleLogin} className="space-y-4">
                            <Input
                                name="email"
                                type="email"
                                label="E-mail"
                                placeholder="seu@email.com"
                                required
                                autoComplete="email"
                                autoFocus
                            />
                            <Input
                                name="password"
                                type="password"
                                label="Senha"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            {resetError && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                    {resetError}
                                </div>
                            )}

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Entrar
                            </Button>

                            <button
                                type="button"
                                disabled={resetLoading}
                                onClick={() => {
                                    const form = document.querySelector('form') as HTMLFormElement;
                                    const formData = new FormData(form);
                                    handleForgotPassword(formData);
                                }}
                                className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
                            >
                                {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
                            </button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
