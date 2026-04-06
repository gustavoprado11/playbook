'use client';

import { ConsultationCard } from '@/components/nutrition/consultation-card';
import { MealPlanViewer } from '@/components/nutrition/meal-plan-viewer';
import { LabResultCard } from '@/components/nutrition/lab-result-card';
import { MetricsChart } from '@/components/nutrition/metrics-chart';
import type { NutritionConsultation, NutritionMealPlan, NutritionLabResult } from '@/types/database';

interface NutritionReadonlyViewProps {
    consultations: NutritionConsultation[];
    mealPlans: NutritionMealPlan[];
    labResults: NutritionLabResult[];
}

export function NutritionReadonlyView({ consultations, mealPlans, labResults }: NutritionReadonlyViewProps) {
    const hasData = consultations.length > 0 || mealPlans.length > 0 || labResults.length > 0;

    if (!hasData) {
        return (
            <div className="text-center py-8 text-zinc-500 text-sm">
                Nenhum dado nutricional registrado ainda.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Body composition chart */}
            {consultations.length > 0 && (
                <MetricsChart consultations={consultations} />
            )}

            {/* Active meal plans */}
            {mealPlans.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Planos Alimentares Ativos</h4>
                    <div className="space-y-3">
                        {mealPlans.map(p => (
                            <MealPlanViewer key={p.id} plan={p} compact />
                        ))}
                    </div>
                </div>
            )}

            {/* Recent consultations */}
            {consultations.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Consultas Recentes</h4>
                    <div className="space-y-2">
                        {consultations.map(c => (
                            <ConsultationCard key={c.id} consultation={c} />
                        ))}
                    </div>
                </div>
            )}

            {/* Lab results */}
            {labResults.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-zinc-700 mb-3">Exames Laboratoriais</h4>
                    <div className="space-y-3">
                        {labResults.map(r => (
                            <LabResultCard key={r.id} result={r} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
