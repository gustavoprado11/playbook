'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, KeyRound, Pencil, Plus, RefreshCw, Trash2, UserCheck2, Users, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { archiveWeeklyScheduleSlot, getOrCreateAttendancePublicLink, regenerateAttendancePublicLink, setAttendanceStatus, setPublicAttendanceStatus } from '@/app/actions/attendance';
import { formatTimeLabel, WEEKDAY_OPTIONS } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { AttendancePublicLink, AttendanceRecord, AttendanceStatus, Profile, Student, Trainer, WeeklyScheduleTemplate } from '@/types/database';
import { WeeklySlotDialog } from './weekly-slot-dialog';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };
type JoinedTemplate = WeeklyScheduleTemplate & { student?: JoinedStudent | null; trainer?: JoinedTrainer };

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
    templates: JoinedTemplate[];
    records: AttendanceRecord[];
    publicLink?: AttendancePublicLink | null;
    publicMode?: boolean;
    publicToken?: string;
    publicLabel?: string;
}

export function AttendanceWorkspace({
    role,
    basePath,
    weekLabel,
    weekStart,
    weekDays,
    students,
    trainers,
    templates,
    records,
    publicLink = null,
    publicMode = false,
    publicToken,
    publicLabel,
}: AttendanceWorkspaceProps) {
    const router = useRouter();
    const [selectedTrainer, setSelectedTrainer] = useState<string>('all');
    const [slotDialogOpen, setSlotDialogOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<WeeklyScheduleTemplate | undefined>();
    const [recordsState, setRecordsState] = useState(records);
    const [archiveTarget, setArchiveTarget] = useState<WeeklyScheduleTemplate | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [linkState, setLinkState] = useState<AttendancePublicLink | null>(publicLink);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setRecordsState(records);
    }, [records]);

    useEffect(() => {
        setLinkState(publicLink);
    }, [publicLink]);

    const filteredStudents = useMemo(() => {
        if (publicMode || role !== 'manager' || selectedTrainer === 'all') {
            return students;
        }

        return students.filter((student) => student.trainer_id === selectedTrainer);
    }, [publicMode, role, selectedTrainer, students]);

    const visibleTemplates = useMemo(() => {
        if (publicMode || role !== 'manager' || selectedTrainer === 'all') {
            return templates;
        }

        return templates.filter((template) => template.trainer_id === selectedTrainer);
    }, [publicMode, role, selectedTrainer, templates]);

    const timeRows = useMemo(() => {
        return Array.from(new Set(visibleTemplates.map((template) => template.start_time)))
            .sort((left, right) => left.localeCompare(right));
    }, [visibleTemplates]);

    const recordMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();

        recordsState.forEach((record) => {
            map.set(`${record.schedule_template_id}-${record.session_date}`, record);
        });

        return map;
    }, [recordsState]);

    const totals = useMemo(() => {
        const total = visibleTemplates.length;
        let present = 0;
        let absent = 0;

        visibleTemplates.forEach((template) => {
            const day = weekDays.find((entry) => entry.value === template.weekday);
            if (!day) return;

            const record = recordMap.get(`${template.id}-${day.isoDate}`);
            if (record?.status === 'present') present += 1;
            if (record?.status === 'absent') absent += 1;
        });

        return {
            total,
            present,
            absent,
            pending: Math.max(total - present - absent, 0),
        };
    }, [recordMap, visibleTemplates, weekDays]);

    const templatesByWeekday = useMemo(() => {
        return WEEKDAY_OPTIONS.map((day) => ({
            ...day,
            templates: visibleTemplates
                .filter((template) => template.weekday === day.value)
                .sort((left, right) => left.start_time.localeCompare(right.start_time)),
        }));
    }, [visibleTemplates]);

    const prevWeek = format(addDays(parseISO(weekStart), -7), 'yyyy-MM-dd');
    const nextWeek = format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd');

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const receptionistUrl = linkState ? `${appOrigin}/agenda/${linkState.access_token}` : null;

    function displayName(template: JoinedTemplate | WeeklyScheduleTemplate) {
        return template.student?.full_name || template.guest_name || 'Sem nome';
    }

    function displaySubtitle(template: JoinedTemplate | WeeklyScheduleTemplate) {
        if (template.student?.trainer?.profile?.full_name && role === 'manager' && !publicMode) {
            return template.student.trainer.profile.full_name;
        }

        if (template.guest_origin) {
            return template.guest_origin;
        }

        return template.trainer?.profile?.full_name || '';
    }

    function openNewSlotDialog() {
        setEditingSlot(undefined);
        setSlotDialogOpen(true);
    }

    function openEditSlotDialog(slot: WeeklyScheduleTemplate) {
        setEditingSlot(slot);
        setSlotDialogOpen(true);
    }

    function updateLocalAttendance(template: WeeklyScheduleTemplate, sessionDate: string, status: AttendanceStatus) {
        setRecordsState((current) => {
            const key = `${template.id}-${sessionDate}`;
            const next = current.filter((record) => `${record.schedule_template_id}-${record.session_date}` !== key);

            if (status === 'pending') {
                return next;
            }

            next.push({
                id: `${template.id}-${sessionDate}`,
                schedule_template_id: template.id,
                student_id: template.student_id,
                guest_name: template.guest_name || null,
                guest_origin: template.guest_origin || null,
                trainer_id: template.trainer_id,
                session_date: sessionDate,
                start_time: template.start_time,
                status,
                notes: null,
                marked_by: null,
                marked_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            return next;
        });
    }

    function handleAttendance(template: WeeklyScheduleTemplate, sessionDate: string, status: AttendanceStatus) {
        const stateKey = `${template.id}-${sessionDate}`;
        setPendingKey(stateKey);

        startTransition(async () => {
            try {
                updateLocalAttendance(template, sessionDate, status);

                if (publicMode && publicToken) {
                    await setPublicAttendanceStatus(publicToken, {
                        schedule_template_id: template.id,
                        session_date: sessionDate,
                        status,
                    });
                } else {
                    await setAttendanceStatus({
                        schedule_template_id: template.id,
                        session_date: sessionDate,
                        status,
                    });
                }
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao salvar marcacao');
                router.refresh();
            } finally {
                setPendingKey(null);
            }
        });
    }

    function handleArchive() {
        if (!archiveTarget) return;

        startTransition(async () => {
            try {
                await archiveWeeklyScheduleSlot(archiveTarget.id);
                toast.success('Horario base removido da agenda');
                setArchiveTarget(null);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao remover horario');
            }
        });
    }

    function handleEnsurePublicLink() {
        startTransition(async () => {
            try {
                const link = await getOrCreateAttendancePublicLink();
                setLinkState(link);
                toast.success('Link da recepcao pronto para uso');
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao gerar link');
            }
        });
    }

    function handleRegeneratePublicLink() {
        startTransition(async () => {
            try {
                const link = await regenerateAttendancePublicLink();
                setLinkState(link);
                toast.success('Link publico regenerado');
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao regenerar link');
            }
        });
    }

    async function copyPublicLink() {
        if (!receptionistUrl) return;
        await navigator.clipboard.writeText(receptionistUrl);
        toast.success('Link copiado');
    }

    return (
        <div className="space-y-8">
            <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_60px_-42px_rgba(24,24,27,0.45)]">
                <div className="border-b border-zinc-200 bg-[linear-gradient(135deg,#244d2f_0%,#315d35_55%,#6f8b3e_100%)] px-6 py-6 text-white">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/80">
                                {publicMode ? 'Recepcao' : 'Operacao semanal'}
                            </p>
                            <div>
                                <h1 className="font-serif text-3xl leading-tight">
                                    {publicMode ? 'Agenda da recepcao' : 'Agenda viva de presenca'}
                                </h1>
                                <p className="mt-2 text-sm text-emerald-50/85">
                                    {publicMode
                                        ? `Link operacional ${publicLabel ? `(${publicLabel}) ` : ''}para marcar presenca sem login.`
                                        : 'Monte a agenda-base dos treinadores, inclua nomes avulsos e marque a semana na mesma velocidade da planilha.'}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <MetricCard icon={Users} label="Sessoes previstas" value={String(totals.total)} />
                            <MetricCard icon={UserCheck2} label="Presencas" value={String(totals.present)} />
                            <MetricCard icon={XCircle} label="Faltas" value={String(totals.absent)} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
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

                    {!publicMode && (
                        <div className="flex flex-wrap items-center gap-3">
                            {role === 'manager' && (
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
                            <Button onClick={openNewSlotDialog}>
                                <Plus className="h-4 w-4" />
                                Novo horario base
                            </Button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-6">
                    <div className="overflow-x-auto">
                        <div className="min-w-[1100px] rounded-[24px] border border-zinc-200 bg-zinc-100/70 p-3">
                            <div className="grid grid-cols-[96px_repeat(5,minmax(200px,1fr))] gap-3">
                                <div className="rounded-2xl bg-zinc-900 px-4 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                                    Hora
                                </div>
                                {weekDays.map((day) => (
                                    <div key={day.isoDate} className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                                            {day.label}
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-zinc-900">
                                            {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                                        </p>
                                    </div>
                                ))}

                                {timeRows.length === 0 ? (
                                    <div className="col-span-6 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-zinc-500">
                                        Nenhum horario base criado ainda.
                                    </div>
                                ) : (
                                    timeRows.map((time) => (
                                        <AttendanceRow
                                            key={time}
                                            time={time}
                                            role={role}
                                            publicMode={publicMode}
                                            weekDays={weekDays}
                                            templates={visibleTemplates}
                                            recordMap={recordMap}
                                            pendingKey={pendingKey}
                                            isPending={isPending}
                                            onMark={handleAttendance}
                                            displayName={displayName}
                                            displaySubtitle={displaySubtitle}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {!publicMode && (
                <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-42px_rgba(24,24,27,0.4)]">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                                    Agenda-base
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                                    Grade recorrente da semana
                                </h2>
                            </div>
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                                {visibleTemplates.length} slots ativos
                            </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            {templatesByWeekday.map((day) => (
                                <div key={day.value} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                                                {day.short}
                                            </p>
                                            <p className="text-base font-semibold text-zinc-900">{day.label}</p>
                                        </div>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
                                            {day.templates.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {day.templates.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-5 text-center text-xs text-zinc-500">
                                                Sem recorrencia nesse dia.
                                            </div>
                                        ) : (
                                            day.templates.map((slot) => (
                                                <div key={slot.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-zinc-900">{displayName(slot)}</p>
                                                            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                                                                <Clock3 className="h-3.5 w-3.5" />
                                                                {formatTimeLabel(slot.start_time)}
                                                            </div>
                                                            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-emerald-700">
                                                                {displaySubtitle(slot)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSlotDialog(slot)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setArchiveTarget(slot)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-white">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Remover horario base?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            O historico marcado fica preservado. Apenas a recorrencia sai da agenda.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel onClick={() => setArchiveTarget(null)}>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleArchive}>
                                                                            Remover
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </div>
                                                    {slot.notes && (
                                                        <p className="mt-3 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600">
                                                            {slot.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {role === 'manager' && (
                            <ReceptionCard
                                linkState={linkState}
                                receptionistUrl={receptionistUrl}
                                loading={isPending}
                                onEnsure={handleEnsurePublicLink}
                                onRegenerate={handleRegeneratePublicLink}
                                onCopy={copyPublicLink}
                            />
                        )}

                        <div className="rounded-[28px] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-[0_20px_60px_-42px_rgba(0,0,0,0.65)]">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/70">
                                Leitura rapida
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold">
                                Painel de aderencia da semana
                            </h2>
                            <div className="mt-6 space-y-4">
                                <InsightCard tone="emerald" label="Confirmados" value={`${totals.present}`} description="Presencas ja lançadas como OK." />
                                <InsightCard tone="amber" label="Pendentes" value={`${totals.pending}`} description="Slots ainda sem marcacao no quadro." />
                                <InsightCard tone="red" label="Faltas" value={`${totals.absent}`} description="Ausencias registradas na semana." />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {!publicMode && (
                <WeeklySlotDialog
                    open={slotDialogOpen}
                    onOpenChange={setSlotDialogOpen}
                    role={role}
                    slot={editingSlot}
                    students={filteredStudents}
                    trainers={trainers}
                    defaultTrainerId={selectedTrainer === 'all' ? undefined : selectedTrainer}
                />
            )}
        </div>
    );
}

function AttendanceRow({
    time,
    role,
    publicMode,
    weekDays,
    templates,
    recordMap,
    pendingKey,
    isPending,
    onMark,
    displayName,
    displaySubtitle,
}: {
    time: string;
    role: 'manager' | 'trainer';
    publicMode: boolean;
    weekDays: AttendanceWorkspaceProps['weekDays'];
    templates: JoinedTemplate[];
    recordMap: Map<string, AttendanceRecord>;
    pendingKey: string | null;
    isPending: boolean;
    onMark: (template: WeeklyScheduleTemplate, sessionDate: string, status: AttendanceStatus) => void;
    displayName: (template: JoinedTemplate) => string;
    displaySubtitle: (template: JoinedTemplate) => string;
}) {
    return (
        <>
            <div className="rounded-2xl bg-zinc-900 px-4 py-5 text-center text-xl font-semibold text-white shadow-sm">
                {formatTimeLabel(time)}
            </div>
            {weekDays.map((day) => {
                const dayTemplates = templates.filter((template) => template.weekday === day.value && template.start_time === time);

                return (
                    <div key={`${time}-${day.isoDate}`} className="min-h-[120px] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                        <div className="space-y-3">
                            {dayTemplates.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400">
                                    Sem agendamentos
                                </div>
                            ) : (
                                dayTemplates.map((template) => {
                                    const record = recordMap.get(`${template.id}-${day.isoDate}`);
                                    const currentStatus = record?.status || 'pending';
                                    const itemPendingKey = `${template.id}-${day.isoDate}`;

                                    return (
                                        <div key={template.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-zinc-900">{displayName(template)}</p>
                                                    <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-emerald-700">
                                                        {displaySubtitle(template)}
                                                    </p>
                                                </div>
                                                {!publicMode && role === 'manager' && <StatusPill status={currentStatus} />}
                                                {(publicMode || role === 'trainer') && <StatusPill status={currentStatus} />}
                                            </div>

                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                <StatusButton label="OK" active={currentStatus === 'present'} tone="present" disabled={isPending && pendingKey === itemPendingKey} onClick={() => onMark(template, day.isoDate, 'present')} />
                                                <StatusButton label="N" active={currentStatus === 'absent'} tone="absent" disabled={isPending && pendingKey === itemPendingKey} onClick={() => onMark(template, day.isoDate, 'absent')} />
                                                <StatusButton label="-" active={currentStatus === 'pending'} tone="pending" disabled={isPending && pendingKey === itemPendingKey} onClick={() => onMark(template, day.isoDate, 'pending')} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

function ReceptionCard({
    linkState,
    receptionistUrl,
    loading,
    onEnsure,
    onRegenerate,
    onCopy,
}: {
    linkState: AttendancePublicLink | null;
    receptionistUrl: string | null;
    loading: boolean;
    onEnsure: () => void;
    onRegenerate: () => void;
    onCopy: () => void;
}) {
    return (
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-42px_rgba(24,24,27,0.4)]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                        Link da recepcao
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                        Agenda publica operacional
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500">
                        Um link sem login para ficar aberto na recepcao e marcar presenca sem expor o restante do sistema.
                    </p>
                </div>
                <div className="rounded-full bg-emerald-50 p-3">
                    <KeyRound className="h-5 w-5 text-emerald-700" />
                </div>
            </div>

            {linkState && receptionistUrl ? (
                <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">URL publica</p>
                        <p className="mt-2 break-all font-mono text-sm text-zinc-800">{receptionistUrl}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={onCopy}>
                            <Copy className="h-4 w-4" />
                            Copiar link
                        </Button>
                        <a href={receptionistUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline">
                                <ExternalLink className="h-4 w-4" />
                                Abrir agenda
                            </Button>
                        </a>
                        <Button variant="secondary" onClick={onRegenerate} isLoading={loading}>
                            <RefreshCw className="h-4 w-4" />
                            Regenerar
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mt-5">
                    <Button onClick={onEnsure} isLoading={loading}>
                        <KeyRound className="h-4 w-4" />
                        Gerar link da recepcao
                    </Button>
                </div>
            )}
        </div>
    );
}

function StatusButton({
    label,
    active,
    tone,
    disabled,
    onClick,
}: {
    label: string;
    active: boolean;
    tone: 'present' | 'absent' | 'pending';
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'h-9 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50',
                tone === 'present' && active && 'border-emerald-500 bg-emerald-500 text-white',
                tone === 'present' && !active && 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-700',
                tone === 'absent' && active && 'border-red-500 bg-red-500 text-white',
                tone === 'absent' && !active && 'border-zinc-200 bg-white text-zinc-600 hover:border-red-300 hover:text-red-700',
                tone === 'pending' && active && 'border-zinc-900 bg-zinc-900 text-white',
                tone === 'pending' && !active && 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
            )}
        >
            {label}
        </button>
    );
}

function StatusPill({ status }: { status: AttendanceStatus }) {
    const config = {
        present: { label: 'OK', className: 'bg-emerald-100 text-emerald-700' },
        absent: { label: 'N', className: 'bg-red-100 text-red-700' },
        pending: { label: '-', className: 'bg-zinc-100 text-zinc-600' },
    }[status];

    return (
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]', config.className)}>
            {config.label}
        </span>
    );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/15 p-2">
                    <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-50/70">{label}</p>
                    <p className="text-xl font-semibold text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}

function InsightCard({
    label,
    value,
    description,
    tone,
}: {
    label: string;
    value: string;
    description: string;
    tone: 'emerald' | 'amber' | 'red';
}) {
    const toneClass = {
        emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
        amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
        red: 'border-red-400/30 bg-red-400/10 text-red-100',
    }[tone];

    return (
        <div className={cn('rounded-2xl border p-4', toneClass)}>
            <p className="text-xs font-semibold uppercase tracking-[0.26em]">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-3 text-sm text-current/80">{description}</p>
        </div>
    );
}
