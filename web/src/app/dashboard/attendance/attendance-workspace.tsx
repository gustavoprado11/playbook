'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, KeyRound, Plus, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getOrCreateAttendancePublicLink, regenerateAttendancePublicLink } from '@/app/actions/attendance';
import { formatTimeLabel, WEEKDAY_OPTIONS } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type {
    AttendancePublicLink,
    AttendanceStatus,
    Profile,
    ScheduleBaseEntry,
    ScheduleBaseSlot,
    ScheduleWeekEntry,
    ScheduleWeekSlot,
    Student,
    Trainer,
} from '@/types/database';
import { WeeklySlotDialog } from './weekly-slot-dialog';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };
type BaseSlot = ScheduleBaseSlot & { trainer: JoinedTrainer; entries: (ScheduleBaseEntry & { student?: JoinedStudent | null })[] };
type WeekSlot = ScheduleWeekSlot & { trainer: JoinedTrainer; entries: (ScheduleWeekEntry & { student?: JoinedStudent | null })[] };

interface AttendanceWorkspaceProps {
    role: 'manager' | 'trainer';
    basePath: string;
    weekLabel: string;
    weekStart: string;
    weekDays: {
        value: number;
        short: string;
        label: string;
        date: Date;
        isoDate: string;
    }[];
    students: JoinedStudent[];
    trainers: JoinedTrainer[];
    baseSlots: BaseSlot[];
    weekSlots: WeekSlot[];
    publicLink?: AttendancePublicLink | null;
    publicMode?: boolean;
    publicToken?: string;
    publicLabel?: string;
}

type TabMode = 'week' | 'base';

