'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, signInWithMagicLink } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

type LoginMode = 'select' | 'password' | 'magic-link';

export function LoginForm() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<LoginMode>('select');
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const searchParams = useSearchParams();

    // Check for auth errors from callback
    const authError = searchParams.get('error');

    async function handlePasswordLogin(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await signIn(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        }
    }

    async function handleMagicLinkLogin(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const result = await signInWithMagicLink(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
        } else if (result?.success) {
            setMagicLinkSent(true);
            setIsLoading(false);
        }
    }

    function resetMode() {
        setMode('select');
        setError(null);
        setMagicLinkSent(false);
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
                            priority
                        />
                    </div>
                    <CardTitle className="text-2xl">Playbook</CardTitle>
                    <CardDescription>
                        {mode === 'select' && 'Escolha como deseja acessar'}
                        {mode === 'password' && 'Entre com e-mail e senha'}
                        {mode === 'magic-link' && !magicLinkSent && 'Receba um link de acesso no seu e-mail'}
                        {mode === 'magic-link' && magicLinkSent && 'Verifique seu e-mail'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {authError && (
                        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                            Não foi possível completar o login. Tente novamente.
                        </div>
                    )}

                    {/* Mode Selection */}
                    {mode === 'select' && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setMode('magic-link')}
                                className="w-full flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                                    <Mail className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900">Entrar com link de acesso</p>
                                    <p className="text-sm text-zinc-500">Receba um link no seu e-mail</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setMode('password')}
                                className="w-full flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:bg-zinc-50"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                                    <Lock className="h-5 w-5 text-zinc-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900">Entrar com senha</p>
                                    <p className="text-sm text-zinc-500">Para gestores do sistema</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Magic Link Form */}
                    {mode === 'magic-link' && !magicLinkSent && (
                        <form action={handleMagicLinkLogin} className="space-y-4">
                            <Input
                                name="email"
                                type="email"
                                label="E-mail"
                                placeholder="seu@email.com"
                                required
                                autoComplete="email"
                                autoFocus
                            />

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full gap-2" isLoading={isLoading}>
                                <Mail className="h-4 w-4" />
                                Enviar link de acesso
                            </Button>

                            <button
                                type="button"
                                onClick={resetMode}
                                className="w-full flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Voltar
                            </button>
                        </form>
                    )}

                    {/* Magic Link Success */}
                    {mode === 'magic-link' && magicLinkSent && (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-medium text-zinc-900">Link enviado!</p>
                                <p className="mt-2 text-sm text-zinc-500">
                                    Acesse seu e-mail e clique no link para entrar no sistema.
                                    O link expira em alguns minutos.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={resetMode}
                                className="text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                Usar outro método de acesso
                            </button>
                        </div>
                    )}

                    {/* Password Form */}
                    {mode === 'password' && (
                        <form action={handlePasswordLogin} className="space-y-4">
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

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Entrar
                            </Button>

                            <button
                                type="button"
                                onClick={resetMode}
                                className="w-full flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Voltar
                            </button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
