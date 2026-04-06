'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { NutritionConsultation, NutritionConsultationType } from '@/types/database';

const typeLabels: Record<NutritionConsultationType, string> = {
    initial_assessment: 'Avaliacao Inicial',
    follow_up: 'Retorno',
    reassessment: 'Reavaliacao',
};

const typeColors: Record<NutritionConsultationType, string> = {
    initial_assessment: 'bg-emerald-100 text-emerald-700',
    follow_up: 'bg-blue-100 text-blue-700',
    reassessment: 'bg-amber-100 text-amber-700',
};

interface ConsultationCardProps {
    consultation: NutritionConsultation;
}

export function ConsultationCard({ consultation }: ConsultationCardProps) {
    const [expanded, setExpanded] = useState(false);
    const anamnesis = consultation.anamnesis;
    const metrics = consultation.metrics;

    return (
        <Card className="bg-white border-zinc-200">
            <CardContent className="p-4">
                <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-zinc-900">
                                    {formatDate(consultation.consultation_date)}
                                </span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[consultation.consultation_type]}`}>
                                    {typeLabels[consultation.consultation_type]}
                                </span>
                            </div>
                            {consultation.chief_complaint && (
                                <p className="text-sm text-zinc-500 mt-0.5">{consultation.chief_complaint}</p>
                            )}
                        </div>
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                    )}
                </button>

                {expanded && (
                    <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4">
                        {consultation.clinical_notes && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-700 mb-1">Notas Clinicas</h4>
                                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{consultation.clinical_notes}</p>
                            </div>
                        )}

                        {anamnesis && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-700 mb-2">Anamnese</h4>
                                <div className="grid gap-2 text-sm">
                                    {anamnesis.dietary_history && (
                                        <div><span className="text-zinc-500">Historico alimentar:</span> <span className="text-zinc-700">{anamnesis.dietary_history}</span></div>
                                    )}
                                    {anamnesis.objective && (
                                        <div><span className="text-zinc-500">Objetivo:</span> <span className="text-zinc-700">{anamnesis.objective}</span></div>
                                    )}
                                    {anamnesis.food_allergies?.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500">Alergias:</span>
                                            {anamnesis.food_allergies.map((a) => (
                                                <span key={a} className="bg-red-50 text-red-700 text-xs px-1.5 py-0.5 rounded">{a}</span>
                                            ))}
                                        </div>
                                    )}
                                    {anamnesis.food_intolerances?.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500">Intolerancias:</span>
                                            {anamnesis.food_intolerances.map((i) => (
                                                <span key={i} className="bg-amber-50 text-amber-700 text-xs px-1.5 py-0.5 rounded">{i}</span>
                                            ))}
                                        </div>
                                    )}
                                    {anamnesis.supplements?.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-zinc-500">Suplementos:</span>
                                            {anamnesis.supplements.map((s) => (
                                                <span key={s} className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded">{s}</span>
                                            ))}
                                        </div>
                                    )}
                                    {anamnesis.water_intake_ml && (
                                        <div><span className="text-zinc-500">Ingestao hidrica:</span> <span className="text-zinc-700">{anamnesis.water_intake_ml} ml/dia</span></div>
                                    )}
                                    {anamnesis.bowel_habits && (
                                        <div><span className="text-zinc-500">Habito intestinal:</span> <span className="text-zinc-700">{anamnesis.bowel_habits}</span></div>
                                    )}
                                    {anamnesis.sleep_quality && (
                                        <div><span className="text-zinc-500">Qualidade do sono:</span> <span className="text-zinc-700">{anamnesis.sleep_quality}</span></div>
                                    )}
                                </div>
                            </div>
                        )}

                        {metrics && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-700 mb-2">Metricas</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                    {metrics.weight_kg && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">Peso</span><span className="font-medium">{metrics.weight_kg} kg</span></div>}
                                    {metrics.height_cm && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">Altura</span><span className="font-medium">{metrics.height_cm} cm</span></div>}
                                    {metrics.bmi && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">IMC</span><span className="font-medium">{metrics.bmi.toFixed(1)}</span></div>}
                                    {metrics.body_fat_pct && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">% Gordura</span><span className="font-medium">{metrics.body_fat_pct}%</span></div>}
                                    {metrics.lean_mass_kg && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">Massa Magra</span><span className="font-medium">{metrics.lean_mass_kg} kg</span></div>}
                                    {metrics.waist_cm && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">Cintura</span><span className="font-medium">{metrics.waist_cm} cm</span></div>}
                                    {metrics.hip_cm && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">Quadril</span><span className="font-medium">{metrics.hip_cm} cm</span></div>}
                                    {metrics.basal_metabolic_rate && <div className="bg-zinc-50 rounded p-2"><span className="text-zinc-500 block text-xs">TMB</span><span className="font-medium">{metrics.basal_metabolic_rate} kcal</span></div>}
                                </div>
                            </div>
                        )}

                        {!anamnesis && !metrics && !consultation.clinical_notes && (
                            <p className="text-sm text-zinc-500">Nenhum detalhe adicional registrado.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
