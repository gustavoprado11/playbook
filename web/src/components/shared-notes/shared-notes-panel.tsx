'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ProfessionBadge } from '@/components/profession-badge';
import { timeAgo } from '@/components/referrals/referral-ui';
import { createSharedNote, togglePinSharedNote, deleteSharedNote } from '@/app/actions/shared-notes';
import type { StudentSharedNote, SharedNoteCategory } from '@/types/database';

const categoryMeta: Record<SharedNoteCategory, { label: string; className: string }> = {
    general: { label: 'Geral', className: 'bg-zinc-100 text-zinc-600' },
    goal: { label: 'Objetivo', className: 'bg-emerald-100 text-emerald-700' },
    behavior: { label: 'Comportamento', className: 'bg-violet-100 text-violet-700' },
    logistics: { label: 'Logística', className: 'bg-blue-100 text-blue-700' },
    health: { label: 'Saúde', className: 'bg-red-100 text-red-700' },
};

interface Props {
    studentId: string;
    notes: StudentSharedNote[];
    currentProfileId: string;
    readOnly?: boolean;
}

export function SharedNotesPanel({ studentId, notes, currentProfileId, readOnly }: Props) {
    const router = useRouter();
    const [body, setBody] = useState('');
    const [category, setCategory] = useState<SharedNoteCategory>('general');
    const [busy, setBusy] = useState(false);

    async function add() {
        if (!body.trim()) return;
        setBusy(true);
        const r = await createSharedNote({ studentId, body: body.trim(), category });
        setBusy(false);
        if (r.error) return toast.error(r.error);
        setBody('');
        setCategory('general');
        router.refresh();
    }

    async function pin(id: string, next: boolean) {
        const r = await togglePinSharedNote(id, next);
        if (r.error) return toast.error(r.error);
        router.refresh();
    }

    async function remove(id: string) {
        const r = await deleteSharedNote(id);
        if (r.error) return toast.error(r.error);
        toast.success('Nota excluída');
        router.refresh();
    }

    return (
        <div className="space-y-4">
            {!readOnly && (
                <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Adicionar nota visível a toda a equipe…" className="min-h-[60px]" />
                    <div className="flex items-center justify-between gap-2">
                        <Select value={category} onValueChange={(v) => setCategory(v as SharedNoteCategory)}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {(Object.keys(categoryMeta) as SharedNoteCategory[]).map((k) => (
                                    <SelectItem key={k} value={k}>{categoryMeta[k].label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={add} disabled={!body.trim()} isLoading={busy}>Adicionar nota</Button>
                    </div>
                </div>
            )}

            {notes.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma nota compartilhada ainda.</p>
            ) : (
                <div className="space-y-2">
                    {notes.map((n) => {
                        const cat = categoryMeta[n.category];
                        const canManage = !readOnly && n.author_profile_id === currentProfileId;
                        return (
                            <div key={n.id} className={`rounded-lg border p-3 ${n.is_pinned ? 'border-amber-200 bg-amber-50/40' : 'border-zinc-200 bg-white'}`}>
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <span className="font-medium text-zinc-700">{n.author?.full_name}</span>
                                        {n.author?.profession_type && <ProfessionBadge type={n.author.profession_type} compact />}
                                        <span>· {timeAgo(n.created_at)}</span>
                                        <span className={`rounded-full px-2 py-0.5 font-medium ${cat.className}`}>{cat.label}</span>
                                        {n.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
                                    </div>
                                    {canManage && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => pin(n.id, !n.is_pinned)} className="text-zinc-400 hover:text-zinc-700" title={n.is_pinned ? 'Desafixar' : 'Fixar'}>
                                                {n.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                            </button>
                                            <button onClick={() => remove(n.id)} className="text-zinc-400 hover:text-red-600" title="Excluir">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-zinc-700">{n.body}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
