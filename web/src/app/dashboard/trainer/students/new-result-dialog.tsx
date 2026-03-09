'use client';

import { createAssessment, updateAssessment } from '@/app/actions/results';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import type { AssessmentProtocol, StudentAssessment } from '@/types/database';
import { Plus } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface NewResultDialogProps {
    studentId: string;
    protocols: AssessmentProtocol[];
    assessment?: StudentAssessment;
    trigger?: ReactNode;
}

export function NewResultDialog({
    studentId,
    protocols,
    assessment,
    trigger,
}: NewResultDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedProtocolId, setSelectedProtocolId] = useState<string>(assessment?.protocol_id || '');
    const [metricValues, setMetricValues] = useState<Record<string, string>>({});

    const isEditing = Boolean(assessment);
    const selectedProtocol = protocols.find(p => p.id === selectedProtocolId);

    useEffect(() => {
        if (!open) return;

        if (assessment) {
            setSelectedProtocolId(assessment.protocol_id);
            setMetricValues(
                Object.fromEntries(
                    (assessment.results || []).map((result) => [result.metric_id, String(result.value)])
                )
            );
            return;
        }

        setSelectedProtocolId('');
        setMetricValues({});
    }, [assessment, open]);

    const handleProtocolChange = (value: string) => {
        if (isEditing) return;
        setSelectedProtocolId(value);
        setMetricValues({}); // Reset values when protocol changes
    };

    const handleValueChange = (metricId: string, value: string) => {
        setMetricValues(prev => ({ ...prev, [metricId]: value }));
    };

    async function handleSubmit(formData: FormData) {
        if (!selectedProtocol) return;

        setLoading(true);
        try {
            const date = formData.get('performed_at') as string;
            const notes = formData.get('notes') as string;

            // Validate all required metrics
            const results = selectedProtocol.metrics?.map(metric => {
                const valStr = metricValues[metric.id];
                if (metric.is_required && (!valStr || valStr === '')) {
                    throw new Error(`O campo ${metric.name} é obrigatório`);
                }
                return {
                    metric_id: metric.id,
                    value: parseFloat(valStr || '0')
                };
            }) || [];

            if (!date) throw new Error('Data da medição é obrigatória');

            if (assessment) {
                await updateAssessment({
                    assessment_id: assessment.id,
                    student_id: studentId,
                    protocol_id: selectedProtocol.id,
                    performed_at: date,
                    notes,
                    results,
                });
            } else {
                await createAssessment({
                    student_id: studentId,
                    protocol_id: selectedProtocol.id,
                    performed_at: date,
                    notes,
                    results
                });
            }

            toast.success(isEditing ? 'Avaliação atualizada com sucesso!' : 'Avaliação registrada com sucesso!');
            setOpen(false);
            // Reset
            if (!isEditing) {
                setSelectedProtocolId('');
            }
            setMetricValues({});
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || `Erro ao ${isEditing ? 'atualizar' : 'registrar'} avaliação`);
        } finally {
            setLoading(false);
        }
    }

    // Group protocols by pillar
    const groupedProtocols = protocols.reduce((acc, protocol) => {
        if (!acc[protocol.pillar]) acc[protocol.pillar] = [];
        acc[protocol.pillar].push(protocol);
        return acc;
    }, {} as Record<string, AssessmentProtocol[]>);

    const pillarLabels: Record<string, string> = {
        composition: 'Composição Corporal',
        neuromuscular: 'Performance Neuromuscular',
        specific: 'Desempenho Específico',
        rom: 'Amplitude de Movimento',
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Avaliação
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <form action={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar Avaliação' : 'Registrar Avaliação'}</DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Atualize a data, observações e os valores desta avaliação.'
                                : 'Selecione o protocolo e preencha as métricas.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label>Protocolo</Label>
                            <Select value={selectedProtocolId} onValueChange={handleProtocolChange} required disabled={isEditing}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o protocolo" />
                                </SelectTrigger>
                                <SelectContent className="bg-white z-[100]">
                                    {Object.entries(groupedProtocols).map(([pillar, items]) => (
                                        <div key={pillar}>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 bg-zinc-50">
                                                {pillarLabels[pillar]}
                                            </div>
                                            {items.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedProtocol && (
                            <div className="space-y-4 border rounded-lg p-4 bg-zinc-50/50">
                                <h4 className="font-medium text-sm text-zinc-900 border-b pb-2 mb-2">
                                    Métricas do Protocolo
                                </h4>
                                {selectedProtocol.metrics?.map((metric) => (
                                    <div key={metric.id} className="grid grid-cols-3 gap-4 items-center">
                                        <Label htmlFor={`m-${metric.id}`} className="col-span-1 text-xs font-normal text-zinc-600">
                                            {metric.name} {metric.is_required && <span className="text-red-500">*</span>}
                                        </Label>
                                        <div className="col-span-2 relative">
                                            <Input
                                                id={`m-${metric.id}`}
                                                type="number"
                                                step="0.01"
                                                value={metricValues[metric.id] || ''}
                                                onChange={(e) => handleValueChange(metric.id, e.target.value)}
                                                className="pr-12"
                                                placeholder="0.00"
                                                required={metric.is_required}
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-zinc-400 pointer-events-none">
                                                {metric.unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Data da Avaliação</Label>
                                <Input
                                    id="date"
                                    name="performed_at"
                                    type="date"
                                    defaultValue={assessment?.performed_at || new Date().toISOString().split('T')[0]}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Observações</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    placeholder="Contexto sobre a avaliação..."
                                    className="resize-none"
                                    defaultValue={assessment?.notes || ''}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || !selectedProtocol}>
                            {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Avaliação'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
