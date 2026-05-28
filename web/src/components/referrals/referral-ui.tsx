'use client';

import { ArrowRightLeft, HelpCircle, ShieldCheck, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReferralType, ReferralStatus, ReferralPriority } from '@/types/database';

export const referralTypeMeta: Record<ReferralType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
    referral: { label: 'Encaminhamento', Icon: ArrowRightLeft },
    request: { label: 'Solicitação', Icon: HelpCircle },
    clearance: { label: 'Liberação', Icon: ShieldCheck },
    alert: { label: 'Alerta', Icon: Bell },
};

export const statusMeta: Record<ReferralStatus, { label: string; className: string }> = {
    pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
    accepted: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-700' },
    declined: { label: 'Recusado', className: 'bg-zinc-100 text-zinc-600' },
};

export const priorityMeta: Record<ReferralPriority, { label: string; className: string }> = {
    high: { label: 'Alta', className: 'bg-red-100 text-red-700' },
    normal: { label: 'Normal', className: 'bg-zinc-100 text-zinc-600' },
    low: { label: 'Baixa', className: 'bg-zinc-50 text-zinc-400' },
};

export function timeAgo(date: string) {
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
        return '';
    }
}

export function StatusBadge({ status }: { status: ReferralStatus }) {
    const m = statusMeta[status];
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.className}`}>{m.label}</span>;
}
