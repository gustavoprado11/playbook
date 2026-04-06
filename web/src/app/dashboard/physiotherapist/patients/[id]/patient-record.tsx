'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SessionCard } from '@/components/physio/session-card';
import { PainChart } from '@/components/physio/pain-chart';
import { TreatmentPlanCard } from '@/components/physio/treatment-plan-card';
import { HomeExercisesCard } from '@/components/physio/home-exercises-card';
import { Paperclip, FileText } from 'lucide-react';
import type { PhysioSession, PhysioTreatmentPlan, Student } from '@/types/database';

const tabs = [
    { key: 'sessions', label: 'Sessões' },
    { key: 'evolution', label: 'Evolução' },
    { key: 'protocols', label: 'Protocolos' },
    { key: 'home', label: 'Exercícios para Casa' },
    { key: 'attachments', label: 'Anexos' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

interface Props {
    patient: Student;
    sessions: PhysioSession[];
    treatmentPlans: PhysioTreatmentPlan[];
}

export function PatientRecord({ patient, sessions, treatmentPlans }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('sessions');

    // Get home exercises from the most recent session with evolution
    const latestEvolution = sessions.find((s) => {
        const evo = Array.isArray(s.evolution) ? s.evolution[0] : s.evolution;
        return evo?.home_exercises?.length;
    });
    const homeExercises = latestEvolution
        ? (Array.isArray(latestEvolution.evolution)
            ? latestEvolution.evolution[0]?.home_exercises
            : latestEvolution.evolution?.home_exercises) || []
        : [];

    // ROM metrics from sessions
    const romMetrics = sessions.flatMap((s) =>
        (s.metrics || []).filter((m) => m.metric_type === 'rom')
    );

    // Session count per treatment plan
    const sessionCountByPlan: Record<string, number> = {};
    sessions.forEach((s) => {
        const evo = Array.isArray(s.evolution) ? s.evolution[0] : s.evolution;
        if (evo?.treatment_plan_id) {
            sessionCountByPlan[evo.treatment_plan_id] = (sessionCountByPlan[evo.treatment_plan_id] || 0) + 1;
        }
    });

    return (
        <div className="space-y-4">
            {/* Tab buttons */}
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
                {tabs.map((tab) => (
                    <Button
                        key={tab.key}
                        variant={activeTab === tab.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
                <div className="space-y-3">
                    {sessions.length === 0 ? (
                        <div className="py-12 text-center text-sm text-zinc-400">
                            Nenhuma sessão registrada
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <SessionCard key={session.id} session={session} />
                        ))
                    )}
                </div>
            )}

            {/* Evolution Tab */}
            {activeTab === 'evolution' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Evolução da Dor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PainChart sessions={sessions} />
                        </CardContent>
                    </Card>

                    {romMetrics.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Comparativo de ADM (ROM)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Região</TableHead>
                                            <TableHead>Movimento</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Lado</TableHead>
                                            <TableHead>Normal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {romMetrics.map((m, i) => (
                                            <TableRow key={m.id || i}>
                                                <TableCell className="font-medium">{m.body_region}</TableCell>
                                                <TableCell>{m.movement || '-'}</TableCell>
                                                <TableCell>{m.value}{m.unit && ` ${m.unit}`}</TableCell>
                                                <TableCell>{m.side || '-'}</TableCell>
                                                <TableCell>
                                                    {m.is_within_normal === true ? (
                                                        <Badge className="bg-green-100 text-green-800">Sim</Badge>
                                                    ) : m.is_within_normal === false ? (
                                                        <Badge className="bg-red-100 text-red-800">Não</Badge>
                                                    ) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Protocols Tab */}
            {activeTab === 'protocols' && (
                <div className="space-y-4">
                    {treatmentPlans.length === 0 ? (
                        <div className="py-12 text-center text-sm text-zinc-400">
                            Nenhum protocolo de tratamento
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {treatmentPlans
                                .sort((a, b) => (a.status === 'active' ? -1 : 1))
                                .map((plan) => (
                                    <TreatmentPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        sessionsCount={sessionCountByPlan[plan.id] || 0}
                                    />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Home Exercises Tab */}
            {activeTab === 'home' && (
                <div>
                    <p className="mb-4 text-sm text-zinc-500">
                        Exercícios da última sessão com evolução registrada
                    </p>
                    <HomeExercisesCard exercises={homeExercises} />
                </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
                <div className="py-12 text-center text-sm text-zinc-400">
                    <Paperclip className="mx-auto mb-2 h-8 w-8" />
                    <p>Nenhum anexo encontrado</p>
                    <p className="mt-1 text-xs">Os anexos são associados às sessões e protocolos</p>
                </div>
            )}
        </div>
    );
}
