'use client';

import { useState } from 'react';
import { updateTrainer } from '@/app/actions/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { Trainer, Profile } from '@/types/database';

interface EditTrainerDialogProps {
    trainer: Trainer & { profile?: Profile };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditTrainerDialog({ trainer, open, onOpenChange }: EditTrainerDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError(null);

        const data = {
            full_name: formData.get('full_name') as string,
            email: formData.get('email') as string,
            start_date: formData.get('start_date') as string,
            notes: formData.get('notes') as string,
        };

        const result = await updateTrainer(trainer.id, data);

        if (result?.error) {
            setError(result.error);
        } else {
            onOpenChange(false);
        }
        setIsLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Treinador</DialogTitle>
                    <DialogDescription>
                        Atualize os dados de {trainer.profile?.full_name}
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4">
                    <Input
                        name="full_name"
                        label="Nome completo"
                        defaultValue={trainer.profile?.full_name}
                        required
                    />

                    <Input
                        name="email"
                        type="email"
                        label="E-mail"
                        defaultValue={trainer.profile?.email}
                        required
                    />

                    <Input
                        name="start_date"
                        type="date"
                        label="Data de início"
                        defaultValue={trainer.start_date}
                    />

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <textarea
                            name="notes"
                            rows={3}
                            className="flex w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            defaultValue={trainer.notes || ''}
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={isLoading}>
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
