'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { archiveBaseScheduleSlot, deletePublicWeekScheduleSlot, deleteWeekScheduleSlot, upsertBaseScheduleSlot, upsertPublicWeekScheduleSlot, upsertWeekScheduleSlot } from '@/app/actions/attendance';
import { WEEKDAY_OPTIONS } from '@/lib/attendance';
import type { AttendanceStatus, Profile, ScheduleBaseSlot, ScheduleParticipant, ScheduleWeekSlot, Student, Trainer } from '@/types/database';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };
type EditableSlot = (ScheduleBaseSlot | ScheduleWeekSlot) & {
    entries?: ScheduleParticipant[];
};

interface WeeklySlotDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'base' | 'week';
    role: 'manager' | 'trainer';
    publicMode?: boolean;
    publicToken?: string;
    slot?: EditableSlot;
    students: JoinedStudent[];
    trainers: JoinedTrainer[];
    defaultTrainerId?: string;
    weekStart?: string;
}

interface DraftEntry {
    id: string;
    participantType: 'student' | 'guest';
    student_id?: string;
    guest_name?: string;
    guest_origin?: string;
    status: AttendanceStatus;
}

export function WeeklySlotDialog({
    open,
    onOpenChange,
    mode,
    role,
    publicMode = false,
    publicToken,
    slot,
    students,
    trainers,
    defaultTrainerId,
    weekStart,
}: WeeklySlotDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [trainerId, setTrainerId] = useState('');
    const [weekday, setWeekday] = useState('1');
    const [startTime, setStartTime] = useState('06:00');
    const [capacity, setCapacity] = useState('4');
    const [notes, setNotes] = useState('');
    const [entries, setEntries] = useState<DraftEntry[]>([]);

    useEffect(() => {
        if (!open) return;

        setTrainerId(slot?.trainer_id || defaultTrainerId || trainers[0]?.id || '');
        setWeekday(slot ? String(slot.weekday) : '1');
        setStartTime(slot?.start_time?.slice(0, 5) || '06:00');
        setCapacity(String(slot?.capacity || 4));
        setNotes(slot?.notes || '');
        setEntries(
            (slot?.entries || []).map((entry, index) => ({
                id: entry.id || `${index + 1}`,
                participantType: entry.student_id ? 'student' : 'guest',
                student_id: entry.student_id,
                guest_name: entry.guest_name,
                guest_origin: entry.guest_origin,
                status: entry.status || 'pending',
            }))
        );
    }, [defaultTrainerId, open, slot, trainers]);

    function addEntry() {
        setEntries((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                participantType: 'student',
                status: 'pending',
            },
        ]);
    }

    function updateEntry(entryId: string, patch: Partial<DraftEntry>) {
        setEntries((current) => current.map((entry) => (
            entry.id === entryId ? { ...entry, ...patch } : entry
        )));
    }

    function removeEntry(entryId: string) {
        setEntries((current) => current.filter((entry) => entry.id !== entryId));
    }

    function buildPayloadEntries(): ScheduleParticipant[] {
        return entries.map((entry, index) => ({
            student_id: entry.participantType === 'student' ? entry.student_id : undefined,
            guest_name: entry.participantType === 'guest' ? entry.guest_name : undefined,
            guest_origin: entry.participantType === 'guest' ? entry.guest_origin : undefined,
            status: entry.status,
            position: index + 1,
        }));
    }

    function handleSave(event: React.FormEvent) {
        event.preventDefault();

        startTransition(async () => {
            try {
                const payload = {
                    slot_id: slot?.id,
                    trainer_id: role === 'manager' || publicMode ? trainerId : undefined,
                    weekday: Number(weekday),
                    start_time: startTime,
                    capacity: Number(capacity),
                    notes,
                    week_start: mode === 'week' ? weekStart : undefined,
                    entries: buildPayloadEntries(),
                };

                if (mode === 'base') {
                    await upsertBaseScheduleSlot(payload);
                } else if (publicMode && publicToken) {
                    await upsertPublicWeekScheduleSlot(publicToken, payload);
                } else {
                    await upsertWeekScheduleSlot(payload);
                }

                toast.success(mode === 'base' ? 'Horario fixo salvo' : 'Horario da semana salvo');
                onOpenChange(false);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao salvar horario');
            }
        });
    }

    function handleDelete() {
        if (!slot?.id) return;

        startTransition(async () => {
            try {
                if (mode === 'base') {
                    await archiveBaseScheduleSlot(slot.id);
                } else if (publicMode && publicToken) {
                    await deletePublicWeekScheduleSlot(publicToken, slot.id);
                } else {
                    await deleteWeekScheduleSlot(slot.id);
                }

                toast.success(mode === 'base' ? 'Horario fixo removido' : 'Horario da semana removido');
                onOpenChange(false);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao remover horario');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-white">
                <DialogHeader>
                    <DialogTitle>{mode === 'base' ? 'Editar horario fixo' : 'Editar horario da semana'}</DialogTitle>
                    <DialogDescription>
                        Trabalhe como planilha: ajuste horario, vagas e lista de nomes da celula selecionada.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        {(role === 'manager' || publicMode) && (
                            <div className="space-y-2 md:col-span-2">
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

                        <Input type="time" label="Horario" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                        <Input type="number" label="Vagas" min={1} max={30} value={capacity} onChange={(event) => setCapacity(event.target.value)} required />
                    </div>

                    <div className="space-y-2">
                        <Label>Observacoes do horario</Label>
                        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: aula com foco em reabilitacao." />
                    </div>

                    <div className="rounded-2xl border border-zinc-200">
                        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-zinc-900">Participantes do horario</p>
                                <p className="text-xs text-zinc-500">Preencha somente as linhas ocupadas. As vagas restantes continuam livres.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
                                Adicionar nome
                            </Button>
                        </div>

                        <div className="space-y-3 p-4">
                            {entries.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                                    Nenhum nome alocado ainda. Crie o horario vazio ou adicione participantes.
                                </div>
                            ) : (
                                entries.map((entry, index) => (
                                    <div key={entry.id} className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[110px,1fr,1fr,130px,44px]">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-zinc-500">Tipo</Label>
                                            <Select value={entry.participantType} onValueChange={(value) => updateEntry(entry.id, {
                                                participantType: value as 'student' | 'guest',
                                                student_id: undefined,
                                                guest_name: '',
                                                guest_origin: '',
                                            })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="student">Aluno</SelectItem>
                                                    <SelectItem value="guest">Avulso</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {entry.participantType === 'student' ? (
                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-xs text-zinc-500">Aluno</Label>
                                                <Select value={entry.student_id || ''} onValueChange={(value) => updateEntry(entry.id, { student_id: value })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione o aluno" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {students.map((student) => (
                                                            <SelectItem key={student.id} value={student.id}>
                                                                {student.full_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : (
                                            <>
                                                <Input
                                                    label="Nome"
                                                    value={entry.guest_name || ''}
                                                    onChange={(event) => updateEntry(entry.id, { guest_name: event.target.value })}
                                                    placeholder="Nome avulso"
                                                />
                                                <Input
                                                    label="Origem"
                                                    value={entry.guest_origin || ''}
                                                    onChange={(event) => updateEntry(entry.id, { guest_origin: event.target.value })}
                                                    placeholder="Experimental, outra unidade..."
                                                />
                                            </>
                                        )}

                                        {mode === 'week' ? (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-zinc-500">Status</Label>
                                                <Select value={entry.status} onValueChange={(value) => updateEntry(entry.id, { status: value as AttendanceStatus })}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">-</SelectItem>
                                                        <SelectItem value="present">OK</SelectItem>
                                                        <SelectItem value="absent">N</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : (
                                            <div className="flex items-end">
                                                <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
                                                    #{index + 1}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-end">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.id)}>
                                                x
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between">
                        <div>
                            {slot?.id && (
                                <Button type="button" variant="outline" onClick={handleDelete} isLoading={isPending}>
                                    Remover horario
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
