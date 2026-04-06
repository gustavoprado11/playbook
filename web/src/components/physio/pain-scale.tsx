'use client';

import { cn } from '@/lib/utils';

function getPainColor(value: number): string {
    if (value <= 3) return 'bg-green-500';
    if (value <= 6) return 'bg-amber-500';
    return 'bg-red-500';
}

function getPainTextColor(value: number): string {
    if (value <= 3) return 'text-green-700';
    if (value <= 6) return 'text-amber-700';
    return 'text-red-700';
}

export function PainBadge({ value }: { value: number | null }) {
    if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
    return (
        <span className={cn('inline-flex items-center gap-1 text-sm font-medium', getPainTextColor(value))}>
            <span className={cn('h-2.5 w-2.5 rounded-full', getPainColor(value))} />
            {value}/10
        </span>
    );
}

export function PainIndicator({ before, after }: { before: number | null; after: number | null }) {
    if (before === null && after === null) return null;
    return (
        <div className="flex items-center gap-1 text-sm">
            <PainBadge value={before} />
            <span className="text-zinc-400">→</span>
            <PainBadge value={after} />
        </div>
    );
}

export function PainSlider({
    value,
    onChange,
    label,
}: {
    value: number;
    onChange: (v: number) => void;
    label: string;
}) {
    const pct = (value / 10) * 100;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">{label}</label>
                <span className={cn('text-sm font-bold', getPainTextColor(value))}>{value}/10</span>
            </div>
            <div className="relative">
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-500" />
                <input
                    type="range"
                    min={0}
                    max={10}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-zinc-800 [&::-webkit-slider-thumb]:shadow"
                    style={{ marginTop: '-3px' }}
                />
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
                <span>Sem dor</span>
                <span>Dor máxima</span>
            </div>
        </div>
    );
}
