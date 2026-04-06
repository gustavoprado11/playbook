'use client';

import { SessionCard } from '@/components/physio/session-card';
import { PainChart } from '@/components/physio/pain-chart';
import { TreatmentPlanCard } from '@/components/physio/treatment-plan-card';
import type { PhysioSession, PhysioTreatmentPlan } from '@/types/database';

interface PhysioReadonlyViewProps {
    sessions: PhysioSession[];
    treatmentPlans: PhysioTreatmentPlan[];
}

export function PhysioReadonlyView({ sessions, treatmentPlans }: PhysioReadonlyViewProps) {
    const hasData = sessions.length > 0 || treatmentPlans.length > 0;

    if (!hasData) {
        return (
            <div className="text-center py-8 text-zinc-500 text-sm">
                Nenhum dado de fisioterapia registrado ainda.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Pain evolution chart */}
            {sessions.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Evolução da Dor</h4>
                    <PainChart sessions={sessions} />
                </div>
            )}

            {/* Active treatment plans */}
            {treatmentPlans.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Protocolos de Tratamento Ativos</h4>
                    <div className="space-y-3">
                        {treatmentPlans.map(p => (
                            <TreatmentPlanCard key={p.id} plan={p} />
                        ))}
                    </div>
                </div>
            )}

            {/* Recent sessions */}
            {sessions.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Sessões Recentes</h4>
                    <div className="space-y-2">
                        {sessions.map(s => (
                            <SessionCard key={s.id} session={s} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
