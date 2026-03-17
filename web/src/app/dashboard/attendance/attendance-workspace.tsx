'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, KeyRound, Plus, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AttendanceCheckbox } from '@/components/attendance/attendance-checkbox';
import { SlotCellPopover } from '@/components/attendance/slot-cell-popover';
import { getOrCreateAttendancePublicLink, regenerateAttendancePublicLink } from '@/app/actions/attendance';
import { formatTimeLabel, WEEKDAY_OPTIONS } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type {
    AttendancePublicLink,
    Profile,
    ScheduleBaseEntry,
    ScheduleBaseSlot,
    ScheduleWeekEntry,
    ScheduleWeekSlot,
    Student,
    Trainer,
} from '@/types/database';
import { WeeklySlotDialog } from './weekly-slot-dialog';
import { AttendanceStatsPopover, type AttendanceDetail } from './attendance-stats-popover';

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
    const router = useRouter();
    const [tab, setTab] = useState<TabMode>('week');
    const [selectedTrainer, setSelectedTrainer] = useState('all');
    const [editingMode, setEditingMode] = useState<TabMode>('week');
    const [editingSlot, setEditingSlot] = useState<BaseSlot | WeekSlot | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [linkState, setLinkState] = useState(publicLink);
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');

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
        let capacity = 0;

        source.forEach((slot) => {
            capacity += slot.capacity;
            slot.entries.forEach((entry) => {
                if (entry.status === 'present') present += 1;
                else if (entry.status === 'absent') absent += 1;
                else pending += 1;
            });
        });

        return {
            slots: source.length,
            capacity,
            present,
            absent,
            pending,
        };
    }, [trainerFilteredWeek]);

    const attendanceDetails = useMemo(() => {
        const present: AttendanceDetail[] = [];
        const absent: AttendanceDetail[] = [];

        for (const slot of trainerFilteredWeek) {
            const trainerName = slot.trainer?.profile?.full_name || '';
            for (const entry of slot.entries) {
                const studentName = entry.student?.full_name || entry.guest_name || 'Sem nome';
                const isGuest = !entry.student_id && !!entry.guest_name;
                const detail: AttendanceDetail = {
                    studentName,
                    isGuest,
                    trainerName,
                    weekday: slot.weekday,
                    startTime: slot.start_time,
                };
                if (entry.status === 'present') present.push(detail);
                else if (entry.status === 'absent') absent.push(detail);
            }
        }

        return { present, absent };
    }, [trainerFilteredWeek]);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!q) return { matchedSlotIds: new Set<string>(), matchedEntryIds: new Set<string>(), grouped: [] as { name: string; isGuest: boolean; slots: { weekday: number; startTime: string; trainerName: string }[] }[] };

        const source = tab === 'base' ? trainerFilteredBase : trainerFilteredWeek;
        const matchedSlotIds = new Set<string>();
        const matchedEntryIds = new Set<string>();
        const byName = new Map<string, { name: string; isGuest: boolean; slots: { weekday: number; startTime: string; trainerName: string }[] }>();

        for (const slot of source) {
            for (const entry of slot.entries as any[]) {
                const entryName: string = entry.student?.full_name || entry.guest_name || '';
                const normalized = entryName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normalized.includes(q)) {
                    matchedSlotIds.add(slot.id);
                    matchedEntryIds.add(entry.id);
                    const isGuest = !entry.student_id && !!entry.guest_name;
                    const key = `${entryName}|${isGuest ? '1' : '0'}`;
                    if (!byName.has(key)) {
                        byName.set(key, { name: entryName, isGuest, slots: [] });
                    }
                    byName.get(key)!.slots.push({
                        weekday: slot.weekday,
                        startTime: slot.start_time,
                        trainerName: slot.trainer?.profile?.full_name || '',
                    });
                }
            }
        }

        return { matchedSlotIds, matchedEntryIds, grouped: Array.from(byName.values()) };
    }, [searchQuery, tab, trainerFilteredBase, trainerFilteredWeek]);

    const isSearching = searchQuery.trim().length > 0;

    function participantName(entry: { student?: JoinedStudent | null; guest_name?: string | null }) {
        return entry.student?.full_name || entry.guest_name || 'Vaga livre';
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
                toast.success('Link da recepção pronto');
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

    useEffect(() => {
        function refreshAgenda() {
            if (dialogOpen || isPending || document.visibilityState !== 'visible') {
                return;
            }

            router.refresh();
        }

        const intervalId = window.setInterval(refreshAgenda, 15000);
        window.addEventListener('focus', refreshAgenda);
        document.addEventListener('visibilitychange', refreshAgenda);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshAgenda);
            document.removeEventListener('visibilitychange', refreshAgenda);
        };
    }, [dialogOpen, isPending, router]);

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_60px_-42px_rgba(24,24,27,0.32)]">
                <div className="border-b border-zinc-200 bg-zinc-900 text-white">
                    <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)] lg:px-6">
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-zinc-400">
                                {publicMode ? 'Recepção' : 'Planilha operacional'}
                            </p>

                            <div className="max-w-3xl">
                                <h1 className="text-[1.75rem] font-semibold leading-none sm:text-[2rem]">
                                    Agenda Propulse
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                                    {publicMode ? 'Agenda da recepção.' : 'Agenda operacional do estúdio.'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricBox label="Horários" value={String(summary.slots)} />
                            <MetricBox label="Vagas" value={String(summary.capacity)} />
                            <AttendanceStatsPopover
                                title="Presentes"
                                count={summary.present}
                                details={attendanceDetails.present}
                                variant="present"
                            >
                                <button className="cursor-pointer transition-opacity hover:opacity-80 text-left">
                                    <MetricBox label="Presentes" value={String(summary.present)} />
                                </button>
                            </AttendanceStatsPopover>
                            <AttendanceStatsPopover
                                title="Faltas"
                                count={summary.absent}
                                details={attendanceDetails.absent}
                                variant="absent"
                            >
                                <button className="cursor-pointer transition-opacity hover:opacity-80 text-left">
                                    <MetricBox label="Faltas" value={String(summary.absent)} />
                                </button>
                            </AttendanceStatsPopover>
                        </div>
                    </div>
                </div>

                <div className="border-b border-zinc-200 bg-zinc-50/90 px-5 py-4 lg:px-6">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`${basePath}?week=${prevWeek}`}>
                                <Button variant="outline" size="sm">
                                    <ChevronLeft className="h-4 w-4" />
                                    Semana anterior
                                </Button>
                            </Link>
                            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700">
                                <CalendarDays className="h-4 w-4 text-emerald-600" />
                                {weekLabel}
                            </div>
                            <Link href={`${basePath}?week=${nextWeek}`}>
                                <Button variant="outline" size="sm">
                                    Próxima semana
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <TabButton active={tab === 'week'} onClick={() => setTab('week')}>
                                Aba da semana
                            </TabButton>
                            <TabButton active={tab === 'base'} onClick={() => setTab('base')}>
                                Horários fixos
                            </TabButton>

                            {(role === 'manager' || publicMode) && (
                                <select
                                    value={selectedTrainer}
                                    onChange={(event) => setSelectedTrainer(event.target.value)}
                                    className="h-10 rounded-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 outline-none focus:border-emerald-500"
                                >
                                    <option value="all">Todos os treinadores</option>
                                    {trainers.map((trainer) => (
                                        <option key={trainer.id} value={trainer.id}>
                                            {trainer.profile?.full_name}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <Button onClick={() => openNewSlot(tab)}>
                                <Plus className="h-4 w-4" />
                                {tab === 'week' ? 'Novo horário da semana' : 'Novo horário fixo'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-5 lg:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-zinc-950">
                            {tab === 'week' ? 'Aba da semana' : 'Horários fixos'}
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar aluno..."
                                    className="h-9 w-48 rounded-full border border-zinc-200 bg-white pl-9 pr-8 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 xl:w-64"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:text-zinc-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <SurfacePill label="Linhas" value={String(timeRows.length)} />
                            <SurfacePill label="Pendentes" value={String(summary.pending)} />
                        </div>
                    </div>

                    {isSearching && (
                        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                            {searchResults.grouped.length === 0 ? (
                                <p className="text-sm text-zinc-400">Nenhum aluno encontrado</p>
                            ) : (
                                <div className="space-y-2">
                                    {searchResults.grouped.map((group) => (
                                        <div key={`${group.name}|${group.isGuest}`}>
                                            <p className="text-sm font-medium text-zinc-900">
                                                {group.name}
                                                {group.isGuest && <span className="ml-1 text-xs font-normal text-zinc-400">(avulso)</span>}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {group.slots.map((s, i) => {
                                                    const dayLabel = WEEKDAY_OPTIONS.find((d) => d.value === s.weekday)?.label || '';
                                                    return `${i > 0 ? ' · ' : ''}${dayLabel} ${formatTimeLabel(s.startTime)}`;
                                                }).join('')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <SpreadsheetGrid
                        mode={tab}
                        weekDays={weekDays}
                        timeRows={timeRows}
                        baseSlots={trainerFilteredBase}
                        weekSlots={trainerFilteredWeek}
                        students={students}
                        publicMode={publicMode}
                        publicToken={publicToken}
                        onNewCell={openNewSlot}
                        onEditCell={openExistingSlot}
                        participantName={participantName}
                        isSearching={isSearching}
                        matchedSlotIds={searchResults.matchedSlotIds}
                        matchedEntryIds={searchResults.matchedEntryIds}
                    />
                </div>
            </section>

            {!publicMode && role === 'manager' && (
                <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_20px_50px_-42px_rgba(24,24,27,0.32)]">
                    <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] lg:px-6">
                        <div>
                            <p className="text-xs font-medium text-zinc-400">
                                Link da recepção
                            </p>
                            <h2 className="mt-2 text-xl font-semibold text-zinc-900">
                                Agenda pública
                            </h2>
                            <p className="mt-2 max-w-lg text-sm text-zinc-500">
                                Link para a recepção operar a agenda sem login.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <SurfacePill label="Recepção" value="Sem login" />
                                <SurfacePill label="Escopo" value="Agenda" />
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                            {receptionistUrl ? (
                                <>
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-6 text-zinc-600">
                                        {receptionistUrl}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
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
                                </>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
                                    <Button onClick={handleEnsureLink} isLoading={isPending}>
                                        <KeyRound className="h-4 w-4" />
                                        Gerar link da recepção
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            <WeeklySlotDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                mode={editingMode}
                role={role}
                publicMode={publicMode}
                publicToken={publicToken}
                slot={editingSlot as any}
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
    students,
    publicMode,
    publicToken,
    onNewCell,
    onEditCell,
    participantName,
    isSearching,
    matchedSlotIds,
    matchedEntryIds,
}: {
    mode: TabMode;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    timeRows: string[];
    baseSlots: BaseSlot[];
    weekSlots: WeekSlot[];
    students: JoinedStudent[];
    publicMode?: boolean;
    publicToken?: string;
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: { student?: JoinedStudent | null; guest_name?: string | null }) => string;
    isSearching: boolean;
    matchedSlotIds: Set<string>;
    matchedEntryIds: Set<string>;
}) {
    const slots = mode === 'base' ? baseSlots : weekSlots;

    if (slots.length === 0) {
        return (
            <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f3f4f6_100%)] p-4">
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
                    <h3 className="text-2xl font-semibold text-zinc-900">
                        Nenhum horário criado
                    </h3>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button onClick={() => onNewCell(mode)}>
                            <Plus className="h-4 w-4" />
                            {mode === 'week' ? 'Criar horário da semana' : 'Criar horário fixo'}
                        </Button>
                        <button
                            type="button"
                            onClick={() => onNewCell(mode, 1, '06:00')}
                            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                            Começar por segunda, 06:00
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="xl:hidden">
                <MobileAgendaStack
                    mode={mode}
                    weekDays={weekDays}
                    timeRows={timeRows}
                    slots={slots}
                    students={students}
                    publicMode={publicMode}
                    publicToken={publicToken}
                    onNewCell={onNewCell}
                    onEditCell={onEditCell}
                    participantName={participantName}
                    isSearching={isSearching}
                    matchedSlotIds={matchedSlotIds}
                    matchedEntryIds={matchedEntryIds}
                />
            </div>

            <div className="hidden xl:block overflow-x-auto">
                <div className="min-w-[1120px] rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#fcfcfb_0%,#f1f5f2_100%)] p-3">
                    <div className="grid grid-cols-[92px_repeat(5,minmax(200px,1fr))] gap-2.5">
                    <div className="rounded-[20px] bg-zinc-800 px-4 py-4 text-xs font-medium text-zinc-400">
                        Hora
                    </div>
                    {weekDays.map((day, index) => (
                        <div key={day.isoDate} className="rounded-[20px] bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-emerald-700">{day.label}</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                                        {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                                    </p>
                                </div>
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                    D{index + 1}
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-zinc-400">
                                Clique nas vagas livres para preencher rápido.
                            </p>
                        </div>
                    ))}

                    {timeRows.map((time, index) => (
                        <GridRow
                            key={time}
                            mode={mode}
                            time={time}
                            rowIndex={index}
                            weekDays={weekDays}
                            slots={slots}
                            students={students}
                            publicMode={publicMode}
                            publicToken={publicToken}
                            onNewCell={onNewCell}
                            onEditCell={onEditCell}
                            participantName={participantName}
                            isSearching={isSearching}
                            matchedSlotIds={matchedSlotIds}
                            matchedEntryIds={matchedEntryIds}
                        />
                    ))}
                    </div>
                </div>
            </div>
        </>
    );
}

function GridRow({
    mode,
    time,
    rowIndex,
    weekDays,
    slots,
    students,
    publicMode,
    publicToken,
    onNewCell,
    onEditCell,
    participantName,
    isSearching,
    matchedSlotIds,
    matchedEntryIds,
}: {
    mode: TabMode;
    time: string;
    rowIndex: number;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    slots: (BaseSlot | WeekSlot)[];
    students: JoinedStudent[];
    publicMode?: boolean;
    publicToken?: string;
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: any) => string;
    isSearching: boolean;
    matchedSlotIds: Set<string>;
    matchedEntryIds: Set<string>;
}) {
    return (
        <>
            <div className={cn(
                'rounded-[20px] px-4 py-5 text-center text-xl font-semibold text-white',
                rowIndex % 2 === 0 ? 'bg-zinc-800' : 'bg-zinc-700'
            )}>
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
                            title="Adicionar horário"
                            className={cn(
                                'flex min-h-[120px] items-center justify-center rounded-[20px] border border-dashed border-zinc-300 bg-white text-zinc-300 transition-opacity duration-200 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-600',
                                isSearching && 'opacity-30'
                            )}
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    );
                }

                return (
                    <div
                        key={`${time}-${day.isoDate}`}
                        className="min-h-[120px] rounded-[20px] border border-zinc-200 bg-white p-2 text-left shadow-sm"
                    >
                        <div className="space-y-2">
                            {cellSlots.map((slot, slotIndex) => {
                                const remaining = slot.capacity - slot.entries.length;
                                const capacityColor = remaining === slot.capacity
                                    ? 'bg-zinc-50 text-zinc-400'
                                    : remaining === 0
                                        ? 'bg-red-50 text-red-500'
                                        : remaining === 1
                                            ? 'bg-amber-50 text-amber-600'
                                            : 'bg-emerald-50 text-emerald-600';

                                return (
                                    <SlotCellPopover
                                        key={slot.id}
                                        slot={slot}
                                        students={students}
                                        mode={mode}
                                        publicMode={publicMode}
                                        publicToken={publicToken}
                                        onEditSlot={() => onEditCell(mode, slot)}
                                    >
                                        <button
                                            type="button"
                                            className={cn(
                                                'w-full rounded-[16px] border bg-zinc-50/80 p-2.5 text-left transition-all duration-200 hover:border-emerald-300 hover:bg-white hover:shadow-sm',
                                                slotIndex === 0 ? 'border-zinc-200' : 'border-zinc-200/80',
                                                isSearching && matchedSlotIds.has(slot.id) && 'ring-2 ring-emerald-400 border-emerald-300',
                                                isSearching && !matchedSlotIds.has(slot.id) && 'opacity-40',
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {slot.trainer?.profile?.full_name && (
                                                    <p className="truncate text-sm font-medium text-zinc-700">
                                                        {slot.trainer.profile.full_name}
                                                    </p>
                                                )}
                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', capacityColor)}>
                                                    {slot.entries.length}/{slot.capacity}
                                                </span>
                                            </div>

                                            <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto">
                                                {(slot.entries as any[]).map((entry: any) => {
                                                    const entryHighlighted = isSearching && matchedEntryIds.has(entry.id);

                                                    if (mode === 'week' && 'status' in entry) {
                                                        return (
                                                            <AttendanceCheckbox
                                                                key={entry.id}
                                                                entryId={entry.id}
                                                                status={entry.status}
                                                                name={participantName(entry)}
                                                                isGuest={!entry.student_id && !!entry.guest_name}
                                                                publicMode={publicMode}
                                                                publicToken={publicToken}
                                                                highlighted={entryHighlighted}
                                                            />
                                                        );
                                                    }

                                                    return (
                                                        <div key={entry.id} className={cn(
                                                            'min-h-[28px] rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200',
                                                            entryHighlighted && 'ring-2 ring-emerald-400 bg-emerald-50',
                                                        )}>
                                                            <p className={cn(
                                                                'truncate text-sm font-medium text-zinc-900',
                                                                entryHighlighted && 'text-emerald-700 font-semibold',
                                                            )}>{participantName(entry)}</p>
                                                        </div>
                                                    );
                                                })}

                                                {remaining > 0 && slot.entries.length > 0 && (
                                                    <div className="flex min-h-[28px] items-center rounded-lg border border-dashed border-zinc-200 bg-white/70 px-2.5 py-1.5 text-xs text-zinc-400">
                                                        + Adicionar aluno
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    </SlotCellPopover>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                                title="Adicionar outro treinador"
                                className="flex w-full items-center justify-center rounded-[16px] border border-dashed border-zinc-300 py-2 text-zinc-300 transition hover:border-emerald-300 hover:text-emerald-600"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function MetricBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
    );
}

function MobileAgendaStack({
    mode,
    weekDays,
    timeRows,
    slots,
    students,
    publicMode,
    publicToken,
    onNewCell,
    onEditCell,
    participantName,
    isSearching,
    matchedSlotIds,
    matchedEntryIds,
}: {
    mode: TabMode;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    timeRows: string[];
    slots: (BaseSlot | WeekSlot)[];
    students: JoinedStudent[];
    publicMode?: boolean;
    publicToken?: string;
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: any) => string;
    isSearching: boolean;
    matchedSlotIds: Set<string>;
    matchedEntryIds: Set<string>;
}) {
    return (
        <div className="space-y-4">
            {weekDays.map((day) => {
                const daySlots = slots.filter((slot) => slot.weekday === day.value);
                const dayTimes = timeRows.filter((time) => daySlots.some((slot) => slot.start_time === time));

                return (
                    <section key={day.isoDate} className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
                        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-emerald-700">{day.label}</p>
                                    <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                                        {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onNewCell(mode, day.value, '06:00')}
                                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600"
                                >
                                    + horário
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 p-4">
                            {dayTimes.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => onNewCell(mode, day.value, '06:00')}
                                    className="w-full rounded-[18px] border border-dashed border-zinc-300 px-4 py-6 text-left text-sm text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
                                >
                                    Adicionar primeiro horário do dia
                                </button>
                            ) : (
                                dayTimes.map((time) => {
                                    const timeSlots = daySlots.filter((slot) => slot.start_time === time);

                                    return (
                                        <div key={`${day.isoDate}-${time}`} className="space-y-2">
                                            <div className="flex items-center justify-between rounded-[18px] bg-zinc-800 px-4 py-3 text-white">
                                                <span className="text-lg font-semibold">{formatTimeLabel(time)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                                                    className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-zinc-200"
                                                >
                                                    + treinador
                                                </button>
                                            </div>

                                            {timeSlots.map((slot) => {
                                                const remaining = slot.capacity - slot.entries.length;
                                                const capacityColor = remaining === slot.capacity
                                                    ? 'bg-zinc-50 text-zinc-400'
                                                    : remaining === 0
                                                        ? 'bg-red-50 text-red-500'
                                                        : remaining === 1
                                                            ? 'bg-amber-50 text-amber-600'
                                                            : 'bg-emerald-50 text-emerald-600';

                                                return (
                                                    <SlotCellPopover
                                                        key={slot.id}
                                                        slot={slot}
                                                        students={students}
                                                        mode={mode}
                                                        publicMode={publicMode}
                                                        publicToken={publicToken}
                                                        onEditSlot={() => onEditCell(mode, slot)}
                                                    >
                                                        <div className={cn(
                                                            'w-full rounded-[18px] border border-zinc-200 bg-zinc-50/80 p-3 text-left transition-all duration-200 cursor-pointer',
                                                            isSearching && matchedSlotIds.has(slot.id) && 'ring-2 ring-emerald-400 border-emerald-300',
                                                            isSearching && !matchedSlotIds.has(slot.id) && 'opacity-40',
                                                        )}>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="truncate text-sm font-medium text-zinc-700">
                                                                    {slot.trainer?.profile?.full_name || 'Treinador'}
                                                                </p>
                                                                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', capacityColor)}>
                                                                    {slot.entries.length}/{slot.capacity}
                                                                </span>
                                                            </div>

                                                            <div className="mt-2.5 space-y-1.5">
                                                                {(slot.entries as any[]).map((entry: any) => {
                                                                    const entryHighlighted = isSearching && matchedEntryIds.has(entry.id);

                                                                    if (mode === 'week' && 'status' in entry) {
                                                                        return (
                                                                            <AttendanceCheckbox
                                                                                key={entry.id}
                                                                                entryId={entry.id}
                                                                                status={entry.status}
                                                                                name={participantName(entry)}
                                                                                isGuest={!entry.student_id && !!entry.guest_name}
                                                                                publicMode={publicMode}
                                                                                publicToken={publicToken}
                                                                                highlighted={entryHighlighted}
                                                                            />
                                                                        );
                                                                    }

                                                                    return (
                                                                        <div key={entry.id} className={cn(
                                                                            'min-h-[28px] rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200',
                                                                            entryHighlighted && 'ring-2 ring-emerald-400 bg-emerald-50',
                                                                        )}>
                                                                            <p className={cn(
                                                                                'truncate text-sm font-medium text-zinc-900',
                                                                                entryHighlighted && 'text-emerald-700 font-semibold',
                                                                            )}>{participantName(entry)}</p>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {remaining > 0 && slot.entries.length > 0 && (
                                                                    <div className="flex min-h-[28px] items-center rounded-lg border border-dashed border-zinc-200 bg-white/70 px-2.5 py-1.5 text-xs text-zinc-400">
                                                                        + Adicionar aluno
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </SlotCellPopover>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function SurfacePill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-full border border-zinc-200 bg-white px-3 py-2">
            <span className="text-xs text-zinc-400">{label}</span>
            <span className="ml-2 text-sm font-medium text-zinc-700">{value}</span>
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
                active ? 'bg-zinc-950 text-white shadow-sm' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-zinc-900'
            )}
        >
            {children}
        </button>
    );
}
