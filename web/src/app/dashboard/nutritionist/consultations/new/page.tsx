'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { listMyPatients, createNutritionConsultation } from '@/app/actions/nutrition';
import type { NutritionConsultationType, StudentProfessional } from '@/types/database';

const consultationTypes: { value: NutritionConsultationType; label: string }[] = [
    { value: 'initial_assessment', label: 'Avaliação Inicial' },
    { value: 'follow_up', label: 'Retorno' },
    { value: 'reassessment', label: 'Reavaliação' },
];

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
    const [input, setInput] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault();
            const items = input.split(',').map((s) => s.trim()).filter(Boolean);
            onChange([...value, ...items]);
            setInput('');
        }
    };

    return (
        <div>
            <div className="flex flex-wrap gap-1 mb-1">
                {value.map((tag, i) => (
                    <span key={i} className="bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        {tag}
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
            <input
                className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    if (input.trim()) {
                        const items = input.split(',').map((s) => s.trim()).filter(Boolean);
                        onChange([...value, ...items]);
                        setInput('');
                    }
                }}
            />
        </div>
    );
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Card>
            <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => setOpen(!open)}
            >
                <span className="font-medium text-zinc-900">{title}</span>
                {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
            </button>
            {open && <CardContent className="pt-0 pb-4">{children}</CardContent>}
        </Card>
    );
}

