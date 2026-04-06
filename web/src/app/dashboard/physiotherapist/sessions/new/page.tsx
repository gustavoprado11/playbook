'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PainSlider } from '@/components/physio/pain-scale';
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
    listMyPhysioPatients,
    listTreatmentPlans,
    createPhysioSession,
} from '@/app/actions/physio';
import type {
    PhysioSessionType,
    PhysioMetricType,
    PhysioBodySide,
    CreatePhysioSessionInput,
} from '@/types/database';

interface MetricEntry {
    metric_type: PhysioMetricType;
    body_region: string;
    movement: string | null;
    value: number | null;
    unit: string | null;
    side: PhysioBodySide | null;
    is_within_normal: boolean | null;
    reference_value: string | null;
    notes: string | null;
}

interface ExercisePerformed {
    name: string;
    sets_done: number;
    reps_done: string;
    load_used: string | null;
    tolerance: string;
}

interface HomeExercise {
    name: string;
    frequency: string;
    duration: string;
    notes: string;
}

// Tag input helper
function TagInput({
    tags,
    onChange,
    placeholder,
}: {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder: string;
}) {
    const [input, setInput] = useState('');
    const addTag = () => {
        const val = input.trim();
        if (val && !tags.includes(val)) {
            onChange([...tags, val]);
        }
        setInput('');
    };
    return (
        <div>
            <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                        }
                    }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Collapsible section
