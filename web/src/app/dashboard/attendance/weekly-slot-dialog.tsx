'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, Users } from 'lucide-react';
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
import type { AttendanceStatus, Profile, ScheduleBaseSlot, ScheduleParticipant, ScheduleWeekSlot, Student, Trainer } from '@/types/database';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };
type EditableEntry = ScheduleParticipant & { student?: JoinedStudent | null };
type EditableSlot = (ScheduleBaseSlot | ScheduleWeekSlot) & {
    entries?: EditableEntry[];
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
    autoAddEntry?: boolean;
}

interface DraftSlotRow {
    id: string;
    startTime: string;
    capacity: string;
}

interface DraftEntry {
    id: string;
    participantType: 'student' | 'guest';
    student_id?: string;
    guest_name?: string;
    guest_origin?: string;
    status: AttendanceStatus;
    search: string;
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
    students,
    trainers,
    defaultTrainerId,
    weekStart,
    autoAddEntry = false,
}: WeeklySlotDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [trainerId, setTrainerId] = useState('');
    const [weekday, setWeekday] = useState('1');
    const [notes, setNotes] = useState('');
    const [slotRows, setSlotRows] = useState<DraftSlotRow[]>([]);
    const [entries, setEntries] = useState<DraftEntry[]>([]);
    const [focusEntryId, setFocusEntryId] = useState<string | null>(null);

    const allowsBatchCreation = !slot?.id;
    const selectedTrainerStudents = useMemo(() => (
        students.filter((student) => !trainerId || student.trainer_id === trainerId)
    ), [students, trainerId]);

    useEffect(() => {
        if (!open) return;

        const entrySeed: DraftEntry[] = ((slot?.entries || []) as EditableEntry[]).map((entry, index) => ({
            id: entry.id || `${index + 1}`,
            participantType: entry.student_id ? 'student' as const : 'guest' as const,
            student_id: entry.student_id,
            guest_name: entry.guest_name,
            guest_origin: entry.guest_origin,
            status: entry.status || 'pending',
            search: entry.student?.full_name || entry.guest_name || '',
        }));

        let nextFocusId: string | null = null;

        if (autoAddEntry && (!slot?.capacity || entrySeed.length < slot.capacity)) {
            nextFocusId = crypto.randomUUID();
            entrySeed.push({
                id: nextFocusId,
                participantType: 'student',
                student_id: undefined,
                guest_name: undefined,
                guest_origin: undefined,
                status: mode === 'week' ? 'pending' : 'pending',
                search: '',
            });
        }

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
        setEntries(entrySeed);
        setFocusEntryId(nextFocusId);
    }, [autoAddEntry, defaultTrainerId, mode, open, slot, trainers]);

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

    function addEntry(prefill = '') {
        const nextId = crypto.randomUUID();
        setEntries((current) => [
            ...current,
            {
                id: nextId,
                participantType: 'student',
                status: 'pending',
                search: prefill,
            },
        ]);
        setFocusEntryId(nextId);
    }

    function updateEntry(entryId: string, patch: Partial<DraftEntry>) {
        setEntries((current) => current.map((entry) => (
            entry.id === entryId ? { ...entry, ...patch } : entry
        )));
    }

    function removeEntry(entryId: string) {
        setEntries((current) => current.filter((entry) => entry.id !== entryId));
    }

    function getStudentMatches(query: string) {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return [];

        return selectedTrainerStudents
            .filter((student) => student.full_name.toLowerCase().includes(normalized))
            .sort((a, b) => {
                const aStarts = a.full_name.toLowerCase().startsWith(normalized) ? 0 : 1;
                const bStarts = b.full_name.toLowerCase().startsWith(normalized) ? 0 : 1;
                return aStarts - bStarts || a.full_name.localeCompare(b.full_name);
            })
            .slice(0, 6);
    }

    function chooseStudent(entryId: string, student: JoinedStudent) {
        updateEntry(entryId, {
            participantType: 'student',
            student_id: student.id,
            guest_name: '',
            guest_origin: '',
            search: student.full_name,
        });
    }

    function convertEntryToGuest(entry: DraftEntry) {
        const fallbackName = entry.search.trim();
        updateEntry(entry.id, {
            participantType: 'guest',
            student_id: undefined,
            guest_name: fallbackName,
            search: fallbackName,
        });
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

        const normalizedRows = slotRows.map((row) => ({
            start_time: row.startTime,
            capacity: Number(row.capacity),
        }));

        if (normalizedRows.some((row) => !row.start_time || Number.isNaN(row.capacity) || row.capacity < 1)) {
            toast.error('Preencha horario e vagas corretamente');
            return;
        }

        const effectiveEntries = normalizedRows.length === 1 ? buildPayloadEntries() : [];
        if (normalizedRows.length === 1 && effectiveEntries.length > normalizedRows[0].capacity) {
            toast.error('A quantidade de participantes nao pode passar das vagas do horario');
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
                    entries: effectiveEntries,
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
                if (mode === 'base' && publicMode && publicToken) {
                    await archivePublicBaseScheduleSlot(publicToken, slot.id);
                } else if (mode === 'base') {
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

    const showParticipants = slotRows.length === 1;
    const selectedTrainerName = trainers.find((trainer) => trainer.id === trainerId)?.profile?.full_name || 'Treinador';
    const weekdayName = WEEKDAY_OPTIONS.find((day) => String(day.value) === weekday)?.label || 'Dia';
    const totalCapacity = slotRows.reduce((sum, row) => sum + (Number(row.capacity) || 0), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-none flex-col overflow-hidden bg-white p-0 sm:rounded-2xl">
                <DialogHeader className="shrink-0 border-b border-zinc-200 bg-[linear-gradient(135deg,#fcfcfb_0%,#f3f7f2_100%)] px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <DialogTitle>{mode === 'base' ? 'Editar horario fixo' : 'Editar horario da semana'}</DialogTitle>
                            <DialogDescription className="mt-2">
                                Trabalhe como planilha: ajuste horarios, vagas e lista de nomes da celula selecionada.
                            </DialogDescription>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <DialogChip icon={<Users className="h-3.5 w-3.5" />} label="Treinador" value={selectedTrainerName} />
                            <DialogChip icon={<CalendarDays className="h-3.5 w-3.5" />} label="Dia" value={weekdayName} />
                            <DialogChip icon={<Clock3 className="h-3.5 w-3.5" />} label="Horarios" value={String(slotRows.length)} />
                            <DialogChip icon={<Users className="h-3.5 w-3.5" />} label="Vagas" value={String(totalCapacity)} />
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
                                <p className="text-sm font-semibold text-zinc-900">Horarios e vagas</p>
                                <p className="text-xs text-zinc-500">
                                    {allowsBatchCreation
                                        ? 'Crie varios horarios de uma vez com sua capacidade individual.'
                                        : 'Ajuste o horario e as vagas desta celula.'}
                                </p>
                            </div>
                            {allowsBatchCreation && (
                                <Button type="button" variant="outline" size="sm" onClick={addSlotRow}>
                                    Adicionar horario
                                </Button>
                            )}
                        </div>

                        <div className="p-4">
                            <div className="hidden rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 lg:grid lg:grid-cols-[1fr,160px,44px] lg:gap-3">
                                <span>Horario</span>
                                <span>Vagas</span>
                                <span />
                            </div>

                            <div className="mt-3 space-y-3">
                            {slotRows.map((row, index) => (
                                <div key={row.id} className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 lg:grid-cols-[1fr,160px,44px]">
                                    <Input
                                        type="time"
                                        label={index === 0 ? 'Horario' : `Horario ${index + 1}`}
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
                                    <div className="flex items-end">
                                        {allowsBatchCreation && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeSlotRow(row.id)} disabled={slotRows.length === 1}>
                                                x
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observacoes do horario</Label>
                        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: aula com foco em reabilitacao." />
                    </div>

                    <div className="rounded-2xl border border-zinc-200">
                        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-zinc-900">Participantes do horario</p>
                                <p className="text-xs text-zinc-500">
                                    {showParticipants
                                        ? 'Clique em vaga livre na grade ou adicione nomes aqui. Ao digitar, a busca local procura alunos e pode virar avulso.'
                                        : 'Quando criar varios horarios ao mesmo tempo, salve primeiro. Depois use cada celula para preencher os participantes.'}
                                </p>
                            </div>
                            {showParticipants && (
                                <Button type="button" variant="outline" size="sm" onClick={() => addEntry()}>
                                    Adicionar nome
                                </Button>
                            )}
                        </div>

                        <div className="space-y-3 p-4">
                            {!showParticipants ? (
                                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                                    Crie os horarios em lote e depois clique na celula desejada para preencher as vagas.
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                                    Nenhum nome alocado ainda. Crie o horario vazio ou adicione participantes.
                                </div>
                            ) : (
                                entries.map((entry, index) => {
                                    const matches = entry.participantType === 'student' ? getStudentMatches(entry.search) : [];
                                    const hasExactStudent = Boolean(entry.student_id);
                                    const canConvertToGuest = entry.participantType === 'student' && Boolean(entry.search.trim()) && !hasExactStudent;

                                    return (
                                        <div key={entry.id} className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 xl:grid-cols-[110px,1.4fr,1fr,130px,44px]">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-zinc-500">Tipo</Label>
                                                <Select
                                                    value={entry.participantType}
                                                    onValueChange={(value) => updateEntry(entry.id, {
                                                        participantType: value as 'student' | 'guest',
                                                        student_id: undefined,
                                                        guest_name: value === 'guest' ? entry.search : '',
                                                        guest_origin: '',
                                                    })}
                                                >
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
                                                <div className="space-y-2 xl:col-span-2">
                                                    <Label className="text-xs text-zinc-500">Buscar aluno</Label>
                                                    <Input
                                                        value={entry.search}
                                                        autoFocus={entry.id === focusEntryId}
                                                        onChange={(event) => updateEntry(entry.id, {
                                                            search: event.target.value,
                                                            student_id: undefined,
                                                        })}
                                                        placeholder="Digite o nome do aluno"
                                                    />

                                                    {matches.length > 0 && (
                                                        <div className="rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_28px_-20px_rgba(24,24,27,0.35)]">
                                                            {matches.map((student) => (
                                                                <button
                                                                    key={student.id}
                                                                    type="button"
                                                                    onClick={() => chooseStudent(entry.id, student)}
                                                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                                                                >
                                                                    <span className="font-medium text-zinc-900">{student.full_name}</span>
                                                                    <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                                                                        {student.trainer?.profile?.full_name || 'Aluno'}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {canConvertToGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => convertEntryToGuest(entry)}
                                                            className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700"
                                                        >
                                                            Manter "{entry.search.trim()}" como avulso
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <Input
                                                        label="Nome"
                                                        value={entry.guest_name || ''}
                                                        autoFocus={entry.id === focusEntryId}
                                                        onChange={(event) => updateEntry(entry.id, {
                                                            guest_name: event.target.value,
                                                            search: event.target.value,
                                                        })}
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
                                                            <SelectItem value="absent">Falta</SelectItem>
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
                                    );
                                })
                            )}
                        </div>
                    </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:justify-between">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                            {showParticipants ? `${entries.length} participante(s) preenchidos` : 'Salve os horarios em lote para preencher participantes depois'}
                        </div>
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

function DialogChip({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-zinc-400">{icon}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{label}</span>
            <span className="text-sm font-medium text-zinc-700">{value}</span>
        </div>
    );
}