export default function NewConsultationPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedPatient = searchParams.get('patient') || '';

    const [patients, setPatients] = useState<StudentProfessional[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Step 1: Basic info
    const [studentId, setStudentId] = useState(preselectedPatient);
    const [consultationType, setConsultationType] = useState<NutritionConsultationType>('follow_up');
    const [consultationDate, setConsultationDate] = useState(new Date().toISOString().split('T')[0]);
    const [chiefComplaint, setChiefComplaint] = useState('');

    // Step 2: Anamnesis
    const [dietaryHistory, setDietaryHistory] = useState('');
    const [foodAllergies, setFoodAllergies] = useState<string[]>([]);
    const [foodIntolerances, setFoodIntolerances] = useState<string[]>([]);
    const [supplements, setSupplements] = useState<string[]>([]);
    const [pathologies, setPathologies] = useState<string[]>([]);
    const [medications, setMedications] = useState<string[]>([]);
    const [objective, setObjective] = useState('');
    const [dailyRoutine, setDailyRoutine] = useState('');
    const [waterIntake, setWaterIntake] = useState('');
    const [bowelHabits, setBowelHabits] = useState('');
    const [sleepQuality, setSleepQuality] = useState('');

    // Step 3: Metrics
    const [weightKg, setWeightKg] = useState('');
    const [heightCm, setHeightCm] = useState('');
    const [bodyFatPct, setBodyFatPct] = useState('');
    const [leanMassKg, setLeanMassKg] = useState('');
    const [waistCm, setWaistCm] = useState('');
    const [hipCm, setHipCm] = useState('');
    const [armCm, setArmCm] = useState('');
    const [thighCm, setThighCm] = useState('');
    const [chestCm, setChestCm] = useState('');
    const [calfCm, setCalfCm] = useState('');
    const [visceralFat, setVisceralFat] = useState('');
    const [bmr, setBmr] = useState('');

    // Step 4: Clinical notes
    const [clinicalNotes, setClinicalNotes] = useState('');

    const calculatedBmi = weightKg && heightCm
        ? (parseFloat(weightKg) / Math.pow(parseFloat(heightCm) / 100, 2)).toFixed(1)
        : null;

    const loadPatients = useCallback(async () => {
        setLoading(true);
        const res = await listMyPatients();
        if (res.data) setPatients(res.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    const handleSubmit = async () => {
        if (!studentId) {
            toast.error('Selecione um paciente.');
            return;
        }
        setSubmitting(true);

        const hasAnamnesis = dietaryHistory || foodAllergies.length || foodIntolerances.length || supplements.length || pathologies.length || medications.length || objective || dailyRoutine || waterIntake || bowelHabits || sleepQuality;
        const hasMetrics = weightKg || heightCm || bodyFatPct || leanMassKg || waistCm || hipCm;

        const input = {
            student_id: studentId,
            consultation_date: consultationDate,
            consultation_type: consultationType,
            chief_complaint: chiefComplaint || undefined,
            clinical_notes: clinicalNotes || undefined,
            anamnesis: hasAnamnesis ? {
                dietary_history: dietaryHistory || null,
                food_allergies: foodAllergies,
                food_intolerances: foodIntolerances,
                supplements,
                pathologies,
                medications,
                objective: objective || null,
                daily_routine: dailyRoutine || null,
                water_intake_ml: waterIntake ? parseInt(waterIntake) : null,
                bowel_habits: bowelHabits || null,
                sleep_quality: sleepQuality || null,
                additional_notes: null,
            } : undefined,
            metrics: hasMetrics ? {
                weight_kg: weightKg ? parseFloat(weightKg) : null,
                height_cm: heightCm ? parseFloat(heightCm) : null,
                bmi: calculatedBmi ? parseFloat(calculatedBmi) : null,
                body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
                lean_mass_kg: leanMassKg ? parseFloat(leanMassKg) : null,
                waist_cm: waistCm ? parseFloat(waistCm) : null,
                hip_cm: hipCm ? parseFloat(hipCm) : null,
                arm_cm: armCm ? parseFloat(armCm) : null,
                thigh_cm: thighCm ? parseFloat(thighCm) : null,
                chest_cm: chestCm ? parseFloat(chestCm) : null,
                calf_cm: calfCm ? parseFloat(calfCm) : null,
                visceral_fat_level: visceralFat ? parseInt(visceralFat) : null,
                basal_metabolic_rate: bmr ? parseInt(bmr) : null,
                additional_measures: {},
            } : undefined,
        };

        const res = await createNutritionConsultation(input);
        setSubmitting(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('Consulta criada com sucesso!');
            router.push(`/dashboard/nutritionist/patients/${studentId}`);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/nutritionist/consultations"
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Nova Consulta</h1>
                    <p className="text-zinc-500 text-sm">Preencha os dados da consulta nutricional</p>
                </div>
            </div>

            {/* Step 1: Basic Info */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Paciente</Label>
                            <Select value={studentId} onValueChange={setStudentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione o paciente'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {patients.map((sp) => (
                                        <SelectItem key={sp.student?.id || sp.id} value={sp.student?.id || ''}>
                                            {sp.student?.full_name || 'Paciente'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Tipo de consulta</Label>
                            <Select value={consultationType} onValueChange={(v) => setConsultationType(v as NutritionConsultationType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {consultationTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            label="Data da consulta"
                            type="date"
                            value={consultationDate}
                            onChange={(e) => setConsultationDate(e.target.value)}
                        />
                        <Input
                            label="Queixa principal"
                            placeholder="Motivo da consulta"
                            value={chiefComplaint}
                            onChange={(e) => setChiefComplaint(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Step 2: Anamnesis */}
            <CollapsibleSection title="Anamnese">
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Histórico alimentar</Label>
                        <textarea
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            rows={3}
                            placeholder="Descreva o histórico alimentar do paciente"
                            value={dietaryHistory}
                            onChange={(e) => setDietaryHistory(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Alergias alimentares</Label>
                            <TagInput value={foodAllergies} onChange={setFoodAllergies} placeholder="Digite e pressione Enter" />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Intolerâncias</Label>
                            <TagInput value={foodIntolerances} onChange={setFoodIntolerances} placeholder="Digite e pressione Enter" />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Suplementos</Label>
                            <TagInput value={supplements} onChange={setSupplements} placeholder="Digite e pressione Enter" />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Patologias</Label>
                            <TagInput value={pathologies} onChange={setPathologies} placeholder="Digite e pressione Enter" />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Medicamentos</Label>
                            <TagInput value={medications} onChange={setMedications} placeholder="Digite e pressione Enter" />
                        </div>
                        <Input
                            label="Objetivo"
                            placeholder="Objetivo do paciente"
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Rotina diária</Label>
                        <textarea
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            rows={2}
                            value={dailyRoutine}
                            onChange={(e) => setDailyRoutine(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="Ingestão hídrica (ml/dia)"
                            type="number"
                            placeholder="2000"
                            value={waterIntake}
                            onChange={(e) => setWaterIntake(e.target.value)}
                        />
                        <Input
                            label="Hábito intestinal"
                            placeholder="Regular, constipado..."
                            value={bowelHabits}
                            onChange={(e) => setBowelHabits(e.target.value)}
                        />
                        <Input
                            label="Qualidade do sono"
                            placeholder="Boa, ruim, regular..."
                            value={sleepQuality}
                            onChange={(e) => setSleepQuality(e.target.value)}
                        />
                    </div>
                </div>
            </CollapsibleSection>

            {/* Step 3: Metrics */}
            <CollapsibleSection title="Medidas Antropométricas">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Peso (kg)" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                        <Input label="Altura (cm)" type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">IMC (calculado)</Label>
                            <div className="h-10 flex items-center px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-700">
                                {calculatedBmi || '—'}
                            </div>
                        </div>
                        <Input label="% Gordura" type="number" step="0.1" value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Massa magra (kg)" type="number" step="0.1" value={leanMassKg} onChange={(e) => setLeanMassKg(e.target.value)} />
                        <Input label="Cintura (cm)" type="number" step="0.1" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} />
                        <Input label="Quadril (cm)" type="number" step="0.1" value={hipCm} onChange={(e) => setHipCm(e.target.value)} />
                        <Input label="Braço (cm)" type="number" step="0.1" value={armCm} onChange={(e) => setArmCm(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Coxa (cm)" type="number" step="0.1" value={thighCm} onChange={(e) => setThighCm(e.target.value)} />
                        <Input label="Tórax (cm)" type="number" step="0.1" value={chestCm} onChange={(e) => setChestCm(e.target.value)} />
                        <Input label="Panturrilha (cm)" type="number" step="0.1" value={calfCm} onChange={(e) => setCalfCm(e.target.value)} />
                        <Input label="Gordura visceral" type="number" value={visceralFat} onChange={(e) => setVisceralFat(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="TMB (kcal)" type="number" value={bmr} onChange={(e) => setBmr(e.target.value)} />
                    </div>
                </div>
            </CollapsibleSection>

            {/* Step 4: Clinical Notes */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Notas Clínicas</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        rows={4}
                        placeholder="Observações gerais, condutas, encaminhamentos..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSubmit} isLoading={submitting} className="px-8">
                    Salvar consulta
                </Button>
            </div>
        </div>
    );
}
