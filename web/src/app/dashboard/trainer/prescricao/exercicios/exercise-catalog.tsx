'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';
import {
    createExercise,
    updateExercise,
    archiveExercise,
} from '@/app/actions/prescription';
import type {
    Exercise,
    MovementPattern,
    BlockCategory,
    WorkoutPhase,
} from '@/types/database';

const PHASE_LABELS: Record<WorkoutPhase, string> = {
    preparacao_movimento: 'Preparação de Movimento',
    potencia_forca: 'Potência / Força',
    dse: 'DSE',
    regeneracao: 'Regeneração',
};

const PHASE_ORDER: WorkoutPhase[] = [
    'preparacao_movimento',
    'potencia_forca',
    'dse',
    'regeneracao',
];

const DIFFICULTY_LABELS: Record<'beginner' | 'intermediate' | 'advanced', string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
};

const NONE = 'none';

const DIACRITICS = /[̀-ͯ]/g;

const normalize = (s: string | null | undefined) =>
    (s ?? '')
        .normalize('NFD')
        .replace(DIACRITICS, '')
        .toLowerCase()
        .trim();

const parseMuscles = (raw: string): string[] =>
    raw
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

interface ExerciseCatalogProps {
    exercises: Exercise[];
    patterns: MovementPattern[];
    categories: BlockCategory[];
}

interface FormState {
    name: string;
    movement_pattern_key: string;
    default_category_key: string;
    primary_muscles: string;
    secondary_muscles: string;
    equipment: string;
    difficulty: string;
    video_url: string;
    cues: string;
}

const emptyForm: FormState = {
    name: '',
    movement_pattern_key: NONE,
    default_category_key: NONE,
    primary_muscles: '',
    secondary_muscles: '',
    equipment: '',
    difficulty: NONE,
    video_url: '',
    cues: '',
};

