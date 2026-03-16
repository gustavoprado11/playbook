'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    archiveBaseScheduleSlot,
    archivePublicBaseScheduleSlot,
    deletePublicWeekScheduleSlot,
    deleteWeekScheduleSlot,
    upsertBaseScheduleSlot,
    upsertPublicBaseScheduleSlot,
    upsertPublicWeekScheduleSlot,
    upsertWeekScheduleSlot,
} from '@/app/actions/attendance';
import { WEEKDAY_OPTIONS } from '@/lib/attendance';
import type { Profile, ScheduleBaseSlot, ScheduleWeekSlot, Trainer } from '@/types/database';

type JoinedTrainer = Trainer & { profile: Profile };
type EditableSlot = (ScheduleBaseSlot | ScheduleWeekSlot) & {
    entries?: unknown[];
};

interface WeeklySlotDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'base' | 'week';
    role: 'manager' | 'trainer';
    publicMode?: boolean;
    publicToken?: string;
    slot?: EditableSlot;
    trainers: JoinedTrainer[];
    defaultTrainerId?: string;
    weekStart?: string;
}

interface DraftSlotRow {
    id: string;
    startTime: string;
    capacity: string;
}

const DEFAULT_CAPACITY = '4';
const DEFAULT_TIME = '06:00';

