'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PainIndicator } from './pain-scale';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { PhysioSession } from '@/types/database';

const typeLabels: Record<string, string> = {
    initial_assessment: 'Avaliação Inicial',
    treatment: 'Tratamento',
    reassessment: 'Reavaliação',
    discharge: 'Alta',
};

const typeColors: Record<string, string> = {
    initial_assessment: 'bg-blue-100 text-blue-800 border-blue-200',
    treatment: 'bg-green-100 text-green-800 border-green-200',
    reassessment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    discharge: 'bg-zinc-100 text-zinc-800 border-zinc-200',
};

export function SessionTypeBadge({ type }: { type: string }) {
    return (
        <Badge className={typeColors[type] || 'bg-zinc-100 text-zinc-800'}>
            {typeLabels[type] || type}
        </Badge>
    );
}

export function SessionCard({ session }: { session: PhysioSession }) {
    const [expanded, setExpanded] = useState(false);
    const evolution = Array.isArray(session.evolution) ? session.evolution[0] : session.evolution;
    const anamnesis = Array.isArray(session.anamnesis) ? session.anamnesis[0] : session.anamnesis;
    const metrics = session.metrics || [];

    return (
        <Card className="overflow-hidden">
            <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-zinc-500">
                        {new Date(session.session_date).toLocaleDateString('pt-BR')}
                    </div>
                    <SessionTypeBadge type={session.session_type} />
                </div>
                <div className="flex items-center gap-3">
                    <PainIndicator
                        before={evolution?.pain_before ?? null}
                        after={evolution?.pain_after ?? null}
                    />
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                </div>
            </div>

            {expanded && (
                <CardContent className="border-t border-zinc-100 pt-4">
                    {anamnesis && (
                        <div className="mb-4">
                            <h4 className="mb-2 text-sm font-semibold text-zinc-700">Anamnese</h4>
                            <div className="grid gap-2 text-sm text-zinc-600">
                                {anamnesis.chief_complaint && (
                                    <p><span className="font-medium">Queixa principal:</span> {anamnesis.chief_complaint}</p>
                                )}
                                {anamnesis.pain_location?.length > 0 && (
                                    <p><span className="font-medium">Local da dor:</span> {anamnesis.pain_location.join(', ')}</p>
                                )}
                                {anamnesis.pain_intensity !== null && (
                                    <p><span className="font-medium">Intensidade:</span> {anamnesis.pain_intensity}/10</p>
                                )}
                                {anamnesis.functional_limitations && (
                                    <p><span className="font-medium">Limitações funcionais:</span> {anamnesis.functional_limitations}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {metrics.length > 0 && (
                        <div className="mb-4">
                            <h4 className="mb-2 text-sm font-semibold text-zinc-700">Métricas</h4>
                            <div className="grid gap-1 text-sm text-zinc-600">
                                {metrics.map((m, i) => (
                                    <div key={m.id || i} className="flex items-center gap-2">
                                        <span className="font-medium">{m.body_region} {m.movement && `- ${m.movement}`}:</span>
                                        <span>{m.value}{m.unit && ` ${m.unit}`}</span>
                                        {m.side && <span className="text-zinc-400">({m.side})</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {evolution && (
                        <div className="mb-4">
                            <h4 className="mb-2 text-sm font-semibold text-zinc-700">Evolução</h4>
                            <div className="grid gap-2 text-sm text-zinc-600">
                                {evolution.procedures_performed?.length > 0 && (
                                    <p><span className="font-medium">Procedimentos:</span> {evolution.procedures_performed.join(', ')}</p>
                                )}
                                {evolution.patient_response && (
                                    <p><span className="font-medium">Resposta do paciente:</span> {evolution.patient_response}</p>
                                )}
                                {evolution.next_session_plan && (
                                    <p><span className="font-medium">Plano próxima sessão:</span> {evolution.next_session_plan}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {session.clinical_notes && (
                        <div>
                            <h4 className="mb-1 text-sm font-semibold text-zinc-700">Notas clínicas</h4>
                            <p className="text-sm text-zinc-600">{session.clinical_notes}</p>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