export function ExerciseCatalog({
    exercises,
    patterns,
    categories,
}: ExerciseCatalogProps) {
    const router = useRouter();

    const [search, setSearch] = useState('');
    const [filterPattern, setFilterPattern] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Exercise | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [archivingId, setArchivingId] = useState<string | null>(null);

    // Lookups
    const patternLabel = useMemo(() => {
        const m = new Map<string, string>();
        patterns.forEach((p) => m.set(p.pattern_key, p.label));
        return m;
    }, [patterns]);

    const categoryLabel = useMemo(() => {
        const m = new Map<string, string>();
        categories.forEach((c) => m.set(c.category_key, c.label));
        return m;
    }, [categories]);

    const categoriesByPhase = useMemo(() => {
        const grouped = new Map<WorkoutPhase, BlockCategory[]>();
        for (const phase of PHASE_ORDER) grouped.set(phase, []);
        categories.forEach((c) => {
            const list = grouped.get(c.phase);
            if (list) list.push(c);
        });
        return grouped;
    }, [categories]);

    const filtered = useMemo(() => {
        const q = normalize(search);
        return exercises.filter((e) => {
            if (q && !normalize(e.name).includes(q)) return false;
            if (filterPattern !== 'all' && e.movement_pattern_key !== filterPattern) return false;
            if (filterCategory !== 'all' && e.default_category_key !== filterCategory) return false;
            return true;
        });
    }, [exercises, search, filterPattern, filterCategory]);

    // Catálogo compartilhado (migr 044): qualquer treinador/manager gerencia qualquer exercício.
    const canManage = (_e: Exercise) => true;

    // Dialog helpers
    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (e: Exercise) => {
        setEditing(e);
        setForm({
            name: e.name,
            movement_pattern_key: e.movement_pattern_key ?? NONE,
            default_category_key: e.default_category_key ?? NONE,
            primary_muscles: (e.primary_muscles ?? []).join(', '),
            secondary_muscles: (e.secondary_muscles ?? []).join(', '),
            equipment: e.equipment ?? '',
            difficulty: e.difficulty ?? NONE,
            video_url: e.video_url ?? '',
            cues: e.cues ?? '',
        });
        setDialogOpen(true);
    };

    const setField = (field: keyof FormState, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error('Nome do exercício é obrigatório');
            return;
        }

        const payload = {
            name: form.name.trim(),
            movement_pattern_key: form.movement_pattern_key === NONE ? null : form.movement_pattern_key,
            default_category_key: form.default_category_key === NONE ? null : form.default_category_key,
            primary_muscles: parseMuscles(form.primary_muscles),
            secondary_muscles: parseMuscles(form.secondary_muscles),
            equipment: form.equipment.trim() || null,
            difficulty: form.difficulty === NONE ? null : (form.difficulty as 'beginner' | 'intermediate' | 'advanced'),
            video_url: form.video_url.trim() || null,
            cues: form.cues.trim() || null,
        };

        setIsSaving(true);
        try {
            if (editing) {
                await updateExercise({ id: editing.id, ...payload });
                toast.success('Exercício atualizado');
            } else {
                await createExercise(payload);
                toast.success('Exercício criado');
            }
            setDialogOpen(false);
            setEditing(null);
            setForm(emptyForm);
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar exercício');
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!archivingId) return;
        try {
            await archiveExercise(archivingId);
            toast.success('Exercício arquivado');
            router.refresh();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao arquivar exercício');
        } finally {
            setArchivingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Catálogo de Exercícios</h1>
                    <p className="mt-1 text-zinc-500">
                        Os exercícios cadastrados aqui abastecem a montagem de programas.
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo exercício
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {filtered.length} de {exercises.length} exercício{exercises.length === 1 ? '' : 's'}
                    </CardTitle>
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome..."
                                className="pl-8"
                            />
                        </div>
                        <Select value={filterPattern} onValueChange={setFilterPattern}>
                            <SelectTrigger className="sm:w-52">
                                <SelectValue placeholder="Padrão de movimento" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100]">
                                <SelectItem value="all">Todos os padrões</SelectItem>
                                {patterns.map((p) => (
                                    <SelectItem key={p.pattern_key} value={p.pattern_key}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="sm:w-52">
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100]">
                                <SelectItem value="all">Todas as categorias</SelectItem>
                                {PHASE_ORDER.map((phase) => {
                                    const list = categoriesByPhase.get(phase) ?? [];
                                    if (list.length === 0) return null;
                                    return (
                                        <SelectGroup key={phase}>
                                            <SelectLabel>{PHASE_LABELS[phase]}</SelectLabel>
                                            {list.map((c) => (
                                                <SelectItem key={c.category_key} value={c.category_key}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-500">
                            {exercises.length === 0
                                ? 'Nenhum exercício cadastrado ainda. Clique em "Novo exercício" para começar.'
                                : 'Nenhum exercício encontrado com esses filtros.'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Padrão</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead>Dificuldade</TableHead>
                                        <TableHead>Equipamento</TableHead>
                                        <TableHead className="w-10" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((e) => (
                                        <TableRow key={e.id}>
                                            <TableCell className="font-medium text-zinc-900">{e.name}</TableCell>
                                            <TableCell className="text-zinc-600">
                                                {e.movement_pattern_key
                                                    ? patternLabel.get(e.movement_pattern_key) ?? e.movement_pattern_key
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {e.default_category_key
                                                    ? categoryLabel.get(e.default_category_key) ?? e.default_category_key
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {e.difficulty ? DIFFICULTY_LABELS[e.difficulty] : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {e.equipment ? (
                                                    <Badge variant="secondary">{e.equipment}</Badge>
                                                ) : (
                                                    <span className="text-zinc-400">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {canManage(e) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-white">
                                                            <DropdownMenuItem onClick={() => openEdit(e)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => setArchivingId(e.id)}
                                                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                                            >
                                                                <Archive className="mr-2 h-4 w-4" />
                                                                Arquivar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditing(null); } }}>
                <DialogContent className="max-w-xl bg-white">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar exercício' : 'Novo exercício'}</DialogTitle>
                        <DialogDescription>
                            {editing
                                ? 'Atualize os dados do exercício.'
                                : 'Cadastre um exercício no catálogo do estúdio.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setField('name', e.target.value)}
                                placeholder="Ex: Agachamento livre"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Padrão de movimento</Label>
                                <Select
                                    value={form.movement_pattern_key}
                                    onValueChange={(v) => setField('movement_pattern_key', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white z-[100]">
                                        <SelectItem value={NONE}>Nenhum</SelectItem>
                                        {patterns.map((p) => (
                                            <SelectItem key={p.pattern_key} value={p.pattern_key}>
                                                {p.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Categoria padrão</Label>
                                <Select
                                    value={form.default_category_key}
                                    onValueChange={(v) => setField('default_category_key', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white z-[100]">
                                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                                        {PHASE_ORDER.map((phase) => {
                                            const list = categoriesByPhase.get(phase) ?? [];
                                            if (list.length === 0) return null;
                                            return (
                                                <SelectGroup key={phase}>
                                                    <SelectLabel>{PHASE_LABELS[phase]}</SelectLabel>
                                                    {list.map((c) => (
                                                        <SelectItem key={c.category_key} value={c.category_key}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="primary_muscles">Músculos primários</Label>
                                <Input
                                    id="primary_muscles"
                                    value={form.primary_muscles}
                                    onChange={(e) => setField('primary_muscles', e.target.value)}
                                    placeholder="quadríceps, glúteos"
                                />
                                <p className="text-xs text-zinc-400">Separe por vírgula.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secondary_muscles">Músculos secundários</Label>
                                <Input
                                    id="secondary_muscles"
                                    value={form.secondary_muscles}
                                    onChange={(e) => setField('secondary_muscles', e.target.value)}
                                    placeholder="core, isquiotibiais"
                                />
                                <p className="text-xs text-zinc-400">Separe por vírgula.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="equipment">Equipamento</Label>
                                <Input
                                    id="equipment"
                                    value={form.equipment}
                                    onChange={(e) => setField('equipment', e.target.value)}
                                    placeholder="Barra, halteres..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dificuldade</Label>
                                <Select
                                    value={form.difficulty}
                                    onValueChange={(v) => setField('difficulty', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white z-[100]">
                                        <SelectItem value={NONE}>Não definida</SelectItem>
                                        <SelectItem value="beginner">Iniciante</SelectItem>
                                        <SelectItem value="intermediate">Intermediário</SelectItem>
                                        <SelectItem value="advanced">Avançado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="video_url">Link do vídeo</Label>
                            <Input
                                id="video_url"
                                value={form.video_url}
                                onChange={(e) => setField('video_url', e.target.value)}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cues">Dicas de execução</Label>
                            <Textarea
                                id="cues"
                                value={form.cues}
                                onChange={(e) => setField('cues', e.target.value)}
                                placeholder="Pontos de atenção na execução..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar exercício'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Archive confirmation */}
            <AlertDialog open={!!archivingId} onOpenChange={(open) => !open && setArchivingId(null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar exercício?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ele deixará de aparecer no catálogo. Programas que já o utilizam não são afetados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700">
                            Sim, arquivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
