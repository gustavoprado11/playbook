'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Settings2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
    addEntryToSlot,
    addPublicEntryToSlot,
    markAllPresent,
    markAllPublicPresent,
    removeEntryFromSlot,
    removePublicEntryFromSlot,
    updateEntrySessionType,
    updatePublicEntrySessionType,
} from '@/app/actions/attendance';
import type {
    AgendaKind,
    AttendanceStatus,
    AgendaSessionType,
    Profile,
    Student,
    Trainer,
} from '@/types/database';

const SESSION_TYPES: AgendaSessionType[] = ['avaliacao', 'recovery', 'sessao'];
const sessionMeta: Record<AgendaSessionType, { short: string; label: string; cls: string }> = {
    avaliacao: { short: 'Aval.', label: 'Avaliação', cls: 'bg-violet-100 text-violet-700' },
    recovery: { short: 'Rec.', label: 'Recovery', cls: 'bg-blue-100 text-blue-700' },
    sessao: { short: 'Sessão', label: 'Sessão', cls: 'bg-emerald-100 text-emerald-700' },
};

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };

interface SlotEntry {
    id: string;
    student_id: string | null;
    guest_name: string | null;
    status?: AttendanceStatus;
    session_type?: AgendaSessionType;
    student?: JoinedStudent | null;
}

interface PopoverSlot {
    id: string;
    trainer_id: string;
    capacity: number;
    entries: SlotEntry[];
    trainer?: JoinedTrainer;
}

interface SlotCellPopoverProps {
    slot: PopoverSlot;
    students: JoinedStudent[];
    mode: 'base' | 'week';
    agenda?: AgendaKind;
    publicMode?: boolean;
    publicToken?: string;
    onEditSlot: () => void;
    children: React.ReactNode;
}

