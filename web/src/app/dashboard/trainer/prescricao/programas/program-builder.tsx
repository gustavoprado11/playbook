'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveProgramTree } from '@/app/actions/prescription';
import { ExercisePickerDialog, type PickResult } from './exercise-picker-dialog';
import type {
    Exercise,
    MovementPattern,
    BlockCategory,
    TrainingMethod,
    WorkoutPhase,
    ProgramTemplateTree,
    ProgramTreeInput,
} from '@/types/database';

// ---------- constants ----------
const PHASE_ORDER: WorkoutPhase[] = ['preparacao_movimento', 'potencia_forca', 'dse', 'regeneracao'];
const PHASE_LABELS: Record<WorkoutPhase, string> = {
    preparacao_movimento: 'Preparação de Movimento',
    potencia_forca: 'Potência / Força',
    dse: 'DSE — Desenvolvimento de Sistemas Energéticos',
    regeneracao: 'Regeneração',
};
const RITUAL_SEED: { phase: WorkoutPhase; category_key: string }[] = [
    { phase: 'preparacao_movimento', category_key: 'mobilidade' },
    { phase: 'preparacao_movimento', category_key: 'estabilidade' },
    { phase: 'preparacao_movimento', category_key: 'ativacao' },
    { phase: 'potencia_forca', category_key: 'forca' },
    { phase: 'dse', category_key: 'aerobio' },
];
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NONE = 'none';
const phaseIdx = (p: WorkoutPhase) => PHASE_ORDER.indexOf(p);
const numStr = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const numOrNull = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
};

// ---------- draft model ----------
interface DraftSet {
    key: string;
    reps: string; reps_max: string; each_side: boolean;
    load_kg: string; rir: string; tempo: string; rest_seconds: string;
    duration_seconds: string; distance_m: string; target_zone: string;
}
interface DraftItem {
    key: string;
    exercise_id: string | null;
    display_name: string;
    custom_name: string | null;
    group_label: string;
    method_key: string;
    sets: DraftSet[];
}
interface DraftBlock {
    key: string;
    phase: WorkoutPhase;
    category_key: string;
    items: DraftItem[];
}
interface DraftSession {
    key: string;
    name: string;
    scheduled_days: number[];
    notes: string;
    blocks: DraftBlock[];
}
interface DraftProgram {
    id: string | null;
    name: string;
    description: string;
    goal: string;
    sessions: DraftSession[];
}

interface ProgramBuilderProps {
    initial: ProgramTemplateTree | null;
    exercises: Exercise[];
    patterns: MovementPattern[];
    categories: BlockCategory[];
    methods: TrainingMethod[];
}

