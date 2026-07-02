'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { saveWorkoutLog } from '@/app/actions/prescription';
import type { WorkoutLogTree, SetLog } from '@/types/database';

const numStr = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const numOrNull = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
};

function prescribedLabel(sl: SetLog): string {
    if (sl.phase === 'dse') {
        const parts: string[] = [];
        if (sl.planned_duration_seconds != null) parts.push(`${sl.planned_duration_seconds}s`);
        if (sl.planned_distance_m != null) parts.push(`${sl.planned_distance_m}m`);
        if (sl.planned_target_zone) parts.push(sl.planned_target_zone);
        return parts.join(' / ') || '—';
    }
    const reps = sl.planned_reps != null ? (sl.planned_reps_max != null ? `${sl.planned_reps}–${sl.planned_reps_max}` : `${sl.planned_reps}`) : '';
    const load = sl.planned_load_kg != null ? ` × ${sl.planned_load_kg}kg` : '';
    return `${reps}${load}`.trim() || '—';
}

interface RowDraft {
    snap: SetLog;
    reps_done: string;
    load_kg_done: string;
    duration_done_seconds: string;
    distance_done_m: string;
    rpe: string;
    completed: boolean;
    notes: string;
}

interface WorkoutLogFormProps {
    log: WorkoutLogTree;
    studentId: string;
    studentName: string;
}

export function WorkoutLogForm({ log, studentId, studentName }: WorkoutLogFormProps) {
    const router = useRouter();
    const [performedAt, setPerformedAt] = useState(log.performed_at ?? '');
    const [overallRpe, setOverallRpe] = useState(numStr(log.overall_rpe));
    const [notes, setNotes] = useState(log.notes ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const [rows, setRows] = useState<RowDraft[]>(() =>
        (log.sets ?? []).map((sl) => ({
            snap: sl,
            reps_done: numStr(sl.reps_done),
            load_kg_done: numStr(sl.load_kg_done),
            duration_done_seconds: numStr(sl.duration_done_seconds),
            distance_done_m: numStr(sl.distance_done_m),
            rpe: numStr(sl.rpe),
            completed: sl.completed,
            notes: sl.notes ?? '',
        })),
    );

    const setRow = (i: number, patch: Partial<RowDraft>) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    const doneCount = rows.filter((r) => r.completed).length;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveWorkoutLog({
                id: log.id,
                student_id: studentId,
                assigned_program_id: log.assigned_program_id,
                assigned_session_id: log.assigned_session_id,
                session_name: log.session_name,
                performed_at: performedAt || null,
                overall_rpe: numOrNull(overallRpe),
                notes: notes.trim() || null,
                sets: rows.map((r, i) => ({
                    assigned_set_id: r.snap.assigned_set_id,
                    exercise_name: r.snap.exercise_name,
                    group_label: r.snap.group_label,
                    phase: r.snap.phase,
                    category_key: r.snap.category_key,
                    set_number: r.snap.set_number,
                    planned_reps: r.snap.planned_reps,
                    planned_reps_max: r.snap.planned_reps_max,
                    planned_load_kg: r.snap.planned_load_kg,
                    planned_duration_seconds: r.snap.planned_duration_seconds,
                    planned_distance_m: r.snap.planned_distance_m,
                    planned_target_zone: r.snap.planned_target_zone,
                    reps_done: numOrNull(r.reps_done),
                    load_kg_done: numOrNull(r.load_kg_done),
                    duration_done_seconds: numOrNull(r.duration_done_seconds),
                    distance_done_m: numOrNull(r.distance_done_m),
                    rpe: numOrNull(r.rpe),
                    completed: r.completed,
                    notes: r.notes.trim() || null,
                    order_index: i,
                })),
            });
            toast.success('Execução registrada');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href={`/dashboard/trainer/prescricao/alunos/${studentId}`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Registrar execução</h1>
                        <p className="text-sm text-zinc-500">
                            {studentName} · {log.session_name ?? 'Sessão'}
                        </p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Salvando...' : 'Salvar execução'}
                </Button>
            </div>

            <Card>
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="performed_at">Data</Label>
                        <Input id="performed_at" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="overall_rpe">RPE geral</Label>
                        <Input id="overall_rpe" inputMode="decimal" value={overallRpe} onChange={(e) => setOverallRpe(e.target.value)} placeholder="0–10" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="log_notes">Notas</Label>
                        <Input id="log_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Séries — {doneCount}/{rows.length} concluída{rows.length === 1 ? '' : 's'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {rows.length === 0 ? (
                        <p className="py-8 text-center text-sm text-zinc-500">Esta sessão não tem séries prescritas.</p>
                    ) : (
                        <div className="space-y-2">
                            {rows.map((r, i) => {
                                const isDse = r.snap.phase === 'dse';
                                return (
                                    <div key={r.snap.id} className="rounded-md border border-zinc-100 bg-zinc-50/60 p-2.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Checkbox checked={r.completed} onChange={(e) => setRow(i, { completed: e.target.checked })} />
                                            <span className="text-sm font-medium text-zinc-800">
                                                {r.snap.exercise_name}
                                                {r.snap.group_label ? ` (${r.snap.group_label})` : ''}
                                            </span>
                                            <Badge variant="secondary" className="text-[10px]">Sér. {r.snap.set_number ?? i + 1}</Badge>
                                            <span className="text-xs text-zinc-500">Prescrito: <span className="font-medium text-zinc-700">{prescribedLabel(r.snap)}</span></span>
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                            {isDse ? (
                                                <>
                                                    <Field label="Duração (s)" value={r.duration_done_seconds} onChange={(v) => setRow(i, { duration_done_seconds: v })} />
                                                    <Field label="Dist. (m)" value={r.distance_done_m} onChange={(v) => setRow(i, { distance_done_m: v })} />
                                                </>
                                            ) : (
                                                <>
                                                    <Field label="Reps feitas" value={r.reps_done} onChange={(v) => setRow(i, { reps_done: v })} />
                                                    <Field label="Carga (kg)" value={r.load_kg_done} onChange={(v) => setRow(i, { load_kg_done: v })} />
                                                </>
                                            )}
                                            <Field label="RPE" value={r.rpe} onChange={(v) => setRow(i, { rpe: v })} />
                                            <div className="flex-1 space-y-1">
                                                <span className="text-[10px] uppercase tracking-wide text-zinc-400">Obs.</span>
                                                <Input value={r.notes} onChange={(e) => setRow(i, { notes: e.target.value })} className="h-8 text-xs" placeholder="Opcional" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</span>
            <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-24 text-xs" />
        </div>
    );
}
