'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createReferral } from '@/app/actions/referrals';
import type { ProfessionType, ReferralType, ReferralPriority } from '@/types/database';

interface CoProfessional {
    id: string;
    profession_type: ProfessionType;
    full_name: string;
}

interface Props {
    studentId: string;
    studentName?: string;
    coProfessionals: CoProfessional[];
    defaultContextRef?: { table: string; id: string };
    trigger?: React.ReactNode;
}

const professionLabel: Record<ProfessionType, string> = {
    trainer: 'Treinador',
    nutritionist: 'Nutricionista',
    physiotherapist: 'Fisioterapeuta',
};

export function NewReferralDialog({ studentId, coProfessionals, defaultContextRef, trigger }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<ReferralType>('referral');
    const [toId, setToId] = useState('');
    const [priority, setPriority] = useState<ReferralPriority>('normal');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);

    const hasRecipients = coProfessionals.length > 0;

    async function handleSubmit() {
        if (!toId || !subject.trim()) return;
        setLoading(true);
        const result = await createReferral({
            studentId,
            toProfessionalId: toId,
            type,
            subject: subject.trim(),
            body: body.trim() || undefined,
            priority,
            contextRef: defaultContextRef,
        });
        setLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Mensagem enviada');
            setOpen(false);
            setSubject('');
            setBody('');
            setToId('');
            router.refresh();
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm">
                        <MessageSquarePlus className="mr-2 h-4 w-4" />
                        Nova mensagem
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova mensagem</DialogTitle>
                </DialogHeader>

                {!hasRecipients ? (
                    <p className="py-4 text-sm text-zinc-500">
                        Este aluno ainda não tem outros profissionais vinculados para receber a mensagem.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Tipo</label>
                                <Select value={type} onValueChange={(v) => setType(v as ReferralType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="referral">Encaminhamento</SelectItem>
                                        <SelectItem value="request">Solicitação</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Prioridade</label>
                                <Select value={priority} onValueChange={(v) => setPriority(v as ReferralPriority)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixa</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Destinatário</label>
                            <Select value={toId} onValueChange={setToId}>
                                <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                                <SelectContent>
                                    {coProfessionals.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.full_name} — {professionLabel[p.profession_type]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Assunto</label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Dor no joelho ao agachar" />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Mensagem</label>
                            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Detalhes (opcional)" />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!hasRecipients || !toId || !subject.trim()} isLoading={loading}>
                        Enviar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
