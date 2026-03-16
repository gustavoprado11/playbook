'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(formData: FormData) {
        setError(null);
        setPasswordError(null);

        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirm_password') as string;

        if (password.length < 6) {
            setPasswordError('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setPasswordError('As senhas não coincidem');
            return;
        }

        setIsLoading(true);

        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            if (error.message.includes('session') || error.message.includes('token')) {
                setError('O link de redefinição expirou. Solicite um novo na tela de login.');
            } else {
                setError(error.message);
            }
            setIsLoading(false);
            return;
        }

        await supabase.auth.signOut();
        router.push('/login?password_reset=success');
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
                    <CardDescription>
                        Digite sua nova senha abaixo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={handleSubmit} className="space-y-4">
                        <Input
                            name="password"
                            type="password"
                            label="Nova senha"
                            placeholder="Mínimo 6 caracteres"
                            required
                            minLength={6}
                            autoFocus
                            error={passwordError && passwordError.includes('mínimo') ? passwordError : undefined}
                        />

                        <Input
                            name="confirm_password"
                            type="password"
                            label="Confirmar nova senha"
                            placeholder="Repita a senha"
                            required
                            minLength={6}
                            error={passwordError && passwordError.includes('coincidem') ? passwordError : undefined}
                        />

                        {error && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" isLoading={isLoading}>
                            Redefinir senha
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