export function ProgramBuilder({ initial, exercises, patterns, categories, methods }: ProgramBuilderProps) {
    const router = useRouter();
    const idRef = useRef(0);
    const mkKey = () => `k${idRef.current++}`;

    const [draft, setDraft] = useState<DraftProgram>(() => {
        const exName = new Map(exercises.map((e) => [e.id, e.name]));
        const catSet = new Set(categories.map((c) => `${c.phase}:${c.category_key}`));
        const seed = (): DraftBlock[] =>
            RITUAL_SEED.filter((s) => catSet.has(`${s.phase}:${s.category_key}`)).map((s) => ({
                key: mkKey(), phase: s.phase, category_key: s.category_key, items: [],
            }));
        if (!initial) {
            return {
                id: null, name: '', description: '', goal: '',
                sessions: [{ key: mkKey(), name: 'Treino A', scheduled_days: [], notes: '', blocks: seed() }],
            };
        }
        return {
            id: initial.id,
            name: initial.name,
            description: initial.description ?? '',
            goal: initial.goal ?? '',
            sessions: (initial.sessions ?? []).map((s) => ({
                key: mkKey(), name: s.name, scheduled_days: s.scheduled_days ?? [], notes: s.notes ?? '',
                blocks: (s.blocks ?? []).map((b) => ({
                    key: mkKey(), phase: b.phase, category_key: b.category_key,
                    items: (b.items ?? []).map((i) => ({
                        key: mkKey(),
                        exercise_id: i.exercise_id ?? null,
                        display_name: i.exercise_id ? (exName.get(i.exercise_id) ?? 'Exercício') : (i.custom_name ?? ''),
                        custom_name: i.custom_name ?? null,
                        group_label: i.group_label ?? '',
                        method_key: i.method_key ?? NONE,
                        sets: (i.sets ?? []).map((st) => ({
                            key: mkKey(),
                            reps: numStr(st.reps), reps_max: numStr(st.reps_max), each_side: st.each_side ?? false,
                            load_kg: numStr(st.load_kg), rir: numStr(st.rir), tempo: st.tempo ?? '',
                            rest_seconds: numStr(st.rest_seconds),
                            duration_seconds: numStr(st.duration_seconds), distance_m: numStr(st.distance_m),
                            target_zone: st.target_zone ?? '',
                        })),
                    })),
                })),
            })),
        };
    });

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [picker, setPicker] = useState<{ sessionKey: string; blockKey: string; categoryKey: string; categoryLabel: string } | null>(null);

    // lookups
    const categoryLabel = new Map(categories.map((c) => [c.category_key, c.label]));
    const categoriesOfPhase = (phase: WorkoutPhase) => categories.filter((c) => c.phase === phase);

    // ---------- mutation core ----------
    const mutate = (fn: (d: DraftProgram) => void) =>
        setDraft((prev) => {
            const next = structuredClone(prev) as DraftProgram;
            fn(next);
            return next;
        });
    const findS = (d: DraftProgram, sk: string) => d.sessions.find((s) => s.key === sk)!;
    const findB = (d: DraftProgram, sk: string, bk: string) => findS(d, sk).blocks.find((b) => b.key === bk)!;
    const findI = (d: DraftProgram, sk: string, bk: string, ik: string) => findB(d, sk, bk).items.find((i) => i.key === ik)!;

    const newSet = (): DraftSet => ({
        key: mkKey(), reps: '', reps_max: '', each_side: false, load_kg: '', rir: '', tempo: '',
        rest_seconds: '', duration_seconds: '', distance_m: '', target_zone: '',
    });
    const seedBlocks = (): DraftBlock[] =>
        RITUAL_SEED.filter((s) => categories.some((c) => c.phase === s.phase && c.category_key === s.category_key))
            .map((s) => ({ key: mkKey(), phase: s.phase, category_key: s.category_key, items: [] }));

    // program
    const setProgramField = (field: 'name' | 'description' | 'goal', value: string) =>
        mutate((d) => { d[field] = value; });

    // sessions
    const addSession = () =>
        mutate((d) => {
            const letter = String.fromCharCode(65 + d.sessions.length);
            d.sessions.push({ key: mkKey(), name: `Treino ${letter}`, scheduled_days: [], notes: '', blocks: seedBlocks() });
        });
    const removeSession = (sk: string) => mutate((d) => { d.sessions = d.sessions.filter((s) => s.key !== sk); });
    const moveSession = (sk: string, dir: -1 | 1) =>
        mutate((d) => {
            const i = d.sessions.findIndex((s) => s.key === sk);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= d.sessions.length) return;
            [d.sessions[i], d.sessions[j]] = [d.sessions[j], d.sessions[i]];
        });
    const setSessionField = (sk: string, field: 'name' | 'notes', value: string) =>
        mutate((d) => { (findS(d, sk) as any)[field] = value; });
    const toggleDay = (sk: string, day: number) =>
        mutate((d) => {
            const s = findS(d, sk);
            s.scheduled_days = s.scheduled_days.includes(day)
                ? s.scheduled_days.filter((x) => x !== day)
                : [...s.scheduled_days, day].sort((a, b) => a - b);
        });

    // blocks
    const addBlock = (sk: string, phase: WorkoutPhase, category_key: string) =>
        mutate((d) => { findS(d, sk).blocks.push({ key: mkKey(), phase, category_key, items: [] }); });
    const removeBlock = (sk: string, bk: string) =>
        mutate((d) => { const s = findS(d, sk); s.blocks = s.blocks.filter((b) => b.key !== bk); });

    // items
    const addItem = (sk: string, bk: string, r: PickResult) =>
        mutate((d) => {
            findB(d, sk, bk).items.push({
                key: mkKey(), exercise_id: r.exercise_id, display_name: r.display_name,
                custom_name: r.custom_name, group_label: '', method_key: NONE, sets: [newSet()],
            });
        });
    const removeItem = (sk: string, bk: string, ik: string) =>
        mutate((d) => { const b = findB(d, sk, bk); b.items = b.items.filter((i) => i.key !== ik); });
    const moveItem = (sk: string, bk: string, ik: string, dir: -1 | 1) =>
        mutate((d) => {
            const b = findB(d, sk, bk);
            const i = b.items.findIndex((x) => x.key === ik);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= b.items.length) return;
            [b.items[i], b.items[j]] = [b.items[j], b.items[i]];
        });
    const setItemField = (sk: string, bk: string, ik: string, field: 'group_label' | 'method_key', value: string) =>
        mutate((d) => { (findI(d, sk, bk, ik) as any)[field] = value; });

    // sets
    const addSet = (sk: string, bk: string, ik: string) =>
        mutate((d) => { findI(d, sk, bk, ik).sets.push(newSet()); });
    const removeSet = (sk: string, bk: string, ik: string, setKey: string) =>
        mutate((d) => { const it = findI(d, sk, bk, ik); it.sets = it.sets.filter((s) => s.key !== setKey); });
    const setSetField = (sk: string, bk: string, ik: string, setKey: string, field: keyof DraftSet, value: string | boolean) =>
        mutate((d) => {
            const st = findI(d, sk, bk, ik).sets.find((s) => s.key === setKey)!;
            (st as any)[field] = value;
        });

    const toggleCollapse = (sk: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(sk)) next.delete(sk); else next.add(sk);
            return next;
        });

    // ---------- save ----------
    const buildInput = (d: DraftProgram): ProgramTreeInput => ({
        id: d.id,
        name: d.name.trim(),
        description: d.description.trim() || null,
        goal: d.goal.trim() || null,
        sessions: d.sessions.map((s, si) => ({
            name: s.name.trim() || `Treino ${si + 1}`,
            order_index: si,
            scheduled_days: s.scheduled_days,
            notes: s.notes.trim() || null,
            blocks: [...s.blocks]
                .sort((a, b) => phaseIdx(a.phase) - phaseIdx(b.phase))
                .map((b, bi) => ({
                    phase: b.phase,
                    category_key: b.category_key,
                    order_index: bi,
                    items: b.items.map((it, ii) => ({
                        exercise_id: it.exercise_id,
                        custom_name: it.exercise_id ? null : (it.custom_name?.trim() || it.display_name.trim() || null),
                        group_label: it.group_label.trim() || null,
                        order_index: ii,
                        method_key: it.method_key === NONE ? null : it.method_key,
                        sets: it.sets.map((st, sti) => {
                            const base = { set_number: sti + 1, rest_seconds: numOrNull(st.rest_seconds) };
                            if (b.phase === 'dse') {
                                return {
                                    ...base,
                                    duration_seconds: numOrNull(st.duration_seconds),
                                    distance_m: numOrNull(st.distance_m),
                                    target_zone: st.target_zone.trim() || null,
                                };
                            }
                            return {
                                ...base,
                                reps: numOrNull(st.reps),
                                reps_max: numOrNull(st.reps_max),
                                each_side: st.each_side,
                                load_kg: numOrNull(st.load_kg),
                                rir: numOrNull(st.rir),
                                tempo: st.tempo.trim() || null,
                            };
                        }),
                    })),
                })),
        })),
    });

    const handleSave = async () => {
        if (!draft.name.trim()) {
            toast.error('Dê um nome ao programa');
            return;
        }
        setIsSaving(true);
        try {
            const id = await saveProgramTree(buildInput(draft));
            toast.success('Programa salvo');
            if (!draft.id) {
                router.replace(`/dashboard/trainer/prescricao/programas/${id}`);
            } else {
                router.refresh();
            }
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar o programa');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/trainer/prescricao/programas">
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-zinc-900">
                        {draft.id ? 'Editar programa' : 'Novo programa'}
                    </h1>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Salvando...' : 'Salvar programa'}
                </Button>
            </div>

            {/* Program header */}
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <Label htmlFor="prog-name">Nome do programa *</Label>
                        <Input
                            id="prog-name"
                            value={draft.name}
                            onChange={(e) => setProgramField('name', e.target.value)}
                            placeholder="Ex: Hipertrofia — Bloco 1"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="prog-goal">Objetivo</Label>
                            <Input
                                id="prog-goal"
                                value={draft.goal}
                                onChange={(e) => setProgramField('goal', e.target.value)}
                                placeholder="Ex: Hipertrofia, Força..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="prog-desc">Descrição</Label>
                            <Input
                                id="prog-desc"
                                value={draft.description}
                                onChange={(e) => setProgramField('description', e.target.value)}
                                placeholder="Notas gerais do programa"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sessions */}
            {draft.sessions.map((s, si) => (
                <SessionCard
                    key={s.key}
                    session={s}
                    index={si}
                    total={draft.sessions.length}
                    collapsed={collapsed.has(s.key)}
                    methods={methods}
                    categoryLabel={categoryLabel}
                    categoriesOfPhase={categoriesOfPhase}
                    onToggleCollapse={() => toggleCollapse(s.key)}
                    onMove={(dir) => moveSession(s.key, dir)}
                    onRemove={() => removeSession(s.key)}
                    onField={(f, v) => setSessionField(s.key, f, v)}
                    onToggleDay={(d) => toggleDay(s.key, d)}
                    onAddBlock={(phase, cat) => addBlock(s.key, phase, cat)}
                    onRemoveBlock={(bk) => removeBlock(s.key, bk)}
                    onOpenPicker={(bk, catKey) =>
                        setPicker({ sessionKey: s.key, blockKey: bk, categoryKey: catKey, categoryLabel: categoryLabel.get(catKey) ?? catKey })
                    }
                    onRemoveItem={(bk, ik) => removeItem(s.key, bk, ik)}
                    onMoveItem={(bk, ik, dir) => moveItem(s.key, bk, ik, dir)}
                    onItemField={(bk, ik, f, v) => setItemField(s.key, bk, ik, f, v)}
                    onAddSet={(bk, ik) => addSet(s.key, bk, ik)}
                    onRemoveSet={(bk, ik, setKey) => removeSet(s.key, bk, ik, setKey)}
                    onSetField={(bk, ik, setKey, f, v) => setSetField(s.key, bk, ik, setKey, f, v)}
                />
            ))}

            <Button variant="outline" onClick={addSession} className="w-full border-dashed">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar sessão
            </Button>

            {picker && (
                <ExercisePickerDialog
                    open={!!picker}
                    onOpenChange={(open) => !open && setPicker(null)}
                    exercises={exercises}
                    patterns={patterns}
                    categoryKey={picker.categoryKey}
                    categoryLabel={picker.categoryLabel}
                    onPick={(r) => addItem(picker.sessionKey, picker.blockKey, r)}
                />
            )}
        </div>
    );
}

