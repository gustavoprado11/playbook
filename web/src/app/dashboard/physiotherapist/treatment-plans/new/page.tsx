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
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { listMyPhysioPatients, createTreatmentPlan } from '@/app/actions/physio';
import type { PhysioExercise, PhysioModality } from '@/types/database';

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

interface ExerciseEntry extends PhysioExercise {
    // same fields
}

interface ModalityEntry extends PhysioModality {
    // same fields
}

export default function NewTreatmentPlanPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState<any[]>([]);

    const [studentId, setStudentId] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [objectives, setObjectives] = useState<string[]>([]);
    const [contraindications, setContraindications] = useState<string[]>([]);
    const [estimatedSessions, setEstimatedSessions] = useState('');
    const [frequency, setFrequency] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');

    const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
    const [modalities, setModalities] = useState<ModalityEntry[]>([]);

    useEffect(() => {
        listMyPhysioPatients().then((res) => {
            if (res.data) setPatients(res.data);
        });
    }, []);

    const addExercise = () => {
        setExercises([
            ...exercises,
            { name: '', sets: 3, reps: '10', load: null, notes: '', progression: '' },
        ]);
    };

    const updateExercise = (i: number, field: string, value: any) => {
        const updated = [...exercises];
        (updated[i] as any)[field] = value;
        setExercises(updated);
    };

    const removeExercise = (i: number) => setExercises(exercises.filter((_, j) => j !== i));

    const addModality = () => {
        setModalities([
            ...modalities,
            { name: '', duration: '', area: '', frequency: '', notes: '' },
        ]);
    };

    const updateModality = (i: number, field: string, value: string) => {
        const updated = [...modalities];
        (updated[i] as any)[field] = value;
        setModalities(updated);
    };

    const removeModality = (i: number) => setModalities(modalities.filter((_, j) => j !== i));

    const handleSubmit = async () => {
        if (!studentId) {
            toast.error('Selecione um paciente');
            return;
        }
        if (!diagnosis.trim()) {
            toast.error('Informe o diagnóstico');
            return;
        }

        setLoading(true);
        try {
            const result = await createTreatmentPlan({
                student_id: studentId,
                diagnosis,
                objectives,
                contraindications,
                estimated_sessions: estimatedSessions ? Number(estimatedSessions) : undefined,
                frequency: frequency || undefined,
                start_date: startDate,
                end_date: endDate || undefined,
                exercises: exercises.filter((e) => e.name),
                modalities: modalities.filter((m) => m.name),
                notes: notes || undefined,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Protocolo criado com sucesso');
                router.push('/dashboard/physiotherapist/treatment-plans');
            }
        } catch {
            toast.error('Erro ao criar protocolo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/physiotherapist/treatment-plans">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold text-zinc-900">Novo Protocolo de Tratamento</h1>
            </div>

            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <Input
                            label="Frequência"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            placeholder="Ex: 2x por semana"
                        />
                    </div>

                    <div>
                        <Label>Diagnóstico *</Label>
                        <textarea
                            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            rows={3}
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="Descreva o diagnóstico clínico..."
                        />
                    </div>

                    <div>
                        <Label>Objetivos</Label>
                        <TagInput
                            tags={objectives}
                            onChange={setObjectives}
                            placeholder="Ex: Reduzir dor em 50%"
                        />
                    </div>

                    <div>
                        <Label>Contraindicações</Label>
                        <TagInput
                            tags={contraindications}
                            onChange={setContraindications}
                            placeholder="Ex: Carga axial"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input
                            label="Sessões Estimadas"
                            type="number"
                            value={estimatedSessions}
                            onChange={(e) => setEstimatedSessions(e.target.value)}
                        />
                        <Input
                            label="Data de Início"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <Input
                            label="Data de Término (opcional)"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Exercises */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Exercícios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {exercises.map((ex, i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-zinc-700">Exercício {i + 1}</span>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeExercise(i)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                                <Input
                                    label="Nome"
                                    value={ex.name}
                                    onChange={(e) => updateExercise(i, 'name', e.target.value)}
                                    placeholder="Ex: Agachamento"
                                />
                                <Input
                                    label="Séries"
                                    type="number"
                                    value={ex.sets}
                                    onChange={(e) => updateExercise(i, 'sets', Number(e.target.value))}
                                />
                                <Input
                                    label="Repetições"
                                    value={ex.reps}
                                    onChange={(e) => updateExercise(i, 'reps', e.target.value)}
                                />
                                <Input
                                    label="Carga"
                                    value={ex.load || ''}
                                    onChange={(e) => updateExercise(i, 'load', e.target.value)}
                                    placeholder="Ex: 5kg"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                    label="Observações"
                                    value={ex.notes || ''}
                                    onChange={(e) => updateExercise(i, 'notes', e.target.value)}
                                />
                                <Input
                                    label="Progressão"
                                    value={ex.progression || ''}
                                    onChange={(e) => updateExercise(i, 'progression', e.target.value)}
                                    placeholder="Ex: Aumentar 1kg/semana"
                                />
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addExercise}>
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar exercício
                    </Button>
                </CardContent>
            </Card>

            {/* Modalities */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Modalidades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {modalities.map((mod, i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-zinc-700">Modalidade {i + 1}</span>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeModality(i)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Input
                                    label="Nome"
                                    value={mod.name}
                                    onChange={(e) => updateModality(i, 'name', e.target.value)}
                                    placeholder="Ex: Ultrassom terapêutico"
                                />
                                <Input
                                    label="Duração"
                                    value={mod.duration}
                                    onChange={(e) => updateModality(i, 'duration', e.target.value)}
                                    placeholder="Ex: 10 minutos"
                                />
                                <Input
                                    label="Área"
                                    value={mod.area}
                                    onChange={(e) => updateModality(i, 'area', e.target.value)}
                                    placeholder="Ex: Ombro direito"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                    label="Frequência"
                                    value={mod.frequency || ''}
                                    onChange={(e) => updateModality(i, 'frequency', e.target.value)}
                                    placeholder="Ex: 2x por semana"
                                />
                                <Input
                                    label="Observações"
                                    value={mod.notes || ''}
                                    onChange={(e) => updateModality(i, 'notes', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addModality}>
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar modalidade
                    </Button>
                </CardContent>
            </Card>

            {/* Notes */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Observações Gerais</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        rows={4}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anotações gerais sobre o protocolo..."
                    />
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
                <Link href="/dashboard/physiotherapist/treatment-plans">
                    <Button variant="outline">Cancelar</Button>
                </Link>
                <Button onClick={handleSubmit} isLoading={loading}>
                    Criar Protocolo
                </Button>
            </div>
        </div>
    );
}
