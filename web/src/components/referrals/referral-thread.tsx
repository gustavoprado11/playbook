'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ProfessionBadge } from '@/components/profession-badge';
import { StatusBadge, referralTypeMeta, priorityMeta, timeAgo } from './referral-ui';
import { updateReferralStatus, addReferralReply } from '@/app/actions/referrals';
import type { InterdisciplinaryReferral, ReferralStatus } from '@/types/database';

interface Props {
    referral: InterdisciplinaryReferral;
    currentProfessionalId: string | null;
    readOnly?: boolean;
    onChanged?: () => void;
}

const contextHref: Record<string, (studentId: string) => string> = {
    physio_sessions: (s) => `/dashboard/physiotherapist/patients/${s}`,
    physio_treatment_plans: (s) => `/dashboard/physiotherapist/patients/${s}`,
    nutrition_consultations: (s) => `/dashboard/nutritionist/patients/${s}`,
    nutrition_meal_plans: (s) => `/dashboard/nutritionist/patients/${s}`,
    student_clearances: (s) => `/dashboard/trainer/students/${s}`,
};

export function ReferralThread({ referral, currentProfessionalId, readOnly, onChanged }: Props) {
    const router = useRouter();
    const [reply, setReply] = useState('');
    const [busy, setBusy] = useState(false);

    const isRecipient = currentProfessionalId === referral.to_professional_id;
    const isSender = currentProfessionalId === referral.from_professional_id;
    const { Icon, label } = referralTypeMeta[referral.type];

    async function changeStatus(status: ReferralStatus) {
        setBusy(true);
        const r = await updateReferralStatus(referral.id, status);
        setBusy(false);
        if (r.error) return toast.error(r.error);
        toast.success('Status atualizado');
        onChanged?.();
        router.refresh();
    }

    async function sendReply() {
        if (!reply.trim()) return;
        setBusy(true);
        const r = await addReferralReply(referral.id, reply.trim());
        setBusy(false);
        if (r.error) return toast.error(r.error);
        setReply('');
        onChanged?.();
        router.refresh();
    }

    return (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
            <div>
                <div className="flex items-center gap-2 text-zinc-500">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                    <StatusBadge status={referral.status} />
                    {referral.priority === 'high' && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityMeta.high.className}`}>Alta</span>
                    )}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">{referral.subject}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
                    {referral.student && (
                        <Link href={`/dashboard/manager/students/${referral.student.id}`} className="font-medium text-zinc-700 hover:underline">
                            {referral.student.full_name}
                        </Link>
                    )}
                    <span>·</span>
                    {referral.from_professional && (
                        <span className="inline-flex items-center gap-1">
                            {referral.from_professional.full_name}
                            <ProfessionBadge type={referral.from_professional.profession_type} compact />
                        </span>
                    )}
                    <span>→</span>
                    {referral.to_professional && (
                        <span className="inline-flex items-center gap-1">
                            {referral.to_professional.full_name}
                            <ProfessionBadge type={referral.to_professional.profession_type} compact />
                        </span>
                    )}
                    <span>·</span>
                    <span>{timeAgo(referral.created_at)}</span>
                </div>
            </div>

            {referral.context_ref && contextHref[referral.context_ref.table] && (
                <Link
                    href={contextHref[referral.context_ref.table](referral.student_id)}
                    className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                    <ExternalLink className="h-3.5 w-3.5" /> Ver origem
                </Link>
            )}

            {referral.body && <p className="whitespace-pre-wrap text-sm text-zinc-700">{referral.body}</p>}

            {referral.replies && referral.replies.length > 0 && (
                <div className="space-y-2 border-t border-zinc-100 pt-3">
                    {referral.replies.map((r) => (
                        <div key={r.id} className="rounded-md bg-zinc-50 p-2.5">
                            <div className="mb-0.5 flex items-center gap-2 text-xs text-zinc-500">
                                <span className="font-medium text-zinc-700">{r.author?.full_name}</span>
                                {r.author?.profession_type && <ProfessionBadge type={r.author.profession_type} compact />}
                                <span>{timeAgo(r.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-zinc-700">{r.body}</p>
                        </div>
                    ))}
                </div>
            )}

            {!readOnly && (
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                    {isRecipient && referral.status === 'pending' && (
                        <>
                            <Button size="sm" onClick={() => changeStatus('accepted')} isLoading={busy}>Aceitar</Button>
                            <Button size="sm" variant="outline" onClick={() => changeStatus('declined')} disabled={busy}>Recusar</Button>
                        </>
                    )}
                    {isRecipient && referral.status === 'accepted' && (
                        <Button size="sm" onClick={() => changeStatus('completed')} isLoading={busy}>Marcar como concluído</Button>
                    )}
                    {isSender && referral.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => changeStatus('declined')} disabled={busy}>Cancelar</Button>
                    )}
                </div>
            )}

            {!readOnly && (isRecipient || isSender) && (
                <div className="flex flex-col gap-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder..." className="min-h-[60px]" />
                    <Button size="sm" className="w-fit" onClick={sendReply} disabled={!reply.trim()} isLoading={busy}>Responder</Button>
                </div>
            )}
        </div>
    );
}