export function AttendanceWorkspace({
    role,
    basePath,
    weekLabel,
    weekStart,
    weekDays,
    students,
    trainers,
    baseSlots,
    weekSlots,
    publicLink = null,
    publicMode = false,
    publicToken,
    publicLabel,
}: AttendanceWorkspaceProps) {
    const [tab, setTab] = useState<TabMode>('week');
    const [selectedTrainer, setSelectedTrainer] = useState('all');
    const [editingMode, setEditingMode] = useState<TabMode>('week');
    const [editingSlot, setEditingSlot] = useState<BaseSlot | WeekSlot | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [linkState, setLinkState] = useState(publicLink);
    const [isPending, startTransition] = useTransition();

    const prevWeek = format(addDays(parseISO(weekStart), -7), 'yyyy-MM-dd');
    const nextWeek = format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd');
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const receptionistUrl = linkState ? `${appOrigin}/agenda/${linkState.access_token}` : null;

    const trainerFilteredBase = useMemo(() => {
        if (publicMode || role !== 'manager' || selectedTrainer === 'all') return baseSlots;
        return baseSlots.filter((slot) => slot.trainer_id === selectedTrainer);
    }, [baseSlots, publicMode, role, selectedTrainer]);

    const trainerFilteredWeek = useMemo(() => {
        if (publicMode || role !== 'manager' || selectedTrainer === 'all') return weekSlots;
        return weekSlots.filter((slot) => slot.trainer_id === selectedTrainer);
    }, [publicMode, role, selectedTrainer, weekSlots]);

    const timeRows = useMemo(() => {
        const source = tab === 'base' ? trainerFilteredBase : trainerFilteredWeek;
        return Array.from(new Set(source.map((slot) => slot.start_time))).sort((a, b) => a.localeCompare(b));
    }, [tab, trainerFilteredBase, trainerFilteredWeek]);

    const summary = useMemo(() => {
        const source = trainerFilteredWeek;
        let present = 0;
        let absent = 0;
        let pending = 0;

        source.forEach((slot) => {
            slot.entries.forEach((entry) => {
                if (entry.status === 'present') present += 1;
                else if (entry.status === 'absent') absent += 1;
                else pending += 1;
            });
        });

        return {
            slots: source.length,
            present,
            absent,
            pending,
        };
    }, [trainerFilteredWeek]);

    function participantName(entry: { student?: JoinedStudent | null; guest_name?: string | null }) {
        return entry.student?.full_name || entry.guest_name || 'Vaga livre';
    }

    function participantMeta(entry: { student?: JoinedStudent | null; guest_origin?: string | null }, slotTrainerName?: string) {
        return entry.student?.trainer?.profile?.full_name || entry.guest_origin || slotTrainerName || '';
    }

    function openNewSlot(mode: TabMode, weekday?: number, startTime?: string) {
        setEditingMode(mode);
        setEditingSlot(weekday ? ({
            id: '',
            trainer_id: selectedTrainer === 'all' ? trainers[0]?.id || '' : selectedTrainer,
            weekday,
            start_time: startTime || '06:00:00',
            capacity: 4,
            notes: null,
            is_active: true,
            created_by: null,
            created_at: '',
            updated_at: '',
            entries: [],
        } as unknown as BaseSlot) : undefined);
        setDialogOpen(true);
    }

    function openExistingSlot(mode: TabMode, slot: BaseSlot | WeekSlot) {
        setEditingMode(mode);
        setEditingSlot(slot);
        setDialogOpen(true);
    }

    function handleEnsureLink() {
        startTransition(async () => {
            try {
                const link = await getOrCreateAttendancePublicLink();
                setLinkState(link);
                toast.success('Link da recepcao pronto');
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao gerar link');
            }
        });
    }

    function handleRegenerateLink() {
        startTransition(async () => {
            try {
                const link = await regenerateAttendancePublicLink();
                setLinkState(link);
                toast.success('Link regenerado');
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao regenerar link');
            }
        });
    }

    async function copyLink() {
        if (!receptionistUrl) return;
        await navigator.clipboard.writeText(receptionistUrl);
        toast.success('Link copiado');
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_60px_-42px_rgba(24,24,27,0.32)]">
                <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,#31552d_0%,#486b36_42%,#7f9a45_100%)] px-6 py-6 text-white">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100/75">
                                {publicMode ? 'Recepcao' : 'Planilha operacional'}
                            </p>
                            <h1 className="mt-2 font-serif text-3xl leading-tight">
                                Agenda em formato de grade
                            </h1>
                            <p className="mt-3 text-sm text-emerald-50/85">
                                {publicMode
                                    ? 'Edite a semana como uma planilha: inclua nomes, remova vagas e marque presenca sem login.'
                                    : 'Mantenha uma aba fixa com os horarios recorrentes e uma aba semanal totalmente livre para a operacao.'}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                            <MetricBox label="Horarios" value={String(summary.slots)} />
                            <MetricBox label="OK" value={String(summary.present)} />
                            <MetricBox label="N" value={String(summary.absent)} />
                            <MetricBox label="Pendentes" value={String(summary.pending)} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`${basePath}?week=${prevWeek}`}>
                            <Button variant="outline" size="sm">
                                <ChevronLeft className="h-4 w-4" />
                                Semana anterior
                            </Button>
                        </Link>
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700">
                            <CalendarDays className="h-4 w-4 text-emerald-600" />
                            {weekLabel}
                        </div>
                        <Link href={`${basePath}?week=${nextWeek}`}>
                            <Button variant="outline" size="sm">
                                Proxima semana
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {!publicMode && (
                            <>
                                <TabButton active={tab === 'week'} onClick={() => setTab('week')}>
                                    Aba da semana
                                </TabButton>
                                <TabButton active={tab === 'base'} onClick={() => setTab('base')}>
                                    Agenda-base
                                </TabButton>
                            </>
                        )}

                        {(role === 'manager' || publicMode) && (
                            <select
                                value={selectedTrainer}
                                onChange={(event) => setSelectedTrainer(event.target.value)}
                                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-emerald-500"
                            >
                                <option value="all">Todos os treinadores</option>
                                {trainers.map((trainer) => (
                                    <option key={trainer.id} value={trainer.id}>
                                        {trainer.profile?.full_name}
                                    </option>
                                ))}
                            </select>
                        )}

                        <Button onClick={() => openNewSlot(publicMode ? 'week' : tab)}>
                            <Plus className="h-4 w-4" />
                            {publicMode ? 'Novo horario da semana' : tab === 'week' ? 'Novo horario da semana' : 'Novo horario fixo'}
                        </Button>
                    </div>
                </div>

                <div className="p-6">
                    <SpreadsheetGrid
                        mode={publicMode ? 'week' : tab}
                        weekDays={weekDays}
                        timeRows={timeRows}
                        baseSlots={trainerFilteredBase}
                        weekSlots={trainerFilteredWeek}
                        onNewCell={openNewSlot}
                        onEditCell={openExistingSlot}
                        participantName={participantName}
                        participantMeta={participantMeta}
                    />
                </div>
            </section>

            {!publicMode && role === 'manager' && (
                <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-42px_rgba(24,24,27,0.32)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                                Link da recepcao
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                                Agenda publica sem login
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                                Deixe a agenda aberta na recepcao com total liberdade para editar a aba da semana, sem expor dados internos do sistema.
                            </p>
                        </div>

                        {receptionistUrl ? (
                            <div className="flex flex-wrap gap-3">
                                <Button variant="outline" onClick={copyLink}>
                                    <Copy className="h-4 w-4" />
                                    Copiar
                                </Button>
                                <a href={receptionistUrl} target="_blank" rel="noreferrer">
                                    <Button variant="outline">
                                        <ExternalLink className="h-4 w-4" />
                                        Abrir link
                                    </Button>
                                </a>
                                <Button variant="secondary" onClick={handleRegenerateLink} isLoading={isPending}>
                                    <RefreshCw className="h-4 w-4" />
                                    Regenerar
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleEnsureLink} isLoading={isPending}>
                                <KeyRound className="h-4 w-4" />
                                Gerar link da recepcao
                            </Button>
                        )}
                    </div>

                    {receptionistUrl && (
                        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm text-zinc-700">
                            {receptionistUrl}
                        </div>
                    )}
                </section>
            )}

            <WeeklySlotDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                mode={publicMode ? 'week' : editingMode}
                role={role}
                publicMode={publicMode}
                publicToken={publicToken}
                slot={editingSlot as any}
                students={students}
                trainers={trainers}
                defaultTrainerId={selectedTrainer === 'all' ? undefined : selectedTrainer}
                weekStart={weekStart}
            />
        </div>
    );
}

