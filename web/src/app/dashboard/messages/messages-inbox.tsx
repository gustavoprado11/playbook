'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { ProfessionBadge } from '@/components/profession-badge';
import { ReferralThread } from '@/components/referrals/referral-thread';
import { StatusBadge, referralTypeMeta, timeAgo } from '@/components/referrals/referral-ui';
import { getReferralThread } from '@/app/actions/referrals';
import type { InterdisciplinaryReferral } from '@/types/database';

interface Props {
    inbox: InterdisciplinaryReferral[];
    sent: InterdisciplinaryReferral[];
    currentProfessionalId: string | null;
    isManager: boolean;
}

export function MessagesInbox({ inbox, sent, currentProfessionalId, isManager }: Props) {
    const [box, setBox] = useState<'inbox' | 'sent'>('inbox');
    const [selected, setSelected] = useState<InterdisciplinaryReferral | null>(null);
    const [pending, startTransition] = useTransition();

    const list = box === 'inbox' ? inbox : sent;

    function open(id: string) {
        startTransition(async () => {
            const thread = await getReferralThread(id);
            setSelected(thread);
        });
    }

    function refresh() {
        if (selected) open(selected.id);
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white">
                <div className="flex border-b border-zinc-200">
                    {(['inbox', 'sent'] as const).map((b) => (
                        <button
                            key={b}
                            onClick={() => setBox(b)}
                            className={cn(
                                'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
                                box === b ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-zinc-500 hover:text-zinc-800'
                            )}
                        >
                            {b === 'inbox' ? 'Recebidos' : 'Enviados'}
                        </button>
                    ))}
                </div>

                <div className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
                    {list.length === 0 ? (
                        <p className="p-4 text-sm text-zinc-500">Nenhuma mensagem.</p>
                    ) : (
                        list.map((r) => {
                            const other = box === 'inbox' ? r.from_professional : r.to_professional;
                            const { Icon } = referralTypeMeta[r.type];
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => open(r.id)}
                                    className={cn(
                                        'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50',
                                        selected?.id === r.id && 'bg-emerald-50',
                                        r.status === 'pending' && box === 'inbox' && 'font-medium'
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1.5 text-sm text-zinc-900">
                                            <Icon className="h-3.5 w-3.5 text-zinc-400" />
                                            {r.subject}
                                        </span>
                                        <StatusBadge status={r.status} />
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                        <span>{r.student?.full_name}</span>
                                        {other && (
                                            <>
                                                <span>·</span>
                                                <span>{other.full_name}</span>
                                                <ProfessionBadge type={other.profession_type} compact />
                                            </>
                                        )}
                                        <span>·</span>
                                        <span>{timeAgo(r.created_at)}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            <div>
                {pending && !selected ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">Carregando…</div>
                ) : selected ? (
                    <ReferralThread
                        referral={selected}
                        currentProfessionalId={currentProfessionalId}
                        readOnly={isManager}
                        onChanged={refresh}
                    />
                ) : (
                    <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
                        Selecione uma mensagem para ver os detalhes.
                    </div>
                )}
            </div>
        </div>
    );
}
