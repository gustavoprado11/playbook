'use client';

import { useState } from 'react';
import { resetTrainerPassword } from '@/app/actions/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { Trainer, Profile } from '@/types/database';

interface ResetPasswordDialogProps {
    trainer: Trainer & { profile?: Profile };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ trainer, open, onOpenChange }: ResetPasswordDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    function handleClose(open: boolean) {
        if (!open) {
            setError(null);
            setPasswordError(null);
            setSuccess(false);
        }
        onOpenChange(open);
    }

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

        const result = await resetTrainerPassword(trainer.id, password, confirmPassword);

        if (result?.error) {
            setError(result.error);
        } else {
            setSuccess(true);
        }
        setIsLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Redefinir Senha</DialogTitle>
                    <DialogDescription>
                        Defina uma nova senha para {trainer.profile?.full_name}. Comunique a nova senha ao treinador pessoalmente.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">
                            Senha redefinida com sucesso.
                        </div>
                        <DialogFooter>
                            <Button onClick={() => handleClose(false)}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" isLoading={isLoading}>
                                Redefinir Senha
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
