'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { listMyPatients, createMealPlan } from '@/app/actions/nutrition';
import type { StudentProfessional, MealPlanMeal, MealPlanItem } from '@/types/database';

function emptyItem(): MealPlanItem {
    return { food: '', quantity: '' };
}

function emptyMeal(): MealPlanMeal {
    return { name: '', time: '', items: [emptyItem()], notes: '' };
}

export default function NewMealPlanPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedPatient = searchParams.get('patient') || '';

    const [patients, setPatients] = useState<StudentProfessional[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [studentId, setStudentId] = useState(preselectedPatient);
    const [title, setTitle] = useState('');
    const [objective, setObjective] = useState('');
    const [totalCalories, setTotalCalories] = useState('');
    const [proteinG, setProteinG] = useState('');
    const [carbsG, setCarbsG] = useState('');
    const [fatG, setFatG] = useState('');
    const [fiberG, setFiberG] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [meals, setMeals] = useState<MealPlanMeal[]>([emptyMeal()]);

    const loadPatients = useCallback(async () => {
        setLoading(true);
        const res = await listMyPatients();
        if (res.data) setPatients(res.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    const addMeal = () => setMeals((prev) => [...prev, emptyMeal()]);
    const removeMeal = (idx: number) => setMeals((prev) => prev.filter((_, i) => i !== idx));

    const updateMeal = (idx: number, field: keyof MealPlanMeal, val: string) => {
        setMeals((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
    };

    const addItem = (mealIdx: number) => {
        setMeals((prev) => prev.map((m, i) =>
            i === mealIdx ? { ...m, items: [...m.items, emptyItem()] } : m
        ));
    };

    const removeItem = (mealIdx: number, itemIdx: number) => {
        setMeals((prev) => prev.map((m, i) =>
            i === mealIdx ? { ...m, items: m.items.filter((_, j) => j !== itemIdx) } : m
        ));
    };

    const updateItem = (mealIdx: number, itemIdx: number, field: keyof MealPlanItem, val: string | number) => {
        setMeals((prev) => prev.map((m, i) =>
            i === mealIdx ? {
                ...m,
                items: m.items.map((item, j) => j === itemIdx ? { ...item, [field]: val } : item),
            } : m
        ));
    };

    const handleSubmit = async () => {
        if (!studentId || !title || !startDate) {
            toast.error('Preencha paciente, título e data de início.');
            return;
        }
        const validMeals = meals.filter((m) => m.name.trim()).map((m) => ({
            ...m,
            items: m.items.filter((it) => it.food.trim()),
        }));

        if (validMeals.length === 0) {
            toast.error('Adicione ao menos uma refeição.');
            return;
        }

        setSubmitting(true);
        const res = await createMealPlan({
            student_id: studentId,
            title,
            objective: objective || undefined,
            total_calories: totalCalories ? parseInt(totalCalories) : undefined,
            protein_g: proteinG ? parseInt(proteinG) : undefined,
            carbs_g: carbsG ? parseInt(carbsG) : undefined,
            fat_g: fatG ? parseInt(fatG) : undefined,
            fiber_g: fiberG ? parseInt(fiberG) : undefined,
            start_date: startDate,
            end_date: endDate || undefined,
            notes: notes || undefined,
            meals: validMeals,
        });
        setSubmitting(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('Plano alimentar criado com sucesso!');
            router.push(`/dashboard/nutritionist/patients/${studentId}`);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/nutritionist/meal-plans"
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Novo Plano Alimentar</h1>
                    <p className="text-zinc-500 text-sm">Monte o plano alimentar do paciente</p>
                </div>
            </div>

            {/* General info */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Informações Gerais</CardTitle>
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
                        <Input label="Título" placeholder="Ex: Plano de emagrecimento" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <Input label="Objetivo" placeholder="Objetivo do plano" value={objective} onChange={(e) => setObjective(e.target.value)} />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Input label="Calorias (kcal)" type="number" value={totalCalories} onChange={(e) => setTotalCalories(e.target.value)} />
                        <Input label="Proteína (g)" type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
                        <Input label="Carboidratos (g)" type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
                        <Input label="Gordura (g)" type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} />
                        <Input label="Fibra (g)" type="number" value={fiberG} onChange={(e) => setFiberG(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data de início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <Input label="Data de término (opcional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {/* Meals */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Refeições</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={addMeal} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            Adicionar refeição
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {meals.map((meal, mIdx) => (
                        <div key={mIdx} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-end gap-3">
                                <Input
                                    label={`Refeição ${mIdx + 1}`}
                                    placeholder="Ex: Café da manhã"
                                    value={meal.name}
                                    onChange={(e) => updateMeal(mIdx, 'name', e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    label="Horário"
                                    type="time"
                                    value={meal.time}
                                    onChange={(e) => updateMeal(mIdx, 'time', e.target.value)}
                                    className="w-32"
                                />
                                {meals.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMeal(mIdx)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                )}
                            </div>

                            {/* Items */}
                            <div className="space-y-2 ml-4">
                                <Label className="text-xs text-zinc-500">Alimentos</Label>
                                {meal.items.map((item, iIdx) => (
                                    <div key={iIdx} className="flex gap-2 items-end">
                                        <Input
                                            placeholder="Alimento"
                                            value={item.food}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'food', e.target.value)}
                                            className="flex-1"
                                        />
                                        <Input
                                            placeholder="Quantidade"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'quantity', e.target.value)}
                                            className="w-32"
                                        />
                                        <Input
                                            placeholder="kcal"
                                            type="number"
                                            value={item.calories || ''}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'calories', e.target.value ? parseInt(e.target.value) : '')}
                                            className="w-20"
                                        />
                                        <Input
                                            placeholder="P(g)"
                                            type="number"
                                            value={item.protein || ''}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'protein', e.target.value ? parseInt(e.target.value) : '')}
                                            className="w-20"
                                        />
                                        <Input
                                            placeholder="C(g)"
                                            type="number"
                                            value={item.carbs || ''}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'carbs', e.target.value ? parseInt(e.target.value) : '')}
                                            className="w-20"
                                        />
                                        <Input
                                            placeholder="G(g)"
                                            type="number"
                                            value={item.fat || ''}
                                            onChange={(e) => updateItem(mIdx, iIdx, 'fat', e.target.value ? parseInt(e.target.value) : '')}
                                            className="w-20"
                                        />
                                        {meal.items.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(mIdx, iIdx)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button type="button" variant="ghost" size="sm" onClick={() => addItem(mIdx)} className="text-xs">
                                    <Plus className="h-3 w-3 mr-1" /> Adicionar alimento
                                </Button>
                            </div>

                            <div>
                                <Label className="text-xs text-zinc-500">Observações da refeição</Label>
                                <textarea
                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 mt-1"
                                    rows={1}
                                    value={meal.notes || ''}
                                    onChange={(e) => updateMeal(mIdx, 'notes', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Notes */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Observações Gerais</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        rows={3}
                        placeholder="Orientações gerais, substituições permitidas..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSubmit} isLoading={submitting} className="px-8">
                    Salvar plano alimentar
                </Button>
            </div>
        </div>
    );
}
