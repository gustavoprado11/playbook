'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Dumbbell, UtensilsCrossed, Activity, Globe } from 'lucide-react';
import { IntegratedTimeline } from './integrated-timeline';
import { DisciplineSummaryCard } from './discipline-summary-card';
import { NutritionReadonlyView } from './nutrition-readonly-view';
import { PhysioReadonlyView } from './physio-readonly-view';
import { CrossAlerts } from './cross-alerts';
import type { IntegratedStudentView } from '@/app/actions/integrated';

type TabKey = 'training' | 'nutrition' | 'physio' | '360';

interface TabDef {
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const tabs: TabDef[] = [
    { key: 'training', label: 'Treino', icon: Dumbbell },
    { key: 'nutrition', label: 'Nutrição', icon: UtensilsCrossed },
    { key: 'physio', label: 'Fisioterapia', icon: Activity },
    { key: '360', label: 'Visão 360°', icon: Globe },
];

interface StudentDetailTabsProps {
    trainingContent: React.ReactNode;
    integratedView: IntegratedStudentView | null;
}

export function StudentDetailTabs({ trainingContent, integratedView }: StudentDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('training');

    const nutritionCount = integratedView
        ? integratedView.nutrition.recentConsultations.length + integratedView.nutrition.activeMealPlans.length
        : 0;
    const physioCount = integratedView
        ? integratedView.physio.recentSessions.length + integratedView.physio.activeTreatmentPlans.length
        : 0;

    const getCounts = (key: TabKey) => {
        if (key === 'nutrition') return nutritionCount || undefined;
        if (key === 'physio') return physioCount || undefined;
        if (key === '360') return integratedView?.timeline.length || undefined;
        return undefined;
    };

    return (
        <div className="space-y-6">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const count = getCounts(tab.key);
                    const isActive = activeTab === tab.key;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                                isActive
                                    ? 'border-emerald-600 text-emerald-700'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                            {count !== undefined && (
                                <span className={cn(
                                    'text-xs rounded-full px-1.5 py-0.5',
                                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            {activeTab === 'training' && trainingContent}

            {activeTab === 'nutrition' && (
                <div>
                    {integratedView?.nutrition.hasLinkedProfessional ? (
                        <NutritionReadonlyView
                            consultations={integratedView.nutrition.recentConsultations}
                            mealPlans={integratedView.nutrition.activeMealPlans}
                            labResults={integratedView.nutrition.recentLabResults}
                        />
                    ) : (
                        <EmptyDiscipline label="nutricionista" />
                    )}
                </div>
            )}

            {activeTab === 'physio' && (
                <div>
                    {integratedView?.physio.hasLinkedProfessional ? (
                        <PhysioReadonlyView
                            sessions={integratedView.physio.recentSessions}
                            treatmentPlans={integratedView.physio.activeTreatmentPlans}
                        />
                    ) : (
                        <EmptyDiscipline label="fisioterapeuta" />
                    )}
                </div>
            )}

            {activeTab === '360' && integratedView && (
                <div className="space-y-6">
                    {/* Cross-discipline alerts */}
                    <CrossAlerts view={integratedView} />

                    {/* Discipline summary cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <DisciplineSummaryCard
                            discipline="nutritionist"
                            hasLinkedProfessional={integratedView.nutrition.hasLinkedProfessional}
                            professionalName={integratedView.nutrition.professionalName}
                            lastActivityDate={integratedView.nutrition.lastConsultationDate}
                            stats={[
                                { label: 'Consultas', value: integratedView.nutrition.recentConsultations.length },
                                { label: 'Planos ativos', value: integratedView.nutrition.activeMealPlans.length },
                                { label: 'Exames', value: integratedView.nutrition.recentLabResults.length },
                            ]}
                        >
                            {integratedView.nutrition.hasLinkedProfessional && (
                                <NutritionReadonlyView
                                    consultations={integratedView.nutrition.recentConsultations}
                                    mealPlans={integratedView.nutrition.activeMealPlans}
                                    labResults={integratedView.nutrition.recentLabResults}
                                />
                            )}
                        </DisciplineSummaryCard>

                        <DisciplineSummaryCard
                            discipline="physiotherapist"
                            hasLinkedProfessional={integratedView.physio.hasLinkedProfessional}
                            professionalName={integratedView.physio.professionalName}
                            lastActivityDate={integratedView.physio.lastSessionDate}
                            stats={[
                                { label: 'Sessões', value: integratedView.physio.recentSessions.length },
                                { label: 'Protocolos ativos', value: integratedView.physio.activeTreatmentPlans.length },
                            ]}
                        >
                            {integratedView.physio.hasLinkedProfessional && (
                                <PhysioReadonlyView
                                    sessions={integratedView.physio.recentSessions}
                                    treatmentPlans={integratedView.physio.activeTreatmentPlans}
                                />
                            )}
                        </DisciplineSummaryCard>
                    </div>

                    {/* Unified timeline */}
                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 mb-4">Timeline Integrada</h3>
                        <IntegratedTimeline events={integratedView.timeline} />
                    </div>
                </div>
            )}

            {activeTab === '360' && !integratedView && (
                <div className="text-center py-12 text-zinc-500 text-sm">
                    Não foi possível carregar a visão integrada.
                </div>
            )}
        </div>
    );
}

function EmptyDiscipline({ label }: { label: string }) {
    return (
        <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
            <p className="text-zinc-500 font-medium">Sem {label} vinculado(a)</p>
            <p className="text-sm text-zinc-400 mt-1">
                Vincule um(a) {label} na aba de equipe do aluno para ver dados aqui.
            </p>
        </div>
    );
}
