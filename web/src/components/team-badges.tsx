'use client';

import { ProfessionBadge } from '@/components/profession-badge';
import type { ProfessionType } from '@/types/database';

interface TeamBadgesProps {
    professionals: { profession_type: ProfessionType; name?: string }[];
}

export function TeamBadges({ professionals }: TeamBadgesProps) {
    if (!professionals || professionals.length === 0) return null;

    return (
        <div className="flex items-center gap-1">
            {professionals.map((p, i) => (
                <ProfessionBadge key={`${p.profession_type}-${i}`} type={p.profession_type} compact />
            ))}
        </div>
    );
}
