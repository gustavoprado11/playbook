'use client';

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KPIHighlight } from '@/app/actions/kpis';

const config = {
    positive: { icon: CheckCircle2, border: 'border-emerald-200', bg: 'bg-emerald-50', iconColor: 'text-emerald-600', titleColor: 'text-emerald-800' },
    attention: { icon: AlertTriangle, border: 'border-amber-200', bg: 'bg-amber-50', iconColor: 'text-amber-600', titleColor: 'text-amber-800' },
    neutral: { icon: Info, border: 'border-zinc-200', bg: 'bg-zinc-50', iconColor: 'text-zinc-500', titleColor: 'text-zinc-800' },
};

export function KPIHighlights({ highlights }: { highlights: KPIHighlight[] }) {
    if (highlights.length === 0) return null;

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {highlights.map((h, i) => {
                const c = config[h.type];
                const Icon = c.icon;
                return (
                    <div key={i} className={cn('flex items-start gap-3 rounded-lg border p-4', c.border, c.bg)}>
                        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', c.iconColor)} />
                        <div>
                            <p className={cn('text-sm font-semibold', c.titleColor)}>{h.title}</p>
                            <p className="text-xs text-zinc-600 mt-0.5">{h.description}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