export function SlotCellPopover({
    slot,
    students,
    mode,
    agenda = 'training',
    publicMode = false,
    publicToken,
    onEditSlot,
    children,
}: SlotCellPopoverProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
    const [nextSessionType, setNextSessionType] = useState<AgendaSessionType>('sessao');
    const inputRef = useRef<HTMLInputElement>(null);

    const isPhysio = agenda === 'physiotherapy';
    const isFull = slot.entries.length >= slot.capacity;
    const allPresent = slot.entries.length > 0 && slot.entries.every((e) => e.status === 'present');

    function handleMarkAllPresent() {
        startTransition(async () => {
            try {
                if (publicMode && publicToken) {
                    await markAllPublicPresent({ weekSlotId: slot.id, token: publicToken });
                } else {
                    await markAllPresent({ weekSlotId: slot.id, agenda });
                }

                router.refresh();
                toast.success('Todos marcados como presentes');
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao marcar presença');
            }
        });
    }

    const matches = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        if (!normalized) return [];

        const usedStudentIds = new Set(
            slot.entries
                .map((e) => e.student_id)
                .filter(Boolean),
        );

        return students
            .filter((s) => !usedStudentIds.has(s.id) && s.full_name.toLowerCase().includes(normalized))
            .sort((a, b) => {
                const aStarts = a.full_name.toLowerCase().startsWith(normalized) ? 0 : 1;
                const bStarts = b.full_name.toLowerCase().startsWith(normalized) ? 0 : 1;
                return aStarts - bStarts || a.full_name.localeCompare(b.full_name);
            })
            .slice(0, 5);
    }, [search, students, slot.entries]);

    const canAddGuest = search.trim().length > 0 && matches.length === 0;

    function handleAddStudent(student: JoinedStudent) {
        startTransition(async () => {
            try {
                const payload = { slotId: slot.id, slotType: mode, studentId: student.id, sessionType: isPhysio ? nextSessionType : undefined };

                if (publicMode && publicToken) {
                    await addPublicEntryToSlot(publicToken, payload);
                } else {
                    await addEntryToSlot({ ...payload, agenda });
                }

                setSearch('');
                router.refresh();
                toast.success(`${student.full_name} adicionado`);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao adicionar');
            }
        });
    }

    function handleAddGuest() {
        const guestName = search.trim();
        if (!guestName) return;

        startTransition(async () => {
            try {
                const payload = { slotId: slot.id, slotType: mode, guestName, sessionType: isPhysio ? nextSessionType : undefined };

                if (publicMode && publicToken) {
                    await addPublicEntryToSlot(publicToken, payload);
                } else {
                    await addEntryToSlot({ ...payload, agenda });
                }

                setSearch('');
                router.refresh();
                toast.success(`${guestName} adicionado como avulso`);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao adicionar');
            }
        });
    }

    function handleRemoveEntry(entryId: string) {
        setPendingEntryId(entryId);
        startTransition(async () => {
            try {
                const payload = { entryId, slotType: mode };

                if (publicMode && publicToken) {
                    await removePublicEntryFromSlot(publicToken, payload);
                } else {
                    await removeEntryFromSlot({ ...payload, agenda });
                }

                router.refresh();
                toast.success('Participante removido');
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao remover');
            } finally {
                setPendingEntryId(null);
            }
        });
    }

    function handleCycleType(entry: SlotEntry) {
        const current = entry.session_type ?? 'sessao';
        const next = SESSION_TYPES[(SESSION_TYPES.indexOf(current) + 1) % SESSION_TYPES.length];
        startTransition(async () => {
            try {
                const payload = { entryId: entry.id, slotType: mode, sessionType: next };
                if (publicMode && publicToken) {
                    await updatePublicEntrySessionType(publicToken, payload);
                } else {
                    await updateEntrySessionType(payload);
                }
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao atualizar tipo');
            }
        });
    }

    return (
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                className="w-[min(320px,calc(100vw-2rem))] p-0"
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
            >
                <div className="border-b border-zinc-200 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                <Users className="h-3 w-3" />
                                {slot.entries.length}/{slot.capacity}
                            </div>
                            {slot.trainer?.profile?.full_name && (
                                <span className="truncate text-xs font-medium text-zinc-500">
                                    {slot.trainer.profile.full_name}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onEditSlot(); }}
                            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                            title="Editar horário"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    {mode === 'week' && slot.entries.length > 0 && !allPresent && (
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={handleMarkAllPresent}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                            {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )}
                            Marcar todos presentes
                        </button>
                    )}
                </div>

                <div className="max-h-64 overflow-y-auto px-3 py-2">
                    {slot.entries.length === 0 ? (
                        <p className="py-3 text-center text-xs text-zinc-400">Nenhum participante</p>
                    ) : (
                        <div className="space-y-1">
                            {slot.entries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-zinc-50"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className={`truncate text-sm font-medium text-zinc-900 ${!entry.student_id && entry.guest_name ? 'italic' : ''}`}>
                                            {entry.student?.full_name || entry.guest_name || 'Vaga livre'}
                                        </p>
                                        {isPhysio && (
                                            <button
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => handleCycleType(entry)}
                                                title="Trocar tipo de atendimento"
                                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${sessionMeta[entry.session_type ?? 'sessao'].cls}`}
                                            >
                                                {sessionMeta[entry.session_type ?? 'sessao'].short}
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => handleRemoveEntry(entry.id)}
                                        className="ml-2 shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                                    >
                                        {pendingEntryId === entry.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <X className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isFull ? (
                    <div className="border-t border-zinc-200 px-3 py-2.5">
                        <p className="text-center text-xs font-medium text-zinc-400">Horário lotado</p>
                    </div>
                ) : (
                    <div className="border-t border-zinc-200 px-3 py-2.5">
                        {isPhysio && (
                            <div className="mb-2 flex items-center gap-1">
                                {SESSION_TYPES.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setNextSessionType(t)}
                                        className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${nextSessionType === t ? sessionMeta[t].cls : 'bg-zinc-50 text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        {sessionMeta[t].label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Input
                            ref={inputRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar aluno ou digitar avulso..."
                            className="h-8 text-sm"
                            disabled={isPending}
                        />

                        {matches.length > 0 && (
                            <div className="mt-1.5 rounded-lg border border-zinc-200 bg-white p-0.5">
                                {matches.map((student) => (
                                    <button
                                        key={student.id}
                                        type="button"
                                        disabled={isPending}
                                        onClick={() => handleAddStudent(student)}
                                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-zinc-50 disabled:opacity-50"
                                    >
                                        <span className="truncate font-medium text-zinc-900">{student.full_name}</span>
                                        <span className="ml-2 shrink-0 text-xs text-zinc-400">
                                            {student.trainer?.profile?.full_name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {canAddGuest && (
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={handleAddGuest}
                                className="mt-1.5 w-full rounded-lg border border-dashed border-zinc-300 bg-white px-2.5 py-2 text-left text-sm text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                            >
                                {isPending ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Adicionando...
                                    </span>
                                ) : (
                                    <>Adicionar &quot;{search.trim()}&quot; como avulso</>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
