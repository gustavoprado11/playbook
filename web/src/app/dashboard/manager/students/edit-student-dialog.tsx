'use client';

import { useState, useEffect } from 'react';
import { updateStudent } from '@/app/actions/manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { Student, Trainer, Profile } from '@/types/database';

interface ExtendedStudent extends Student {
    trainer?: Trainer & { profile?: Profile };
}

interface EditStudentDialogProps {
    student: ExtendedStudent | null;
    trainers: (Trainer & { profile: Profile })[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditStudentDialog({ student, trainers, open, onOpenChange }: EditStudentDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [origin, setOrigin] = useState<string>('organic');

    // Reset origin when student changes
    useEffect(() => {
        if (student) {
            setOrigin(student.origin);
        }
    }, [student]);

    async function handleSubmit(formData: FormData) {
        if (!student) return;
        setIsLoading(true);
        setError(null);

        // Extract data
        const data = {
            full_name: formData.get('full_name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            trainer_id: formData.get('trainer_id') as string,
            origin: formData.get('origin') as any,
            referred_by_trainer_id: formData.get('referred_by_trainer_id') as string | undefined,
            start_date: formData.get('start_date') as string,
            notes: formData.get('notes') as string,
        };

        try {
            await updateStudent(student.id, data);
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Erro ao atualizar aluno');
        } finally {
            setIsLoading(false);
        }
    }

    if (!student) return null;

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Editar Aluno</DialogTitle>
                    <DialogDescription>
                        Atualize as informações de {student.full_name}
                    </DialogDescription>
                </DialogHeader>

                <form action={handleSubmit} className="space-y-4 py-2">
                    <Input
                        name="full_name"
                        label="Nome completo"
                        defaultValue={student.full_name}
                        required
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            name="email"
                            type="email"
                            label="E-mail"
                            defaultValue={student.email || ''}
                        />

                        <Input
                            name="phone"
                            type="tel"
                            label="Telefone"
                            defaultValue={student.phone || ''}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Treinador responsável</Label>
                        <Select name="trainer_id" defaultValue={student.trainer_id} required>
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
                            defaultValue={student.start_date}
                        />
                    </div>

                    {origin === 'referral' && (
                        <div className="space-y-2">
                            <Label>Indicado por qual treinador?</Label>
                            <Select name="referred_by_trainer_id" defaultValue={student.referred_by_trainer_id || ''}>
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
                            defaultValue={student.notes || ''}
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
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
