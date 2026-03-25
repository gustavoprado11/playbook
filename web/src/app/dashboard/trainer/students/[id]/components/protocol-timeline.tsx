'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, Calendar, Pencil, Trash2, ImageIcon, FileText, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import type { AssessmentAttachment } from '@/types/database';
import { formatDate, cn } from '@/lib/utils';
import { buildChartData, type ProtocolGroup } from '@/lib/assessment-logic';
import { MetricEvolutionChart } from '@/components/assessments/metric-evolution-chart';
import type { AssessmentProtocol } from '@/types/database';
import { EvolutionSummary } from './evolution-summary';
import { NewResultDialog } from '../../new-result-dialog';
import { deleteAssessment } from '@/app/actions/results';
import { toast } from 'sonner';

interface ProtocolTimelineProps {
    group: ProtocolGroup;
    studentId: string;
    protocols: AssessmentProtocol[];
    readOnly?: boolean;
}

export function ProtocolTimeline({ group, studentId, protocols, readOnly = false }: ProtocolTimelineProps) {
    const [isOpen, setIsOpen] = useState(true);
    const chartData = buildChartData(group);

    async function handleDeleteAssessment(assessmentId: string) {
        try {
            await deleteAssessment(studentId, assessmentId);
            toast.success('Avaliação excluída com sucesso!');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Erro ao excluir avaliação');
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <h3 className="text-lg font-semibold text-zinc-900">{group.protocolName}</h3>
                        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded uppercase">
                            {group.pillar}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-9 p-0"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                        <span className="sr-only">Toggle</span>
                    </Button>
                </div>

                <div className={cn(
                    "space-y-6 transition-all duration-300 ease-in-out",
                    isOpen ? "opacity-100" : "grid-rows-[0fr] opacity-0 h-0 overflow-hidden"
                )}>
                    {/* Evolution Chart */}
                    <MetricEvolutionChart
                        data={chartData.data}
                        metrics={chartData.metrics}
                        protocolName={group.protocolName}
                    />

                    {/* Evolution Summary Block */}
                    <EvolutionSummary evolution={group.latestEvolution} protocolName={group.protocolName} />

                    {/* Timeline List */}
                    <div className="relative border-l-2 border-zinc-100 ml-4 space-y-8 pb-4 pt-2">
                        {group.assessments.map((assessment) => (
                            <div key={assessment.id} className="relative pl-8">
                                {/* Dot */}
                                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-2 border-zinc-300 ring-4 ring-white" />

                                <div className="bg-white rounded-lg border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
                                                <Calendar className="h-4 w-4" />
                                                {formatDate(assessment.performed_at)}
                                            </div>
                                            {assessment.notes && (
                                                <p className="text-sm text-zinc-600 italic bg-zinc-50 px-2 py-1 rounded inline-block mt-1">
                                                    "{assessment.notes}"
                                                </p>
                                            )}
                                        </div>
                                        {!readOnly && (
                                            <div className="flex items-center gap-2">
                                                <NewResultDialog
                                                    studentId={studentId}
                                                    protocols={protocols}
                                                    assessment={assessment}
                                                    trigger={(
                                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-zinc-500 hover:text-zinc-900">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-zinc-500 hover:text-red-600">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação remove a avaliação e todos os resultados vinculados a ela.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="bg-red-600 hover:bg-red-700"
                                                                onClick={() => handleDeleteAssessment(assessment.id)}
                                                            >
                                                                Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {assessment.results?.map(result => (
                                            <div key={result.id}>
                                                <span className="text-xs text-zinc-500 block">{result.metric?.name}</span>
                                                <span className="font-semibold text-zinc-900">
                                                    {result.value} <span className="text-xs font-normal text-zinc-400">{result.metric?.unit}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {assessment.attachments && assessment.attachments.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-zinc-100">
                                            <span className="text-xs text-zinc-500 block mb-2">Anexos</span>
                                            <div className="flex gap-2 flex-wrap">
                                                {assessment.attachments.map(att => (
                                                    <AttachmentThumbnail key={att.id} attachment={att} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AttachmentThumbnail({ attachment }: { attachment: AssessmentAttachment }) {
    const [url, setUrl] = useState<string | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const isImage = attachment.file_type.startsWith('image/');

    const loadUrl = async () => {
        if (url) return url;
        const supabase = createClient();
        const { data } = await supabase.storage
            .from('assessment-photos')
            .createSignedUrl(attachment.file_path, 3600);
        const signedUrl = data?.signedUrl || '';
        setUrl(signedUrl);
        return signedUrl;
    };

    const handleClick = async () => {
        const signedUrl = await loadUrl();
        if (!signedUrl) return;

        if (isImage) {
            setLightboxOpen(true);
        } else {
            window.open(signedUrl, '_blank');
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
            >
                {isImage ? (
                    <ImageIcon className="h-4 w-4 text-zinc-400" />
                ) : (
                    <FileText className="h-4 w-4 text-zinc-400" />
                )}
                <span className="text-xs text-zinc-600 truncate max-w-[100px]">
                    {attachment.file_name}
                </span>
            </button>

            {isImage && (
                <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                    <DialogContent className="max-w-3xl p-2">
                        {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={url}
                                alt={attachment.file_name}
                                className="w-full h-auto rounded-lg"
                            />
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