function SpreadsheetGrid({
    mode,
    weekDays,
    timeRows,
    baseSlots,
    weekSlots,
    onNewCell,
    onEditCell,
    participantName,
    participantMeta,
}: {
    mode: TabMode;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    timeRows: string[];
    baseSlots: BaseSlot[];
    weekSlots: WeekSlot[];
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: { student?: JoinedStudent | null; guest_name?: string | null }) => string;
    participantMeta: (entry: { student?: JoinedStudent | null; guest_origin?: string | null }, slotTrainerName?: string) => string;
}) {
    const slots = mode === 'base' ? baseSlots : weekSlots;

    if (slots.length === 0) {
        return (
            <div className="rounded-[28px] border border-zinc-200 bg-zinc-100/70 p-4">
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center text-zinc-500">
                    Nenhum horario criado ainda. Use o botao de novo horario para começar a montar a grade.
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[1120px] rounded-[28px] border border-zinc-200 bg-zinc-100/70 p-4">
                <div className="grid grid-cols-[92px_repeat(5,minmax(200px,1fr))] gap-3">
                    <div className="rounded-2xl bg-zinc-900 px-4 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                        Hora
                    </div>
                    {weekDays.map((day) => (
                        <div key={day.isoDate} className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">{day.label}</p>
                            <p className="mt-1 text-lg font-semibold text-zinc-900">
                                {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                            </p>
                        </div>
                    ))}

                    {timeRows.map((time) => (
                        <GridRow
                            key={time}
                            mode={mode}
                            time={time}
                            weekDays={weekDays}
                            slots={slots}
                            onNewCell={onNewCell}
                            onEditCell={onEditCell}
                            participantName={participantName}
                            participantMeta={participantMeta}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function GridRow({
    mode,
    time,
    weekDays,
    slots,
    onNewCell,
    onEditCell,
    participantName,
    participantMeta,
}: {
    mode: TabMode;
    time: string;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    slots: (BaseSlot | WeekSlot)[];
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: any) => string;
    participantMeta: (entry: any, trainerName?: string) => string;
}) {
    return (
        <>
            <div className="rounded-2xl bg-zinc-900 px-4 py-5 text-center text-xl font-semibold text-white shadow-sm">
                {formatTimeLabel(time)}
            </div>
            {weekDays.map((day) => {
                const cellSlots = slots.filter((item) => item.weekday === day.value && item.start_time === time);

                if (cellSlots.length === 0) {
                    return (
                        <button
                            key={`${time}-${day.isoDate}`}
                            type="button"
                            onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                            className="min-h-[150px] rounded-2xl border border-dashed border-zinc-300 bg-white/85 px-4 py-6 text-left text-sm text-zinc-400 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                            <span className="font-medium">Adicionar horario</span>
                        </button>
                    );
                }

                return (
                    <div
                        key={`${time}-${day.isoDate}`}
                        className="min-h-[150px] rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm"
                    >
                        <div className="space-y-3">
                            {cellSlots.map((slot) => (
                                <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => onEditCell(mode, slot)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            {slot.trainer?.profile?.full_name && (
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                                                    {slot.trainer.profile.full_name}
                                                </p>
                                            )}
                                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600 ring-1 ring-zinc-200">
                                                <Users className="h-3.5 w-3.5" />
                                                {slot.entries.length}/{slot.capacity}
                                            </div>
                                        </div>
                                        <div className="text-xs font-medium text-zinc-400">Editar</div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {Array.from({ length: slot.capacity }).map((_, index) => {
                                            const entry = slot.entries[index];

                                            if (!entry) {
                                                return (
                                                    <div key={index} className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-350">
                                                        Vaga livre
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={entry.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="truncate text-sm font-medium text-zinc-900">{participantName(entry)}</p>
                                                        {'status' in entry && (
                                                            <StatusMark status={entry.status} />
                                                        )}
                                                    </div>
                                                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                                                        {participantMeta(entry, slot.trainer?.profile?.full_name)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                                className="w-full rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-center text-xs font-medium text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
                            >
                                Adicionar outro treinador
                            </button>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function StatusMark({ status }: { status: AttendanceStatus }) {
    const config = {
        pending: 'bg-zinc-200 text-zinc-700',
        present: 'bg-emerald-100 text-emerald-700',
        absent: 'bg-red-100 text-red-700',
    }[status];

    return (
        <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]', config)}>
            {status === 'pending' ? '-' : status === 'present' ? 'OK' : 'N'}
        </span>
    );
}

function MetricBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-50/70">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                active ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900'
            )}
        >
            {children}
        </button>
    );
}
