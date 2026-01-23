'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Undo2 } from 'lucide-react';
import { createProtocol, updateProtocol } from '@/app/actions/results';
import { toast } from 'sonner';
import type { AssessmentProtocol, ProtocolMetric } from '@/types/database';

interface MetricDraft {
    id?: string;
    name: string;
    unit: string;
    is_required: boolean;
    is_active?: boolean;
}

interface ProtocolFormProps {
    initialData?: AssessmentProtocol & { metrics?: ProtocolMetric[] };
    onSuccess?: () => void;
}

export function ProtocolForm({ initialData, onSuccess }: ProtocolFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(initialData?.name || '');
    const [pillar, setPillar] = useState<string>(initialData?.pillar || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [metrics, setMetrics] = useState<MetricDraft[]>(
        initialData?.metrics?.map(m => ({
            id: m.id,
            name: m.name,
            unit: m.unit,
            is_required: m.is_required,
            is_active: m.is_active // Use the active status from DB
        })) || [
            { name: 'Resultado', unit: '', is_required: true, is_active: true }
        ]
    );

    const addMetric = () => {
        setMetrics([...metrics, { name: '', unit: '', is_required: true, is_active: true }]);
    };

    const removeMetric = (index: number) => {
        // If it's the only active one, prevent removing if creating new
        const activeCount = metrics.filter(m => m.is_active !== false).length;
        if (activeCount <= 1 && !metrics[index].id) return;

        const newMetrics = [...metrics];
        const metric = newMetrics[index];

        if (metric.id) {
            // Existing metric: Mark as inactive (Archive)
            metric.is_active = false;
        } else {
            // New draft: Remove from array
            newMetrics.splice(index, 1);
        }
        setMetrics(newMetrics);
    };

    const restoreMetric = (index: number) => {
        const newMetrics = [...metrics];
        newMetrics[index].is_active = true;
        setMetrics(newMetrics);
    }

    const updateMetricField = (index: number, field: keyof MetricDraft, value: any) => {
        const newMetrics = [...metrics];
        newMetrics[index] = { ...newMetrics[index], [field]: value };
        setMetrics(newMetrics);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !pillar) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        const activeMetrics = metrics.filter(m => m.is_active !== false);
        if (activeMetrics.some(m => !m.name || !m.unit)) {
            toast.error('Preencha todos os campos das métricas ativas');
            return;
        }

        if (activeMetrics.length === 0) {
            toast.error('O protocolo precisa de pelo menos uma métrica ativa');
            return;
        }

        setIsLoading(true);

        try {
            if (initialData) {
                await updateProtocol({
                    id: initialData.id,
                    name,
                    pillar: pillar as any,
                    description,
                    metrics: metrics.map(m => ({
                        ...m,
                        is_active: m.is_active ?? true
                    }))
                });
                toast.success('Protocolo atualizado com sucesso!');
            } else {
                await createProtocol({
                    name,
                    pillar: pillar as any,
                    description,
                    metrics: activeMetrics
                });
                toast.success('Protocolo criado com sucesso!');

                // Reset form only on create
                setName('');
                setPillar('');
                setDescription('');
                setMetrics([{ name: 'Resultado', unit: '', is_required: true, is_active: true }]);
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            toast.error('Erro ao salvar protocolo');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome do Protocolo</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Bioimpedância Completa"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Pilar</Label>
                        <Select value={pillar} onValueChange={setPillar} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um pilar" />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-[100]">
                                <SelectItem value="composition">Composição Corporal</SelectItem>
                                <SelectItem value="neuromuscular">Neuromuscular</SelectItem>
                                <SelectItem value="specific">Performance Específica</SelectItem>
                                <SelectItem value="rom">Amplitude de Movimento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Descrição (Opcional)</Label>
                    <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Instruções ou detalhes sobre o protocolo..."
                    />
                </div>
            </div>

            <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base">Métricas do Protocolo</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMetric}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Métrica
                    </Button>
                </div>

                <div className="space-y-3">
                    {metrics.map((metric, index) => {
                        const isArchived = metric.is_active === false;

                        if (isArchived) {
                            return (
                                <div key={index} className="flex items-center justify-between bg-red-50 p-2 rounded-lg border border-red-100 opacity-75">
                                    <span className="text-xs text-red-600 font-medium ml-2">
                                        Métrica arquivada: {metric.name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => restoreMetric(index)}
                                        className="h-6 text-red-600 hover:text-red-700 hover:bg-red-100"
                                    >
                                        <Undo2 className="h-4 w-4 mr-1" />
                                        Restaurar
                                    </Button>
                                </div>
                            );
                        }

                        return (
                            <div key={index} className="flex items-end gap-3 bg-zinc-50 p-3 rounded-lg border">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-zinc-500">Nome da Métrica</Label>
                                    <Input
                                        value={metric.name}
                                        onChange={(e) => updateMetricField(index, 'name', e.target.value)}
                                        placeholder="Ex: Peso, Gordura %"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="w-24 space-y-1">
                                    <Label className="text-xs text-zinc-500">Unidade</Label>
                                    <Input
                                        value={metric.unit}
                                        onChange={(e) => updateMetricField(index, 'unit', e.target.value)}
                                        placeholder="kg, %, cm"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-400 hover:text-red-500"
                                    onClick={() => removeMetric(index)}
                                    disabled={metrics.filter(m => m.is_active !== false).length === 1 && !metric.id}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Salvando...' : (initialData ? 'Atualizar Protocolo' : 'Criar Protocolo')}
            </Button>
        </form>
    );
}
