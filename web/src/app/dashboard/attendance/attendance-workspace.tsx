'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    const router = useRouter();
    const [tab, setTab] = useState<TabMode>('week');
    const [selectedTrainer, setSelectedTrainer] = useState('all');
    const [editingMode, setEditingMode] = useState<TabMode>('week');
    const [editingSlot, setEditingSlot] = useState<BaseSlot | WeekSlot | undefined>();
    const [autoAddEntry, setAutoAddEntry] = useState(false);
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

    function participantName(entry: { student?: JoinedStudent | null; guest_name?: string | null }) {
        return entry.student?.full_name || entry.guest_name || 'Vaga livre';
    }

    function participantMeta(entry: { student?: JoinedStudent | null; guest_origin?: string | null }, slotTrainerName?: string) {
        return entry.student?.trainer?.profile?.full_name || entry.guest_origin || slotTrainerName || '';
    }

    function openNewSlot(mode: TabMode, weekday?: number, startTime?: string) {
        setEditingMode(mode);
        setAutoAddEntry(false);
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
        setAutoAddEntry(false);
        setDialogOpen(true);
    }

    function openVacancy(mode: TabMode, slot: BaseSlot | WeekSlot) {
        setEditingMode(mode);
        setEditingSlot(slot);
        setAutoAddEntry(true);
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
                <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,#214728_0%,#406733_44%,#899f47_100%)] text-white">
                    <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.95fr)] lg:px-6">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-100/80">
                                    {publicMode ? 'Recepcao' : 'Planilha operacional'}
                                </p>
                                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-50/80">
                                    Atualizacao automatica ativa
                                </div>
                            </div>

                            <div className="max-w-3xl">
                                <h1 className="font-serif text-[2.35rem] leading-none sm:text-[2.8rem]">
                                    Agenda Propulse
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm text-emerald-50/85 sm:text-[15px]">
                                    {publicMode
                                        ? 'Uma grade operacional para a recepcao editar a semana com rapidez, sem login e sem ruído.'
                                        : 'Uma grade viva para montar horarios fixos, ajustar a semana e alimentar a operacao em tempo real.'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-emerald-50/85">
                                <OperationalChip label={tab === 'week' ? 'Modo ativo' : 'Modo ativo'} value={tab === 'week' ? 'Aba da semana' : 'Horarios fixos'} />
                                <OperationalChip label="Semana" value={weekLabel} />
                                <OperationalChip label="Treinadores" value={selectedTrainer === 'all' ? 'Todos' : trainers.find((trainer) => trainer.id === selectedTrainer)?.profile?.full_name || 'Filtrado'} />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricBox label="Horarios" value={String(summary.slots)} hint="blocos ativos" />
                            <MetricBox label="Vagas" value={String(summary.capacity)} hint="capacidade total" />
                            <MetricBox label="OK" value={String(summary.present)} hint="presencas" />
                            <MetricBox label="Falta" value={String(summary.absent)} hint="faltas" />
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
                                    Proxima semana
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <TabButton active={tab === 'week'} onClick={() => setTab('week')}>
                                Aba da semana
                            </TabButton>
                            <TabButton active={tab === 'base'} onClick={() => setTab('base')}>
                                Horarios fixos
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
                                {tab === 'week' ? 'Novo horario da semana' : 'Novo horario fixo'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-5 lg:p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                                {publicMode ? 'Recepcao' : 'Planilha operacional'}
                            </p>
                            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                                {tab === 'week' ? 'Grade operacional da semana' : 'Grade recorrente dos horarios fixos'}
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                {tab === 'week'
                                    ? 'Adicione alunos, mova a ocupacao da semana e ajuste a grade conforme a operacao real.'
                                    : 'Monte a espinha dorsal da agenda e replique a base com menos trabalho manual.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <SurfacePill label="Status" value={timeRows.length > 0 ? 'Grade pronta para edicao' : 'Sem blocos montados'} />
                            <SurfacePill label="Linhas" value={String(timeRows.length)} />
                            <SurfacePill label="Pendentes" value={String(summary.pending)} />
                        </div>
                    </div>
                    <SpreadsheetGrid
                        mode={tab}
                        weekDays={weekDays}
                        timeRows={timeRows}
                        baseSlots={trainerFilteredBase}
                        weekSlots={trainerFilteredWeek}
                        onNewCell={openNewSlot}
                        onEditCell={openExistingSlot}
                        onVacancyClick={openVacancy}
                        participantName={participantName}
                        participantMeta={participantMeta}
                    />
                </div>
            </section>

            {!publicMode && role === 'manager' && (
                <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_20px_50px_-42px_rgba(24,24,27,0.32)]">
                    <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:px-6">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                                Link da recepcao
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                                Agenda publica sem login
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                                Deixe a agenda aberta na recepcao com liberdade para editar a semana e os horarios fixos, sem expor o restante do sistema.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <SurfacePill label="Escopo" value="Recepcao" />
                                <SurfacePill label="Permissao" value="Agenda e presenca" />
                                <SurfacePill label="Login" value="Nao exige" />
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                                Operacao externa
                            </p>
                            {receptionistUrl ? (
                                <>
                                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-6 text-zinc-600">
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
                                <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
                                    <p className="text-sm text-zinc-500">
                                        Gere um link permanente para deixar a agenda aberta na recepcao.
                                    </p>
                                    <Button className="mt-4" onClick={handleEnsureLink} isLoading={isPending}>
                                        <KeyRound className="h-4 w-4" />
                                        Gerar link da recepcao
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
                students={students}
                trainers={trainers}
                defaultTrainerId={selectedTrainer === 'all' ? undefined : selectedTrainer}
                weekStart={weekStart}
                autoAddEntry={autoAddEntry}
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
    onVacancyClick,
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
    onVacancyClick: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: { student?: JoinedStudent | null; guest_name?: string | null }) => string;
    participantMeta: (entry: { student?: JoinedStudent | null; guest_origin?: string | null }, slotTrainerName?: string) => string;
}) {
    const slots = mode === 'base' ? baseSlots : weekSlots;

    if (slots.length === 0) {
        return (
            <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f3f4f6_100%)] p-4">
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                        Grade vazia
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-zinc-900">
                        Nenhum horario criado ainda
                    </h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500">
                        Comece criando a estrutura principal da agenda. Depois a operacao pode preencher vagas, mover nomes e ajustar a semana como planilha.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button onClick={() => onNewCell(mode)}>
                            <Plus className="h-4 w-4" />
                            {mode === 'week' ? 'Criar horario da semana' : 'Criar horario fixo'}
                        </Button>
                        <button
                            type="button"
                            onClick={() => onNewCell(mode, 1, '06:00')}
                            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                            Comecar por segunda, 06:00
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
                    onNewCell={onNewCell}
                    onEditCell={onEditCell}
                    onVacancyClick={onVacancyClick}
                    participantName={participantName}
                    participantMeta={participantMeta}
                />
            </div>

            <div className="hidden xl:block overflow-x-auto">
                <div className="min-w-[1120px] rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#fcfcfb_0%,#f1f5f2_100%)] p-3">
                    <div className="grid grid-cols-[92px_repeat(5,minmax(200px,1fr))] gap-2.5">
                    <div className="rounded-[20px] bg-zinc-950 px-4 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                        Hora
                    </div>
                    {weekDays.map((day, index) => (
                        <div key={day.isoDate} className="rounded-[20px] bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">{day.label}</p>
                                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                                        {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                                    </p>
                                </div>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                    D{index + 1}
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-zinc-400">
                                Clique nas vagas livres para preencher rapido.
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
                            onNewCell={onNewCell}
                            onEditCell={onEditCell}
                            onVacancyClick={onVacancyClick}
                            participantName={participantName}
                            participantMeta={participantMeta}
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
    onNewCell,
    onEditCell,
    onVacancyClick,
    participantName,
    participantMeta,
}: {
    mode: TabMode;
    time: string;
    rowIndex: number;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    slots: (BaseSlot | WeekSlot)[];
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    onVacancyClick: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: any) => string;
    participantMeta: (entry: any, trainerName?: string) => string;
}) {
    return (
        <>
            <div className={cn(
                'rounded-[20px] px-4 py-5 text-center text-xl font-semibold text-white shadow-sm',
                rowIndex % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900'
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
                            className="min-h-[154px] rounded-[20px] border border-dashed border-zinc-300 bg-white px-4 py-5 text-left text-sm text-zinc-400 transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700"
                        >
                            <span className="font-medium">Adicionar horario</span>
                            <p className="mt-2 text-xs text-zinc-400">
                                Abra um bloco novo nessa combinacao de dia e hora.
                            </p>
                        </button>
                    );
                }

                return (
                    <div
                        key={`${time}-${day.isoDate}`}
                        className="min-h-[154px] rounded-[20px] border border-zinc-200 bg-white p-2.5 text-left shadow-sm"
                    >
                        <div className="space-y-2.5">
                            {cellSlots.map((slot, slotIndex) => (
                                <div
                                    key={slot.id}
                                    className={cn(
                                        'rounded-[18px] border bg-zinc-50/80 p-3 text-left transition hover:border-emerald-300 hover:bg-white hover:shadow-sm',
                                        slotIndex === 0 ? 'border-zinc-200' : 'border-zinc-200/80'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            {slot.trainer?.profile?.full_name && (
                                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                                                    {slot.trainer.profile.full_name}
                                                </p>
                                            )}
                                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 ring-1 ring-zinc-200">
                                                <Users className="h-3.5 w-3.5" />
                                                {slot.entries.length}/{slot.capacity}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onEditCell(mode, slot)}
                                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
                                        >
                                            Editar
                                        </button>
                                    </div>

                                    <div className="mt-3 space-y-1.5">
                                        {Array.from({ length: slot.capacity }).map((_, index) => {
                                            const entry = slot.entries[index];

                                            if (!entry) {
                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => onVacancyClick(mode, slot)}
                                                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-200 bg-white/70 px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-emerald-300 hover:text-emerald-700"
                                                    >
                                                        <span>Vaga livre</span>
                                                        <span className="text-[10px] uppercase tracking-[0.18em]">+ aluno</span>
                                                    </button>
                                                );
                                            }

                                            return (
                                                <div key={entry.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200">
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
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                                className="w-full rounded-[18px] border border-dashed border-zinc-300 px-3 py-3 text-center text-xs font-medium text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
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
            {status === 'pending' ? '-' : status === 'present' ? 'OK' : 'Falta'}
        </span>
    );
}

function MetricBox({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-50/70">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/55">{hint}</p>
        </div>
    );
}

function MobileAgendaStack({
    mode,
    weekDays,
    timeRows,
    slots,
    onNewCell,
    onEditCell,
    onVacancyClick,
    participantName,
    participantMeta,
}: {
    mode: TabMode;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    timeRows: string[];
    slots: (BaseSlot | WeekSlot)[];
    onNewCell: (mode: TabMode, weekday?: number, startTime?: string) => void;
    onEditCell: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    onVacancyClick: (mode: TabMode, slot: BaseSlot | WeekSlot) => void;
    participantName: (entry: any) => string;
    participantMeta: (entry: any, trainerName?: string) => string;
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
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">{day.label}</p>
                                    <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                                        {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onNewCell(mode, day.value, '06:00')}
                                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600"
                                >
                                    + horario
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
                                    Adicionar primeiro horario do dia
                                </button>
                            ) : (
                                dayTimes.map((time) => {
                                    const timeSlots = daySlots.filter((slot) => slot.start_time === time);

                                    return (
                                        <div key={`${day.isoDate}-${time}`} className="space-y-2">
                                            <div className="flex items-center justify-between rounded-[18px] bg-zinc-950 px-4 py-3 text-white">
                                                <span className="text-lg font-semibold">{formatTimeLabel(time)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onNewCell(mode, day.value, time.slice(0, 5))}
                                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-100"
                                                >
                                                    + treinador
                                                </button>
                                            </div>

                                            {timeSlots.map((slot) => (
                                                <div key={slot.id} className="rounded-[18px] border border-zinc-200 bg-zinc-50/80 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                                                                {slot.trainer?.profile?.full_name || 'Treinador'}
                                                            </p>
                                                            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 ring-1 ring-zinc-200">
                                                                <Users className="h-3.5 w-3.5" />
                                                                {slot.entries.length}/{slot.capacity}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => onEditCell(mode, slot)}
                                                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                                                        >
                                                            Editar
                                                        </button>
                                                    </div>

                                                    <div className="mt-3 space-y-1.5">
                                                        {Array.from({ length: slot.capacity }).map((_, index) => {
                                                            const entry = slot.entries[index];

                                                            if (!entry) {
                                                                return (
                                                                    <button
                                                                        key={index}
                                                                        type="button"
                                                                        onClick={() => onVacancyClick(mode, slot)}
                                                                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-400"
                                                                    >
                                                                        <span>Vaga livre</span>
                                                                        <span className="text-[10px] uppercase tracking-[0.18em]">+ aluno</span>
                                                                    </button>
                                                                );
                                                            }

                                                            return (
                                                                <div key={entry.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <p className="truncate text-sm font-medium text-zinc-900">{participantName(entry)}</p>
                                                                        {'status' in entry && <StatusMark status={entry.status} />}
                                                                    </div>
                                                                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                                                                        {participantMeta(entry, slot.trainer?.profile?.full_name)}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
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

function OperationalChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/10 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-50/60">{label}</span>
            <span className="text-xs font-medium text-white">{value}</span>
        </div>
    );
}

function SurfacePill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-full border border-zinc-200 bg-white px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">{label}</span>
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
