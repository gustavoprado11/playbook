'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Activity, ClipboardList, MoreVertical, Pencil, Trash2, Archive } from 'lucide-react';
import { deleteProtocol } from '@/app/actions/results';
import { toast } from 'sonner';
import { ProtocolForm } from './protocol-form';
import type { AssessmentProtocol, ProtocolMetric } from '@/types/database';

interface ProtocolListProps {
    protocols: (AssessmentProtocol & { metrics?: ProtocolMetric[] })[];
}

export function ProtocolList({ protocols }: ProtocolListProps) {
    const [editingProtocol, setEditingProtocol] = useState<(AssessmentProtocol & { metrics?: ProtocolMetric[] }) | null>(null);
    const [deletingProtocolId, setDeletingProtocolId] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!deletingProtocolId) return;

        try {
            await deleteProtocol(deletingProtocolId);
            toast.success('Protocolo arquivado com sucesso');
        } catch (error) {
            toast.error('Erro ao arquivar protocolo');
        } finally {
            setDeletingProtocolId(null);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        Protocolos Ativos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {protocols.length === 0 ? (
                            <p className="text-sm text-zinc-500 text-center py-8">
                                Nenhum protocolo configurado.
                            </p>
                        ) : (
                            protocols.map((protocol) => (
                                <div
                                    key={protocol.id}
                                    className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-3 relative group"
                                >
                                    <div className="flex items-start justify-between pr-8">
                                        <div>
                                            <h3 className="font-medium text-zinc-900">{protocol.name}</h3>
                                            <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mt-1">
                                                {protocol.pillar === 'composition' && 'Composição Corporal'}
                                                {protocol.pillar === 'neuromuscular' && 'Neuromuscular'}
                                                {protocol.pillar === 'specific' && 'Performance Específica'}
                                                {protocol.pillar === 'rom' && 'Amplitude (ROM)'}
                                            </p>
                                        </div>

                                        <div className="absolute top-2 right-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-white">
                                                    <DropdownMenuItem onClick={() => setEditingProtocol(protocol)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => setDeletingProtocolId(protocol.id)}
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Archive className="mr-2 h-4 w-4" />
                                                        Arquivar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {/* Metrics List */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {protocol.metrics
                                            ?.filter(m => m.is_active !== false)
                                            .map((metric) => (
                                                <div key={metric.id} className="text-xs bg-white px-2 py-1.5 rounded border text-zinc-600 flex justify-between">
                                                    <span>{metric.name}</span>
                                                    <span className="text-zinc-400 font-mono">{metric.unit}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingProtocol} onOpenChange={(open) => !open && setEditingProtocol(null)}>
                <DialogContent className="max-w-xl bg-white">
                    <DialogHeader>
                        <DialogTitle>Editar Protocolo</DialogTitle>
                        <DialogDescription>
                            Faça alterações no protocolo. Métricas com avaliações associadas têm restrições de edição.
                        </DialogDescription>
                    </DialogHeader>

                    {editingProtocol && (
                        <ProtocolForm
                            initialData={editingProtocol}
                            onSuccess={() => setEditingProtocol(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete/Archive Confirmation */}
            <AlertDialog open={!!deletingProtocolId} onOpenChange={(open) => !open && setDeletingProtocolId(null)}>
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar Protocolo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Este protocolo não aparecerá mais para novos lançamentos.
                            O histórico de avaliações existente SERÁ MANTIDO e continuará visível.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Sim, arquivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