export function WeeklySlotDialog({
    open,
    onOpenChange,
    mode,
    role,
    publicMode = false,
    publicToken,
    slot,
    trainers,
    defaultTrainerId,
    weekStart,
}: WeeklySlotDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [trainerId, setTrainerId] = useState('');
    const [weekday, setWeekday] = useState('1');
    const [notes, setNotes] = useState('');
    const [slotRows, setSlotRows] = useState<DraftSlotRow[]>([]);

    const allowsBatchCreation = !slot?.id;

    useEffect(() => {
        if (!open) return;

        setTrainerId(slot?.trainer_id || defaultTrainerId || trainers[0]?.id || '');
        setWeekday(slot ? String(slot.weekday) : '1');
        setNotes(slot?.notes || '');
        setSlotRows([
            {
                id: slot?.id || crypto.randomUUID(),
                startTime: slot?.start_time?.slice(0, 5) || DEFAULT_TIME,
                capacity: String(slot?.capacity || Number(DEFAULT_CAPACITY)),
            },
        ]);
    }, [defaultTrainerId, open, slot, trainers]);

    function updateSlotRow(rowId: string, patch: Partial<DraftSlotRow>) {
        setSlotRows((current) => current.map((row) => (
            row.id === rowId ? { ...row, ...patch } : row
        )));
    }

    function addSlotRow() {
        setSlotRows((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                startTime: current[current.length - 1]?.startTime || DEFAULT_TIME,
                capacity: current[current.length - 1]?.capacity || DEFAULT_CAPACITY,
            },
        ]);
    }

    function removeSlotRow(rowId: string) {
        setSlotRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== rowId));
    }

    function handleSave(event: React.FormEvent) {
        event.preventDefault();

        const normalizedRows = slotRows.map((row) => ({
            start_time: row.startTime,
            capacity: Number(row.capacity),
        }));

        if (normalizedRows.some((row) => !row.start_time || Number.isNaN(row.capacity) || row.capacity < 1)) {
            toast.error('Preencha horário e vagas corretamente');
            return;
        }

        startTransition(async () => {
            try {
                const payload = {
                    slot_id: slot?.id,
                    trainer_id: role === 'manager' || publicMode ? trainerId : undefined,
                    weekday: Number(weekday),
                    start_time: normalizedRows[0].start_time,
                    capacity: normalizedRows[0].capacity,
                    notes,
                    week_start: mode === 'week' ? weekStart : undefined,
                    batch_slots: normalizedRows,
                    entries: [],
                };

                if (mode === 'base' && publicMode && publicToken) {
                    await upsertPublicBaseScheduleSlot(publicToken, payload);
                } else if (mode === 'base') {
                    await upsertBaseScheduleSlot(payload);
                } else if (publicMode && publicToken) {
                    await upsertPublicWeekScheduleSlot(publicToken, payload);
                } else {
                    await upsertWeekScheduleSlot(payload);
                }

                toast.success(mode === 'base' ? 'Horário fixo salvo' : 'Horário da semana salvo');
                onOpenChange(false);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao salvar horário');
            }
        });
    }

    function handleDelete() {
        if (!slot?.id) return;

        startTransition(async () => {
            try {
                if (mode === 'base' && publicMode && publicToken) {
                    await archivePublicBaseScheduleSlot(publicToken, slot.id);
                } else if (mode === 'base') {
                    await archiveBaseScheduleSlot(slot.id);
                } else if (publicMode && publicToken) {
                    await deletePublicWeekScheduleSlot(publicToken, slot.id);
                } else {
                    await deleteWeekScheduleSlot(slot.id);
                }

                toast.success(mode === 'base' ? 'Horário fixo removido' : 'Horário da semana removido');
                onOpenChange(false);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao remover horário');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] w-[min(96vw,36rem)] max-w-none flex-col overflow-hidden bg-white p-0 sm:rounded-2xl">
                <DialogHeader className="shrink-0 border-b border-zinc-200 bg-[linear-gradient(135deg,#fcfcfb_0%,#f3f7f2_100%)] px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <DialogTitle>
                                {slot?.id
                                    ? (mode === 'base' ? 'Editar horário fixo' : 'Editar horário da semana')
                                    : (mode === 'base' ? 'Novo horário fixo' : 'Novo horário da semana')}
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                {slot?.id
                                    ? 'Ajuste horário, vagas e observações. Participantes são gerenciados direto na célula.'
                                    : 'Defina treinador, dia, horário e vagas. Participantes serão adicionados depois na célula.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
                        <div className="grid gap-4 lg:grid-cols-3">
                            {(role === 'manager' || publicMode) && (
                                <div className="space-y-2 lg:col-span-2">
                                    <Label>Treinador</Label>
                                    <Select value={trainerId} onValueChange={setTrainerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o treinador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {trainers.map((trainer) => (
                                                <SelectItem key={trainer.id} value={trainer.id}>
                                                    {trainer.profile?.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Dia</Label>
                                <Select value={weekday} onValueChange={setWeekday}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WEEKDAY_OPTIONS.map((day) => (
                                            <SelectItem key={day.value} value={String(day.value)}>
                                                {day.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200">
                            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-900">Horários e vagas</p>
                                    <p className="text-xs text-zinc-500">
                                        {allowsBatchCreation
                                            ? 'Crie vários horários de uma vez com sua capacidade individual.'
                                            : 'Ajuste o horário e as vagas desta célula.'}
                                    </p>
                                </div>
                                {allowsBatchCreation && (
                                    <Button type="button" variant="outline" size="sm" onClick={addSlotRow}>
                                        Adicionar horário
                                    </Button>
                                )}
                            </div>

                            <div className="p-4">
                                <div className="space-y-3">
                                    {slotRows.map((row, index) => (
                                        <div key={row.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    {`Horário ${index + 1}`}
                                                </div>
                                                {allowsBatchCreation && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeSlotRow(row.id)}
                                                        disabled={slotRows.length === 1}
                                                        className="h-8 px-2.5 text-zinc-500 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Remover
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),180px]">
                                                <Input
                                                    type="time"
                                                    label="Horário"
                                                    value={row.startTime}
                                                    onChange={(event) => updateSlotRow(row.id, { startTime: event.target.value })}
                                                    required
                                                />
                                                <Input
                                                    type="number"
                                                    label="Vagas"
                                                    min={1}
                                                    max={30}
                                                    value={row.capacity}
                                                    onChange={(event) => updateSlotRow(row.id, { capacity: event.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações do horário</Label>
                            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: aula com foco em reabilitação." />
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:justify-between">
                        <div>
                            {slot?.id && (
                                <Button type="button" variant="outline" onClick={handleDelete} isLoading={isPending}>
                                    Remover horário
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" isLoading={isPending}>
                                Salvar
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