// ============================================================
// SessionCard
// ============================================================
interface SessionCardProps {
    session: DraftSession;
    index: number;
    total: number;
    collapsed: boolean;
    methods: TrainingMethod[];
    categoryLabel: Map<string, string>;
    categoriesOfPhase: (phase: WorkoutPhase) => BlockCategory[];
    onToggleCollapse: () => void;
    onMove: (dir: -1 | 1) => void;
    onRemove: () => void;
    onField: (field: 'name' | 'notes', value: string) => void;
    onToggleDay: (day: number) => void;
    onAddBlock: (phase: WorkoutPhase, category_key: string) => void;
    onRemoveBlock: (bk: string) => void;
    onOpenPicker: (bk: string, categoryKey: string) => void;
    onRemoveItem: (bk: string, ik: string) => void;
    onMoveItem: (bk: string, ik: string, dir: -1 | 1) => void;
    onItemField: (bk: string, ik: string, field: 'group_label' | 'method_key', value: string) => void;
    onAddSet: (bk: string, ik: string) => void;
    onRemoveSet: (bk: string, ik: string, setKey: string) => void;
    onSetField: (bk: string, ik: string, setKey: string, field: keyof DraftSet, value: string | boolean) => void;
}

function SessionCard(props: SessionCardProps) {
    const { session: s, index, total, collapsed } = props;
    const blocksOfPhase = (phase: WorkoutPhase) => s.blocks.filter((b) => b.phase === phase);

    return (
        <Card>
            <CardHeader className="space-y-0 pb-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={props.onToggleCollapse}
                        className="text-zinc-400 hover:text-zinc-700"
                        aria-label={collapsed ? 'Expandir' : 'Recolher'}
                    >
                        <ChevronRight className={`h-5 w-5 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
                    </button>
                    <Input
                        value={s.name}
                        onChange={(e) => props.onField('name', e.target.value)}
                        className="h-9 max-w-xs font-semibold"
                        placeholder={`Treino ${index + 1}`}
                    />
                    {collapsed && s.scheduled_days.length > 0 && (
                        <span className="text-xs text-zinc-400">
                            {s.scheduled_days.map((d) => DAY_LABELS[d]).join(', ')}
                        </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => props.onMove(-1)}>
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === total - 1} onClick={() => props.onMove(1)}>
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500" onClick={props.onRemove}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="space-y-5">
                    {/* scheduled_days + notes */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs text-zinc-500">Dias da semana</Label>
                            <div className="flex flex-wrap gap-1">
                                {DAY_LABELS.map((lbl, day) => {
                                    const active = s.scheduled_days.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => props.onToggleDay(day)}
                                            className={`h-8 w-11 rounded-md border text-xs font-medium transition-colors ${
                                                active
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                                            }`}
                                        >
                                            {lbl}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-zinc-500">Notas da sessão</Label>
                            <Input
                                value={s.notes}
                                onChange={(e) => props.onField('notes', e.target.value)}
                                placeholder="Opcional"
                                className="h-9"
                            />
                        </div>
                    </div>

                    {/* phases */}
                    <div className="space-y-4">
                        {PHASE_ORDER.map((phase) => {
                            const blocks = blocksOfPhase(phase);
                            const catsInPhase = props.categoriesOfPhase(phase);
                            return (
                                <div key={phase} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            {PHASE_LABELS[phase]}
                                        </h3>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700">
                                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                                    Bloco
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-white">
                                                {catsInPhase.map((c) => (
                                                    <DropdownMenuItem key={c.category_key} onClick={() => props.onAddBlock(phase, c.category_key)}>
                                                        {c.label}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {blocks.length === 0 ? (
                                        <p className="px-1 py-2 text-xs text-zinc-400">
                                            {phase === 'regeneracao'
                                                ? 'Fase opcional — adicione um bloco se for prescrever regeneração.'
                                                : 'Sem blocos nesta fase.'}
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {blocks.map((b) => (
                                                <BlockLane
                                                    key={b.key}
                                                    block={b}
                                                    methods={props.methods}
                                                    categoryLabel={props.categoryLabel}
                                                    onRemoveBlock={() => props.onRemoveBlock(b.key)}
                                                    onOpenPicker={() => props.onOpenPicker(b.key, b.category_key)}
                                                    onRemoveItem={(ik) => props.onRemoveItem(b.key, ik)}
                                                    onMoveItem={(ik, dir) => props.onMoveItem(b.key, ik, dir)}
                                                    onItemField={(ik, f, v) => props.onItemField(b.key, ik, f, v)}
                                                    onAddSet={(ik) => props.onAddSet(b.key, ik)}
                                                    onRemoveSet={(ik, setKey) => props.onRemoveSet(b.key, ik, setKey)}
                                                    onSetField={(ik, setKey, f, v) => props.onSetField(b.key, ik, setKey, f, v)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

// ============================================================
// BlockLane
// ============================================================
interface BlockLaneProps {
    block: DraftBlock;
    methods: TrainingMethod[];
    categoryLabel: Map<string, string>;
    onRemoveBlock: () => void;
    onOpenPicker: () => void;
    onRemoveItem: (ik: string) => void;
    onMoveItem: (ik: string, dir: -1 | 1) => void;
    onItemField: (ik: string, field: 'group_label' | 'method_key', value: string) => void;
    onAddSet: (ik: string) => void;
    onRemoveSet: (ik: string, setKey: string) => void;
    onSetField: (ik: string, setKey: string, field: keyof DraftSet, value: string | boolean) => void;
}

function BlockLane(props: BlockLaneProps) {
    const { block: b } = props;
    return (
        <div className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary">{props.categoryLabel.get(b.category_key) ?? b.category_key}</Badge>
                    {b.phase === 'dse' && <span className="text-xs text-zinc-400">intervalo (duração/zona)</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-500" onClick={props.onRemoveBlock}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {b.items.length === 0 ? (
                <p className="px-1 py-1 text-xs text-zinc-400">Nenhum exercício ainda.</p>
            ) : (
                <div className="space-y-2">
                    {b.items.map((it, ii) => (
                        <ItemRow
                            key={it.key}
                            item={it}
                            index={ii}
                            total={b.items.length}
                            phase={b.phase}
                            methods={props.methods}
                            onRemove={() => props.onRemoveItem(it.key)}
                            onMove={(dir) => props.onMoveItem(it.key, dir)}
                            onField={(f, v) => props.onItemField(it.key, f, v)}
                            onAddSet={() => props.onAddSet(it.key)}
                            onRemoveSet={(setKey) => props.onRemoveSet(it.key, setKey)}
                            onSetField={(setKey, f, v) => props.onSetField(it.key, setKey, f, v)}
                        />
                    ))}
                </div>
            )}

            <Button variant="outline" size="sm" className="mt-2 h-8 text-xs" onClick={props.onOpenPicker}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar exercício
            </Button>
        </div>
    );
}

// ============================================================
// ItemRow
// ============================================================
interface ItemRowProps {
    item: DraftItem;
    index: number;
    total: number;
    phase: WorkoutPhase;
    methods: TrainingMethod[];
    onRemove: () => void;
    onMove: (dir: -1 | 1) => void;
    onField: (field: 'group_label' | 'method_key', value: string) => void;
    onAddSet: () => void;
    onRemoveSet: (setKey: string) => void;
    onSetField: (setKey: string, field: keyof DraftSet, value: string | boolean) => void;
}

function ItemRow(props: ItemRowProps) {
    const { item: it, index, total, phase } = props;
    const isDse = phase === 'dse';
    return (
        <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-800">{it.display_name || 'Exercício'}</span>
                {!it.exercise_id && <Badge variant="outline" className="text-[10px]">avulso</Badge>}
                <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => props.onMove(-1)}>
                        <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={() => props.onMove(1)}>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-500" onClick={props.onRemove}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-zinc-500">Estação</Label>
                    <Input
                        value={it.group_label}
                        onChange={(e) => props.onField('group_label', e.target.value)}
                        placeholder="A/B"
                        className="h-7 w-14 text-xs"
                    />
                </div>
                <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-zinc-500">Método</Label>
                    <Select value={it.method_key} onValueChange={(v) => props.onField('method_key', v)}>
                        <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue placeholder="Método" />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[120]">
                            <SelectItem value="none">Nenhum</SelectItem>
                            {props.methods.map((m) => (
                                <SelectItem key={m.method_key} value={m.method_key}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* sets */}
            <div className="mt-2">
                <SetTable
                    sets={it.sets}
                    isDse={isDse}
                    onAddSet={props.onAddSet}
                    onRemoveSet={props.onRemoveSet}
                    onSetField={props.onSetField}
                />
            </div>
        </div>
    );
}

// ============================================================
// SetTable (phase-adaptive)
// ============================================================
interface SetTableProps {
    sets: DraftSet[];
    isDse: boolean;
    onAddSet: () => void;
    onRemoveSet: (setKey: string) => void;
    onSetField: (setKey: string, field: keyof DraftSet, value: string | boolean) => void;
}

function SetTable({ sets, isDse, onAddSet, onRemoveSet, onSetField }: SetTableProps) {
    const cell = 'h-7 text-xs px-1.5';
    return (
        <div className="space-y-1">
            {sets.map((st, i) => (
                <div key={st.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-5 text-center text-[11px] font-medium text-zinc-400">{i + 1}</span>
                    {isDse ? (
                        <>
                            <NumField label="dur(s)" value={st.duration_seconds} onChange={(v) => onSetField(st.key, 'duration_seconds', v)} className={cell} />
                            <NumField label="dist(m)" value={st.distance_m} onChange={(v) => onSetField(st.key, 'distance_m', v)} className={cell} />
                            <TxtField label="zona" value={st.target_zone} onChange={(v) => onSetField(st.key, 'target_zone', v)} className={cell} width="w-20" />
                            <NumField label="desc(s)" value={st.rest_seconds} onChange={(v) => onSetField(st.key, 'rest_seconds', v)} className={cell} />
                        </>
                    ) : (
                        <>
                            <NumField label="reps" value={st.reps} onChange={(v) => onSetField(st.key, 'reps', v)} className={cell} />
                            <NumField label="até" value={st.reps_max} onChange={(v) => onSetField(st.key, 'reps_max', v)} className={cell} />
                            <label className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Checkbox checked={st.each_side} onChange={(e) => onSetField(st.key, 'each_side', e.target.checked)} />
                                ea.
                            </label>
                            <NumField label="kg" value={st.load_kg} onChange={(v) => onSetField(st.key, 'load_kg', v)} className={cell} />
                            <NumField label="desc(s)" value={st.rest_seconds} onChange={(v) => onSetField(st.key, 'rest_seconds', v)} className={cell} />
                            <TxtField label="tempo" value={st.tempo} onChange={(v) => onSetField(st.key, 'tempo', v)} className={cell} width="w-20" />
                            <NumField label="RIR" value={st.rir} onChange={(v) => onSetField(st.key, 'rir', v)} className={cell} />
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-300 hover:text-red-500"
                        onClick={() => onRemoveSet(st.key)}
                        disabled={sets.length === 1}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700" onClick={onAddSet}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Série
            </Button>
        </div>
    );
}

function NumField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</span>
            <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className={`w-14 ${className ?? ''}`} />
        </div>
    );
}

function TxtField({ label, value, onChange, className, width }: { label: string; value: string; onChange: (v: string) => void; className?: string; width?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</span>
            <Input value={value} onChange={(e) => onChange(e.target.value)} className={`${width ?? 'w-16'} ${className ?? ''}`} />
        </div>
    );
}