function Section({
    title,
    children,
    defaultOpen = false,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Card>
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{title}</CardTitle>
                    {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                </div>
            </CardHeader>
            {open && <CardContent className="space-y-4">{children}</CardContent>}
        </Card>
    );
}

export default function NewSessionPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);

    // Step 1
    const [studentId, setStudentId] = useState('');
    const [sessionType, setSessionType] = useState<PhysioSessionType>('treatment');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [treatmentPlanId, setTreatmentPlanId] = useState('');

    // Step 2 - Anamnesis
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [painLocation, setPainLocation] = useState<string[]>([]);
    const [painIntensity, setPainIntensity] = useState(0);
    const [painType, setPainType] = useState('');
    const [onsetDate, setOnsetDate] = useState('');
    const [aggravatingFactors, setAggravatingFactors] = useState<string[]>([]);
    const [relievingFactors, setRelievingFactors] = useState<string[]>([]);
    const [medicalHistory, setMedicalHistory] = useState('');
    const [surgicalHistory, setSurgicalHistory] = useState('');
    const [medications, setMedications] = useState<string[]>([]);
    const [imagingResults, setImagingResults] = useState('');
    const [functionalLimitations, setFunctionalLimitations] = useState('');
    const [previousTreatments, setPreviousTreatments] = useState('');

    // Step 3 - Metrics
    const [metrics, setMetrics] = useState<MetricEntry[]>([]);

    // Step 4 - Evolution
    const [proceduresPerformed, setProceduresPerformed] = useState<string[]>([]);
    const [painBefore, setPainBefore] = useState(0);
    const [painAfter, setPainAfter] = useState(0);
    const [patientResponse, setPatientResponse] = useState('');
    const [exercisesPerformed, setExercisesPerformed] = useState<ExercisePerformed[]>([]);
    const [homeExercises, setHomeExercises] = useState<HomeExercise[]>([]);
    const [nextSessionPlan, setNextSessionPlan] = useState('');

    // Step 5
    const [clinicalNotes, setClinicalNotes] = useState('');

    useEffect(() => {
        listMyPhysioPatients().then((res) => {
            if (res.data) setPatients(res.data);
        });
    }, []);

    useEffect(() => {
        if (studentId) {
            listTreatmentPlans(studentId).then((res) => {
                if (res.data) setPlans(res.data.filter((p: any) => p.status === 'active'));
            });
        }
    }, [studentId]);

    const addMetric = () => {
        setMetrics([
            ...metrics,
            {
                metric_type: 'rom',
                body_region: '',
                movement: null,
                value: null,
                unit: null,
                side: null,
                is_within_normal: null,
                reference_value: null,
                notes: null,
            },
        ]);
    };

    const updateMetric = (i: number, field: string, value: any) => {
        const updated = [...metrics];
        (updated[i] as any)[field] = value;
        setMetrics(updated);
    };

    const removeMetric = (i: number) => setMetrics(metrics.filter((_, j) => j !== i));

    const addExercisePerformed = () => {
        setExercisesPerformed([
            ...exercisesPerformed,
            { name: '', sets_done: 0, reps_done: '', load_used: null, tolerance: '' },
        ]);
    };

    const updateExercisePerformed = (i: number, field: string, value: any) => {
        const updated = [...exercisesPerformed];
        (updated[i] as any)[field] = value;
        setExercisesPerformed(updated);
    };

    const removeExercisePerformed = (i: number) =>
        setExercisesPerformed(exercisesPerformed.filter((_, j) => j !== i));

    const addHomeExercise = () => {
        setHomeExercises([
            ...homeExercises,
            { name: '', frequency: '', duration: '', notes: '' },
        ]);
    };

    const updateHomeExercise = (i: number, field: string, value: string) => {
        const updated = [...homeExercises];
        (updated[i] as any)[field] = value;
        setHomeExercises(updated);
    };

    const removeHomeExercise = (i: number) =>
        setHomeExercises(homeExercises.filter((_, j) => j !== i));

    const handleSubmit = async () => {
        if (!studentId) {
            toast.error('Selecione um paciente');
            return;
        }

        setLoading(true);
        try {
            const input: CreatePhysioSessionInput = {
                student_id: studentId,
                session_date: sessionDate,
                session_type: sessionType,
                clinical_notes: clinicalNotes || undefined,
            };

            // Anamnesis for initial_assessment
            if (sessionType === 'initial_assessment') {
                input.anamnesis = {
                    chief_complaint: chiefComplaint || null,
                    pain_location: painLocation,
                    pain_intensity: painIntensity,
                    pain_type: painType || null,
                    onset_date: onsetDate || null,
                    aggravating_factors: aggravatingFactors,
                    relieving_factors: relievingFactors,
                    medical_history: medicalHistory || null,
                    surgical_history: surgicalHistory || null,
                    medications,
                    imaging_results: imagingResults || null,
                    functional_limitations: functionalLimitations || null,
                    previous_treatments: previousTreatments || null,
                    additional_notes: null,
                };
            }

            // Metrics
            if (metrics.length > 0) {
                input.metrics = metrics.map((m) => ({
                    metric_type: m.metric_type,
                    body_region: m.body_region,
                    movement: m.movement,
                    value: m.value,
                    unit: m.unit,
                    side: m.side,
                    is_within_normal: m.is_within_normal,
                    reference_value: m.reference_value,
                    notes: m.notes,
                }));
            }

            // Evolution for non-initial sessions
            if (sessionType !== 'initial_assessment') {
                input.evolution = {
                    treatment_plan_id: treatmentPlanId || null,
                    procedures_performed: proceduresPerformed,
                    patient_response: patientResponse || null,
                    pain_before: painBefore,
                    pain_after: painAfter,
                    exercises_performed: exercisesPerformed.filter((e) => e.name),
                    home_exercises: homeExercises.filter((e) => e.name),
                    next_session_plan: nextSessionPlan || null,
                    notes: null,
                };
            }

            const result = await createPhysioSession(input);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Sessão criada com sucesso');
                router.push('/dashboard/physiotherapist/sessions');
            }
        } catch {
            toast.error('Erro ao criar sessão');
        } finally {
            setLoading(false);
        }
    };

    const isAssessment = sessionType === 'initial_assessment';
    const showEvolution = sessionType !== 'initial_assessment';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/physiotherapist/sessions">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold text-zinc-900">Nova Sessão</h1>
            </div>

            {/* Step 1: Basic Info */}
            <Section title="1. Informações Básicas" defaultOpen>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <Label>Paciente *</Label>
                        <Select value={studentId} onValueChange={setStudentId}>
                            <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Selecione o paciente" />
                            </SelectTrigger>
                            <SelectContent>
                                {patients.map((sp: any) => (
                                    <SelectItem key={sp.student?.id} value={sp.student?.id || ''}>
                                        {sp.student?.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Tipo de Sessão</Label>
                        <Select value={sessionType} onValueChange={(v) => setSessionType(v as PhysioSessionType)}>
                            <SelectTrigger className="mt-1.5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="initial_assessment">Avaliação Inicial</SelectItem>
                                <SelectItem value="treatment">Tratamento</SelectItem>
                                <SelectItem value="reassessment">Reavaliação</SelectItem>
                                <SelectItem value="discharge">Alta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Input
                        label="Data da Sessão"
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                    />
                    {plans.length > 0 && (
                        <div>
                            <Label>Protocolo de Tratamento (opcional)</Label>
                            <Select value={treatmentPlanId} onValueChange={setTreatmentPlanId}>
                                <SelectTrigger className="mt-1.5">
                                    <SelectValue placeholder="Vincular a protocolo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Nenhum</SelectItem>
                                    {plans.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.diagnosis}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </Section>

            {/* Step 2: Anamnesis (only for initial_assessment) */}
            {isAssessment && (
                <Section title="2. Anamnese" defaultOpen>
                    <div className="space-y-4">
                        <div>
                            <Label>Queixa Principal</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={3}
                                value={chiefComplaint}
                                onChange={(e) => setChiefComplaint(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Local da Dor</Label>
                            <TagInput
                                tags={painLocation}
                                onChange={setPainLocation}
                                placeholder="Ex: Ombro direito"
                            />
                        </div>

                        <PainSlider
                            value={painIntensity}
                            onChange={setPainIntensity}
                            label="Intensidade da Dor"
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Tipo de Dor"
                                value={painType}
                                onChange={(e) => setPainType(e.target.value)}
                                placeholder="Ex: Aguda, Crônica, Queimação"
                            />
                            <Input
                                label="Data de Início"
                                type="date"
                                value={onsetDate}
                                onChange={(e) => setOnsetDate(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label>Fatores Agravantes</Label>
                                <TagInput
                                    tags={aggravatingFactors}
                                    onChange={setAggravatingFactors}
                                    placeholder="Ex: Movimento acima da cabeça"
                                />
                            </div>
                            <div>
                                <Label>Fatores de Alívio</Label>
                                <TagInput
                                    tags={relievingFactors}
                                    onChange={setRelievingFactors}
                                    placeholder="Ex: Repouso"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label>Histórico Médico</Label>
                                <textarea
                                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    rows={2}
                                    value={medicalHistory}
                                    onChange={(e) => setMedicalHistory(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Histórico Cirúrgico</Label>
                                <textarea
                                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    rows={2}
                                    value={surgicalHistory}
                                    onChange={(e) => setSurgicalHistory(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Medicamentos</Label>
                            <TagInput
                                tags={medications}
                                onChange={setMedications}
                                placeholder="Ex: Ibuprofeno 600mg"
                            />
                        </div>

                        <div>
                            <Label>Resultados de Exames de Imagem</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={2}
                                value={imagingResults}
                                onChange={(e) => setImagingResults(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Limitações Funcionais</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={2}
                                value={functionalLimitations}
                                onChange={(e) => setFunctionalLimitations(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Tratamentos Anteriores</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={2}
                                value={previousTreatments}
                                onChange={(e) => setPreviousTreatments(e.target.value)}
                            />
                        </div>
                    </div>
                </Section>
            )}

            {/* Step 3: Metrics */}
            <Section title={isAssessment ? '3. Métricas' : '2. Métricas'}>
                <div className="space-y-4">
                    {metrics.map((metric, i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-zinc-700">Métrica {i + 1}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeMetric(i)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <Label>Tipo</Label>
                                    <Select
                                        value={metric.metric_type}
                                        onValueChange={(v) => updateMetric(i, 'metric_type', v)}
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rom">ADM (ROM)</SelectItem>
                                            <SelectItem value="strength">Força</SelectItem>
                                            <SelectItem value="pain">Dor</SelectItem>
                                            <SelectItem value="functional_test">Teste Funcional</SelectItem>
                                            <SelectItem value="posture">Postura</SelectItem>
                                            <SelectItem value="gait">Marcha</SelectItem>
                                            <SelectItem value="balance">Equilíbrio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input
                                    label="Região Corporal"
                                    value={metric.body_region}
                                    onChange={(e) => updateMetric(i, 'body_region', e.target.value)}
                                    placeholder="Ex: Ombro"
                                />
                                <Input
                                    label="Movimento"
                                    value={metric.movement || ''}
                                    onChange={(e) => updateMetric(i, 'movement', e.target.value)}
                                    placeholder="Ex: Flexão"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                                <Input
                                    label="Valor"
                                    type="number"
                                    value={metric.value ?? ''}
                                    onChange={(e) => updateMetric(i, 'value', e.target.value ? Number(e.target.value) : null)}
                                />
                                <Input
                                    label="Unidade"
                                    value={metric.unit || ''}
                                    onChange={(e) => updateMetric(i, 'unit', e.target.value)}
                                    placeholder="Ex: graus"
                                />
                                <div>
                                    <Label>Lado</Label>
                                    <Select
                                        value={metric.side || ''}
                                        onValueChange={(v) => updateMetric(i, 'side', v || null)}
                                    >
                                        <SelectTrigger className="mt-1.5">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Esquerdo</SelectItem>
                                            <SelectItem value="right">Direito</SelectItem>
                                            <SelectItem value="bilateral">Bilateral</SelectItem>
                                            <SelectItem value="midline">Linha média</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2 pb-0.5">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={metric.is_within_normal === true}
                                            onChange={(e) => updateMetric(i, 'is_within_normal', e.target.checked)}
                                            className="rounded border-zinc-300"
                                        />
                                        Normal
                                    </label>
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                    label="Valor de Referência"
                                    value={metric.reference_value || ''}
                                    onChange={(e) => updateMetric(i, 'reference_value', e.target.value)}
                                />
                                <Input
                                    label="Observações"
                                    value={metric.notes || ''}
                                    onChange={(e) => updateMetric(i, 'notes', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addMetric}>
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar métrica
                    </Button>
                </div>
            </Section>

            {/* Step 4: Evolution */}
            {showEvolution && (
                <Section title="3. Evolução" defaultOpen>
                    <div className="space-y-4">
                        <div>
                            <Label>Procedimentos Realizados</Label>
                            <TagInput
                                tags={proceduresPerformed}
                                onChange={setProceduresPerformed}
                                placeholder="Ex: Mobilização articular"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <PainSlider
                                value={painBefore}
                                onChange={setPainBefore}
                                label="Dor Antes"
                            />
                            <PainSlider
                                value={painAfter}
                                onChange={setPainAfter}
                                label="Dor Depois"
                            />
                        </div>

                        <div>
                            <Label>Resposta do Paciente</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={3}
                                value={patientResponse}
                                onChange={(e) => setPatientResponse(e.target.value)}
                            />
                        </div>

                        {/* Exercises Performed */}
                        <div>
                            <Label className="mb-2 block">Exercícios Realizados</Label>
                            {exercisesPerformed.map((ex, i) => (
                                <div key={i} className="mb-2 flex items-start gap-2 rounded-lg border border-zinc-200 p-3">
                                    <div className="grid flex-1 gap-2 sm:grid-cols-5">
                                        <Input
                                            placeholder="Nome"
                                            value={ex.name}
                                            onChange={(e) => updateExercisePerformed(i, 'name', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Séries"
                                            type="number"
                                            value={ex.sets_done || ''}
                                            onChange={(e) => updateExercisePerformed(i, 'sets_done', Number(e.target.value))}
                                        />
                                        <Input
                                            placeholder="Reps"
                                            value={ex.reps_done}
                                            onChange={(e) => updateExercisePerformed(i, 'reps_done', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Carga"
                                            value={ex.load_used || ''}
                                            onChange={(e) => updateExercisePerformed(i, 'load_used', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Tolerância"
                                            value={ex.tolerance}
                                            onChange={(e) => updateExercisePerformed(i, 'tolerance', e.target.value)}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeExercisePerformed(i)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addExercisePerformed}>
                                <Plus className="mr-1 h-4 w-4" />
                                Adicionar exercício
                            </Button>
                        </div>

                        {/* Home Exercises */}
                        <div>
                            <Label className="mb-2 block">Exercícios para Casa</Label>
                            {homeExercises.map((ex, i) => (
                                <div key={i} className="mb-2 flex items-start gap-2 rounded-lg border border-zinc-200 p-3">
                                    <div className="grid flex-1 gap-2 sm:grid-cols-4">
                                        <Input
                                            placeholder="Nome"
                                            value={ex.name}
                                            onChange={(e) => updateHomeExercise(i, 'name', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Frequência"
                                            value={ex.frequency}
                                            onChange={(e) => updateHomeExercise(i, 'frequency', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Duração"
                                            value={ex.duration}
                                            onChange={(e) => updateHomeExercise(i, 'duration', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Observações"
                                            value={ex.notes}
                                            onChange={(e) => updateHomeExercise(i, 'notes', e.target.value)}
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeHomeExercise(i)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addHomeExercise}>
                                <Plus className="mr-1 h-4 w-4" />
                                Adicionar exercício para casa
                            </Button>
                        </div>

                        <div>
                            <Label>Plano para Próxima Sessão</Label>
                            <textarea
                                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                rows={3}
                                value={nextSessionPlan}
                                onChange={(e) => setNextSessionPlan(e.target.value)}
                            />
                        </div>
                    </div>
                </Section>
            )}

            {/* Step 5: Clinical Notes */}
            <Section title={showEvolution ? '4. Notas Clínicas' : (isAssessment ? '4. Notas Clínicas' : '3. Notas Clínicas')}>
                <textarea
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    rows={4}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Anotações gerais sobre a sessão..."
                />
            </Section>

            {/* Submit */}
            <div className="flex justify-end gap-3">
                <Link href="/dashboard/physiotherapist/sessions">
                    <Button variant="outline">Cancelar</Button>
                </Link>
                <Button onClick={handleSubmit} isLoading={loading}>
                    Salvar Sessão
                </Button>
            </div>
        </div>
    );
}
