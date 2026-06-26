'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Paperclip, FileText, ImageIcon, Trash2, Upload, ExternalLink } from 'lucide-react';
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
import { createClient } from '@/lib/supabase/client';
import { createPhysioAttachment, deletePhysioAttachment } from '@/app/actions/physio';
import type { PhysioAttachment, PhysioSession, PhysioTreatmentPlan } from '@/types/database';

interface Props {
    studentId: string;
    attachments: PhysioAttachment[];
    sessions: PhysioSession[];
    treatmentPlans: PhysioTreatmentPlan[];
}

const SESSION_TYPE_LABELS: Record<string, string> = {
    initial_assessment: 'Avaliação inicial',
    treatment: 'Tratamento',
    reassessment: 'Reavaliação',
    discharge: 'Alta',
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB (igual ao bucket)

function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(att: PhysioAttachment): string {
    return att.file_name || att.file_path.split('/').pop() || 'Arquivo';
}

export function PhysioAttachments({ studentId, attachments, sessions, treatmentPlans }: Props) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [parent, setParent] = useState('patient');
    const [busy, startTransition] = useTransition();

    function upload() {
        if (!file) {
            toast.error('Selecione um arquivo para enviar.');
            return;
        }
        if (file.size > MAX_SIZE) {
            toast.error('Arquivo maior que 10MB.');
            return;
        }
        startTransition(async () => {
            try {
                const supabase = createClient();
                const ext = file.name.split('.').pop() || 'bin';
                const filePath = `${studentId}/${crypto.randomUUID()}.${ext}`;

                const { error: upErr } = await supabase.storage
                    .from('physio-attachments')
                    .upload(filePath, file);

                if (upErr) {
                    console.error('Upload error:', upErr);
                    toast.error('Erro ao enviar o arquivo.');
                    return;
                }

                const session_id = parent.startsWith('session:') ? parent.slice(8) : null;
                const treatment_plan_id = parent.startsWith('plan:') ? parent.slice(5) : null;

                const r = await createPhysioAttachment({
                    student_id: studentId,
                    session_id,
                    treatment_plan_id,
                    file_path: filePath,
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    description: description || null,
                });

                if (r.error) {
                    toast.error(r.error);
                    return;
                }

                toast.success('Anexo enviado.');
                setFile(null);
                setDescription('');
                setParent('patient');
                if (inputRef.current) inputRef.current.value = '';
                router.refresh();
            } catch (e) {
                console.error(e);
                toast.error('Erro ao enviar anexo.');
            }
        });
    }

    function remove(id: string) {
        startTransition(async () => {
            const r = await deletePhysioAttachment(id);
            if (r.error) {
                toast.error(r.error);
                return;
            }
            toast.success('Anexo excluído.');
            router.refresh();
        });
    }

    return (
        <div className="space-y-5">
            {/* Upload */}
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="space-y-1.5">
                    <Label htmlFor="physio-attachment-file">Arquivo (PDF ou imagem, até 10MB)</Label>
                    <Input
                        id="physio-attachment-file"
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Vincular a (opcional)</Label>
                        <Select value={parent} onValueChange={setParent}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="patient">Documento do paciente</SelectItem>
                                {sessions.map((s) => (
                                    <SelectItem key={s.id} value={`session:${s.id}`}>
                                        {SESSION_TYPE_LABELS[s.session_type] || 'Sessão'} ·{' '}
                                        {new Date(s.session_date).toLocaleDateString('pt-BR')}
                                    </SelectItem>
                                ))}
                                {treatmentPlans.map((p) => (
                                    <SelectItem key={p.id} value={`plan:${p.id}`}>
                                        Protocolo · {p.diagnosis}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="physio-attachment-desc">Descrição (opcional)</Label>
                        <Input
                            id="physio-attachment-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex.: Laudo de alta - Propulse"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-zinc-400">
                        {file ? `${file.name} · ${formatSize(file.size)}` : 'Nenhum arquivo selecionado'}
                    </span>
                    <Button size="sm" onClick={upload} disabled={!file} isLoading={busy}>
                        <Upload className="mr-1.5 h-4 w-4" />
                        Enviar anexo
                    </Button>
                </div>
            </div>

            {/* Lista */}
            {attachments.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                    <Paperclip className="mx-auto mb-2 h-8 w-8" />
                    <p>Nenhum anexo enviado</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {attachments.map((att) => {
                        const isImage = att.file_type?.startsWith('image');
                        return (
                            <div
                                key={att.id}
                                className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                                    {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-zinc-800">{displayName(att)}</p>
                                    <p className="truncate text-xs text-zinc-400">
                                        {att.description ? `${att.description} · ` : ''}
                                        {formatSize(att.file_size)}
                                        {att.file_size ? ' · ' : ''}
                                        {new Date(att.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                {att.signed_url && (
                                    <a
                                        href={att.signed_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 rounded-md p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800"
                                        title="Abrir / baixar"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                                <button
                                    onClick={() => remove(att.id)}
                                    disabled={busy}
                                    className="shrink-0 text-zinc-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                                    title="Excluir"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
