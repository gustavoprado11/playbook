import { Ban, AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProfessionBadge } from '@/components/profession-badge';
import type { StudentClearance, ClearanceLevel } from '@/types/database';

const levelMeta: Record<ClearanceLevel, { label: string; box: string; Icon: React.ComponentType<{ className?: string }>; iconColor: string }> = {
    contraindicated: { label: 'Contraindicado', box: 'border-red-300 bg-red-50', Icon: Ban, iconColor: 'text-red-600' },
    restricted: { label: 'Restrição ativa', box: 'border-orange-300 bg-orange-50', Icon: AlertOctagon, iconColor: 'text-orange-600' },
    cleared_with_notes: { label: 'Liberado com ressalvas', box: 'border-amber-200 bg-amber-50', Icon: AlertTriangle, iconColor: 'text-amber-600' },
    cleared: { label: 'Liberado', box: 'border-emerald-200 bg-emerald-50', Icon: ShieldCheck, iconColor: 'text-emerald-600' },
};

function isOverdue(reviewDate: string | null) {
    if (!reviewDate) return false;
    return new Date(reviewDate) < new Date(new Date().toISOString().split('T')[0]);
}

export function ClearanceBanner({ clearances, compact }: { clearances: StudentClearance[]; compact?: boolean }) {
    if (!clearances || clearances.length === 0) return null;

    return (
        <div className="space-y-2">
            {clearances.map((c) => {
                const m = levelMeta[c.clearance_level];
                const Icon = m.Icon;
                return (
                    <div key={c.id} className={`flex items-start gap-3 rounded-lg border p-3 ${m.box}`}>
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${m.iconColor}`} />
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-900">{m.label}</span>
                                {c.body_region && <span className="text-sm text-zinc-600">· {c.body_region}</span>}
                                {isOverdue(c.review_date) && (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Reavaliação vencida</span>
                                )}
                            </div>
                            <p className="mt-0.5 text-sm text-zinc-700">{c.description}</p>
                            {!compact && c.affected_movements && c.affected_movements.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {c.affected_movements.map((mv, i) => (
                                        <span key={i} className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-zinc-700">{mv}</span>
                                    ))}
                                </div>
                            )}
                            {!compact && c.issued_by && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>{c.issued_by.full_name}</span>
                                    <ProfessionBadge type={c.issued_by.profession_type} compact />
                                    <span>· desde {new Date(c.effective_from).toLocaleDateString('pt-BR')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
