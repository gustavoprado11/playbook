'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ClipboardList, TrendingUp, UtensilsCrossed, FlaskConical, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { createLabResult } from '@/app/actions/nutrition';
import { ConsultationCard } from '@/components/nutrition/consultation-card';
import { MetricsChart } from '@/components/nutrition/metrics-chart';
import { MealPlanViewer } from '@/components/nutrition/meal-plan-viewer';
import { LabResultCard } from '@/components/nutrition/lab-result-card';
import type {
    Student,
    NutritionConsultation,
    NutritionMealPlan,
    NutritionLabResult,
    LabResultEntry,
} from '@/types/database';

type Tab = 'consultas' | 'evolucao' | 'planos' | 'exames';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'consultas', label: 'Consultas', icon: ClipboardList },
    { key: 'evolucao', label: 'Evolução', icon: TrendingUp },
    { key: 'planos', label: 'Planos Alimentares', icon: UtensilsCrossed },
    { key: 'exames', label: 'Exames', icon: FlaskConical },
];

interface PatientRecordProps {
    patient: Student;
    consultations: NutritionConsultation[];
    mealPlans: NutritionMealPlan[];
    labResults: NutritionLabResult[];
}

export function PatientRecord({ patient, consultations, mealPlans, labResults }: PatientRecordProps) {
    const [activeTab, setActiveTab] = useState<Tab>('consultas');
    const [labDialogOpen, setLabDialogOpen] = useState(false);
    const [labLoading, setLabLoading] = useState(false);
    const [labForm, setLabForm] = useState({
        exam_date: new Date().toISOString().split('T')[0],
        exam_type: '',
        notes: '',
        entries: [] as { name: string; value: string; unit: string; reference: string; status: 'normal' | 'low' | 'high' }[],
    });
    const router = useRouter();

    const addLabEntry = () => {
        setLabForm((prev) => ({
            ...prev,
            entries: [...prev.entries, { name: '', value: '', unit: '', reference: '', status: 'normal' as const }],
        }));
    };

    const removeLabEntry = (idx: number) => {
        setLabForm((prev) => ({
            ...prev,
            entries: prev.entries.filter((_, i) => i !== idx),
        }));
    };

    const updateLabEntry = (idx: number, field: string, val: string) => {
        setLabForm((prev) => ({
            ...prev,
            entries: prev.entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e)),
        }));
    };

    const handleLabSubmit = async () => {
        if (!labForm.exam_type || labForm.entries.length === 0) {
            toast.error('Preencha o tipo do exame e adicione ao menos um resultado.');
            return;
        }
        setLabLoading(true);
        const results: Record<string, LabResultEntry> = {};
        for (const e of labForm.entries) {
            if (e.name && e.value) {
                results[e.name] = {
                    value: parseFloat(e.value),
                    unit: e.unit,
                    reference: e.reference,
                    status: e.status,
                };
            }
        }
        const res = await createLabResult({
            student_id: patient.id,
            exam_date: labForm.exam_date,
            exam_type: labForm.exam_type,
            results,
            notes: labForm.notes || undefined,
        });
        setLabLoading(false);
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('Exame registrado com sucesso!');
            setLabDialogOpen(false);
            setLabForm({ exam_date: new Date().toISOString().split('T')[0], exam_type: '', notes: '', entries: [] });
            router.refresh();
        }
    };

    // Patient info
    const info = (
        <Card className="bg-white border-zinc-200">
            <CardContent className="p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
                    {patient.email && <span>Email: <strong className="text-zinc-700">{patient.email}</strong></span>}
                    {patient.phone && <span>Telefone: <strong className="text-zinc-700">{patient.phone}</strong></span>}
                    <span>Início: <strong className="text-zinc-700">{formatDate(patient.start_date)}</strong></span>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4">
            {info}

            {/* Tab buttons */}
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <Button
                            key={tab.key}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab(tab.key)}
                            className="gap-1.5"
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </Button>
                    );
                })}
            </div>

            {/* Tab content */}
            {activeTab === 'consultas' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-zinc-900">Consultas</h2>
                        <Link href={`/dashboard/nutritionist/consultations/new?patient=${patient.id}`}>
                            <Button size="sm" className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Nova consulta
                            </Button>
                        </Link>
                    </div>
                    {consultations.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            <p className="text-zinc-500 text-sm">Nenhuma consulta registrada.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {consultations.map((c) => (
                                <ConsultationCard key={c.id} consultation={c} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'evolucao' && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-900">Evolução</h2>
                    <MetricsChart consultations={consultations} />

                    {/* Body composition comparison table */}
                    {consultations.filter((c) => c.metrics).length >= 2 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium text-zinc-900">Comparativo de Composição Corporal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data</TableHead>
                                                <TableHead>Peso (kg)</TableHead>
                                                <TableHead>IMC</TableHead>
                                                <TableHead>% Gordura</TableHead>
                                                <TableHead>Massa Magra</TableHead>
                                                <TableHead>Cintura</TableHead>
                                                <TableHead>Quadril</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {consultations
                                                .filter((c) => c.metrics)
                                                .sort((a, b) => new Date(b.consultation_date).getTime() - new Date(a.consultation_date).getTime())
                                                .map((c) => (
                                                    <TableRow key={c.id}>
                                                        <TableCell className="font-medium">{formatDate(c.consultation_date)}</TableCell>
                                                        <TableCell>{c.metrics?.weight_kg ?? '—'}</TableCell>
                                                        <TableCell>{c.metrics?.bmi?.toFixed(1) ?? '—'}</TableCell>
                                                        <TableCell>{c.metrics?.body_fat_pct ?? '—'}</TableCell>
                                                        <TableCell>{c.metrics?.lean_mass_kg ?? '—'}</TableCell>
                                                        <TableCell>{c.metrics?.waist_cm ?? '—'}</TableCell>
                                                        <TableCell>{c.metrics?.hip_cm ?? '—'}</TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {activeTab === 'planos' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-zinc-900">Planos Alimentares</h2>
                        <Link href={`/dashboard/nutritionist/meal-plans/new?patient=${patient.id}`}>
                            <Button size="sm" className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Novo plano
                            </Button>
                        </Link>
                    </div>
                    {mealPlans.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            <p className="text-zinc-500 text-sm">Nenhum plano alimentar registrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Active plans first */}
                            {mealPlans
                                .sort((a, b) => (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1))
                                .map((plan) => (
                                    <MealPlanViewer key={plan.id} plan={plan} />
                                ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'exames' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-zinc-900">Exames Laboratoriais</h2>
                        <Dialog open={labDialogOpen} onOpenChange={setLabDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-1.5">
                                    <Plus className="h-4 w-4" />
                                    Novo exame
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Registrar Exame</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            label="Data do exame"
                                            type="date"
                                            value={labForm.exam_date}
                                            onChange={(e) => setLabForm((p) => ({ ...p, exam_date: e.target.value }))}
                                        />
                                        <Input
                                            label="Tipo do exame"
                                            placeholder="Ex: Hemograma"
                                            value={labForm.exam_type}
                                            onChange={(e) => setLabForm((p) => ({ ...p, exam_type: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-sm font-medium">Resultados</Label>
                                            <Button type="button" variant="outline" size="sm" onClick={addLabEntry}>
                                                <Plus className="h-3 w-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                        {labForm.entries.map((entry, idx) => (
                                            <div key={idx} className="flex gap-2 items-end mb-2">
                                                <Input
                                                    placeholder="Nome"
                                                    value={entry.name}
                                                    onChange={(e) => updateLabEntry(idx, 'name', e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Input
                                                    placeholder="Valor"
                                                    type="number"
                                                    value={entry.value}
                                                    onChange={(e) => updateLabEntry(idx, 'value', e.target.value)}
                                                    className="w-20"
                                                />
                                                <Input
                                                    placeholder="Unidade"
                                                    value={entry.unit}
                                                    onChange={(e) => updateLabEntry(idx, 'unit', e.target.value)}
                                                    className="w-20"
                                                />
                                                <Input
                                                    placeholder="Ref."
                                                    value={entry.reference}
                                                    onChange={(e) => updateLabEntry(idx, 'reference', e.target.value)}
                                                    className="w-24"
                                                />
                                                <Select
                                                    value={entry.status}
                                                    onValueChange={(v) => updateLabEntry(idx, 'status', v)}
                                                >
                                                    <SelectTrigger className="w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="normal">Normal</SelectItem>
                                                        <SelectItem value="low">Baixo</SelectItem>
                                                        <SelectItem value="high">Alto</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeLabEntry(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <Label className="text-sm font-medium mb-1.5 block">Observações</Label>
                                        <textarea
                                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                            rows={2}
                                            value={labForm.notes}
                                            onChange={(e) => setLabForm((p) => ({ ...p, notes: e.target.value }))}
                                        />
                                    </div>

                                    <Button
                                        className="w-full"
                                        onClick={handleLabSubmit}
                                        isLoading={labLoading}
                                    >
                                        Salvar exame
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {labResults.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            <p className="text-zinc-500 text-sm">Nenhum exame registrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {labResults.map((r) => (
                                <LabResultCard key={r.id} result={r} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
