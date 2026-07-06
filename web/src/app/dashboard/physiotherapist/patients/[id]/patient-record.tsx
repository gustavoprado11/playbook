'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SessionCard } from '@/components/physio/session-card';
import { PainChart } from '@/components/physio/pain-chart';
import { TreatmentPlanCard } from '@/components/physio/treatment-plan-card';
import { HomeExercisesCard } from '@/components/physio/home-exercises-card';
import { PhysioAttachments } from '@/components/physio/physio-attachments';
import { createPhysioSession, updatePhysioSession } from '@/app/actions/physio';
import type { PhysioAttachment, PhysioSession, PhysioTreatmentPlan, Student } from '@/types/database';

type PhysioSessionType = 'initial_assessment' | 'treatment' | 'reassessment' | 'discharge';
const SESSION_TYPE_LABELS: Record<PhysioSessionType, string> = {
    initial_assessment: 'Avaliação inicial',
    treatment: 'Sessão',
    reassessment: 'Reavaliação',
    discharge: 'Alta',
};

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
    attachments: PhysioAttachment[];
}

export function PatientRecord({ patient, sessions, treatmentPlans, attachments }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('sessions');
    const router = useRouter();
    const [newOpen, setNewOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [sType, setSType] = useState<PhysioSessionType>('treatment');
    const [sDate, setSDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [sNotes, setSNotes] = useState('');

    const openNew = () => {
        setEditingId(null);
        setSType('treatment');
        setSDate(new Date().toISOString().split('T')[0]);
        setSNotes('');
        setNewOpen(true);
    };
    const openEdit = (session: PhysioSession) => {
        setEditingId(session.id);
        setSType(session.session_type as PhysioSessionType);
        setSDate(new Date(session.session_date).toISOString().split('T')[0]);
        setSNotes(session.clinical_notes ?? '');
        setNewOpen(true);
    };

    const handleSaveSession = async () => {
        setSaving(true);
        try {
            const payload = { session_type: sType, session_date: sDate, clinical_notes: sNotes.trim() };
            const res = editingId
                ? await updatePhysioSession(editingId, payload)
                : await createPhysioSession({ student_id: patient.id, ...payload });
            if ('error' in res && res.error) {
                toast.error(res.error);
                return;
            }
            toast.success(editingId ? 'Sessão atualizada' : 'Sessão registrada');
            setNewOpen(false);
            router.refresh();
        } catch {
            toast.error('Erro ao salvar sessão');
        } finally {
            setSaving(false);
        }
    };

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
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-zinc-500">
                            {sessions.length} {sessions.length === 1 ? 'sessão registrada' : 'sessões registradas'}
                        </p>
                        <Button size="sm" onClick={openNew}>
                            <Plus className="mr-1 h-4 w-4" />
                            Nova sessão
                        </Button>
                    </div>
                    {sessions.length === 0 ? (
                        <div className="py-12 text-center text-sm text-zinc-400">
                            Nenhuma sessão registrada
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <SessionCard key={session.id} session={session} onEdit={() => openEdit(session)} />
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
                <PhysioAttachments
                    studentId={patient.id}
                    attachments={attachments}
                    sessions={sessions}
                    treatmentPlans={treatmentPlans}
                />
            )}

            {/* Registrar sessão direto do dashboard do paciente */}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar sessão' : 'Registrar sessão'} — {patient.full_name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={sType} onValueChange={(v) => setSType(v as PhysioSessionType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white">
                                    {(Object.keys(SESSION_TYPE_LABELS) as PhysioSessionType[]).map((k) => (
                                        <SelectItem key={k} value={k}>{SESSION_TYPE_LABELS[k]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="s-date">Data</Label>
                            <Input id="s-date" type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="s-notes">Notas clínicas (opcional)</Label>
                            <Textarea id="s-notes" value={sNotes} onChange={(e) => setSNotes(e.target.value)} placeholder="O que foi feito na sessão…" rows={4} />
                        </div>
                        {!editingId && (
                            <p className="text-xs text-zinc-400">
                                Esta sessão já conta no painel do paciente, mesmo sem agendamento na agenda.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveSession} disabled={saving}>
                            {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
