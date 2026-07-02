'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Search, Plus } from 'lucide-react';
import type { Exercise, MovementPattern } from '@/types/database';

const DIACRITICS = /[̀-ͯ]/g;
const normalize = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();

export interface PickResult {
    exercise_id: string | null;
    custom_name: string | null;
    display_name: string;
}

interface ExercisePickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exercises: Exercise[];
    patterns: MovementPattern[];
    categoryKey: string;
    categoryLabel: string;
    onPick: (result: PickResult) => void;
}

export function ExercisePickerDialog({
    open,
    onOpenChange,
    exercises,
    patterns,
    categoryKey,
    categoryLabel,
    onPick,
}: ExercisePickerDialogProps) {
    const [search, setSearch] = useState('');
    const [pattern, setPattern] = useState('all');
    const [showAll, setShowAll] = useState(false);

    const patternLabel = useMemo(() => {
        const m = new Map<string, string>();
        patterns.forEach((p) => m.set(p.pattern_key, p.label));
        return m;
    }, [patterns]);

    const filtered = useMemo(() => {
        const q = normalize(search);
        return exercises.filter((e) => {
            if (!showAll && e.default_category_key !== categoryKey) return false;
            if (pattern !== 'all' && e.movement_pattern_key !== pattern) return false;
            if (q && !normalize(e.name).includes(q)) return false;
            return true;
        });
    }, [exercises, search, pattern, showAll, categoryKey]);

    const pick = (result: PickResult) => {
        onPick(result);
        setSearch('');
        setPattern('all');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg bg-white">
                <DialogHeader>
                    <DialogTitle>Adicionar exercício</DialogTitle>
                    <DialogDescription>
                        Categoria do bloco: <span className="font-medium">{categoryLabel}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar exercício..."
                                className="pl-8"
                                autoFocus
                            />
                        </div>
                        <Select value={pattern} onValueChange={setPattern}>
                            <SelectTrigger className="sm:w-44">
                                <SelectValue placeholder="Padrão" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[120]">
                                <SelectItem value="all">Todos os padrões</SelectItem>
                                {patterns.map((p) => (
                                    <SelectItem key={p.pattern_key} value={p.pattern_key}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                        <Checkbox
                            checked={showAll}
                            onChange={(e) => setShowAll(e.target.checked)}
                        />
                        Mostrar todos (ignorar categoria do bloco)
                    </label>

                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-100 p-1">
                        {filtered.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-zinc-500">
                                Nenhum exercício encontrado{!showAll ? ' nesta categoria' : ''}.
                            </p>
                        ) : (
                            filtered.map((e) => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() =>
                                        pick({ exercise_id: e.id, custom_name: null, display_name: e.name })
                                    }
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-emerald-50"
                                >
                                    <span className="font-medium text-zinc-800">{e.name}</span>
                                    {e.movement_pattern_key && (
                                        <span className="text-xs text-zinc-400">
                                            {patternLabel.get(e.movement_pattern_key)}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {search.trim() && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                                pick({
                                    exercise_id: null,
                                    custom_name: search.trim(),
                                    display_name: search.trim(),
                                })
                            }
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar &quot;{search.trim()}&quot; como exercício avulso
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
