'use client';

import { cn } from '@/lib/utils';
import type { ProfessionType } from '@/types/database';

const badgeConfig: Record<ProfessionType, { label: string; className: string }> = {
    trainer: { label: 'Treinador', className: 'bg-zinc-100 text-zinc-700' },
    nutritionist: { label: 'Nutricionista', className: 'bg-emerald-100 text-emerald-700' },
    physiotherapist: { label: 'Fisioterapeuta', className: 'bg-blue-100 text-blue-700' },
};

export function ProfessionBadge({ type, compact }: { type: ProfessionType; compact?: boolean }) {
    const config = badgeConfig[type] || badgeConfig.trainer;

    if (compact) {
        const letter = type === 'trainer' ? 'T' : type === 'nutritionist' ? 'N' : 'F';
        return (
            <span
                className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    config.className
                )}
                title={config.label}
            >
                {letter}
            </span>
        );
    }

    return (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
            {config.label}
        </span>
    );
}
