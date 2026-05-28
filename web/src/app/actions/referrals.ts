'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import type {
    InterdisciplinaryReferral,
    ReferralType,
    ReferralPriority,
    ReferralStatus,
} from '@/types/database';

async function getMyProfessionalId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    return data?.id ?? null;
}

interface CreateReferralInput {
    studentId: string;
    toProfessionalId: string;
    type: ReferralType;
    subject: string;
    body?: string;
    priority?: ReferralPriority;
    contextRef?: { table: string; id: string };
}

export async function createReferral(input: CreateReferralInput) {
    const fromId = await getMyProfessionalId();
    if (!fromId) return { error: 'Profissional não encontrado.' };
    if (fromId === input.toProfessionalId) {
        return { error: 'Não é possível encaminhar para si mesmo.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('interdisciplinary_referrals')
        .insert({
            student_id: input.studentId,
            from_professional_id: fromId,
            to_professional_id: input.toProfessionalId,
            type: input.type,
            subject: input.subject,
            body: input.body ?? null,
            priority: input.priority ?? 'normal',
            context_ref: input.contextRef ?? null,
        })
        .select('id')
        .single();

    if (error) return { error: 'Não foi possível criar o encaminhamento.' };

    revalidatePath('/dashboard');
    return { data };
}

export async function updateReferralStatus(referralId: string, status: ReferralStatus) {
    const supabase = await createClient();
    const resolved = ['completed', 'declined'].includes(status);
    const { error } = await supabase
        .from('interdisciplinary_referrals')
        .update({
            status,
            resolved_at: resolved ? new Date().toISOString() : null,
        })
        .eq('id', referralId);

    if (error) return { error: 'Não foi possível atualizar o status.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function addReferralReply(referralId: string, body: string) {
    const authorId = await getMyProfessionalId();
    if (!authorId) return { error: 'Profissional não encontrado.' };

    const supabase = await createClient();
    const { error } = await supabase.from('referral_replies').insert({
        referral_id: referralId,
        author_professional_id: authorId,
        body,
    });

    if (error) return { error: 'Não foi possível enviar a resposta.' };
    revalidatePath('/dashboard');
    return { success: true };
}

function normalizeReferral(row: Record<string, any>): InterdisciplinaryReferral {
    return {
        ...row,
        from_professional: row.from_professional && {
            id: row.from_professional.id,
            profession_type: row.from_professional.profession_type,
            full_name: row.from_professional.profile?.full_name ?? '',
        },
        to_professional: row.to_professional && {
            id: row.to_professional.id,
            profession_type: row.to_professional.profession_type,
            full_name: row.to_professional.profile?.full_name ?? '',
        },
        replies: Array.isArray(row.replies) && row.replies.length > 0 && 'body' in row.replies[0]
            ? row.replies.map((r: Record<string, any>) => ({
                ...r,
                author: r.author && {
                    full_name: r.author.profile?.full_name ?? '',
                    profession_type: r.author.profession_type,
                },
            }))
            : undefined,
        reply_count: Array.isArray(row.replies) && row.replies[0]?.count !== undefined
            ? row.replies[0].count
            : undefined,
    } as InterdisciplinaryReferral;
}

const LIST_SELECT = `
    *,
    student:students!student_id(id, full_name),
    from_professional:professionals!from_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
    to_professional:professionals!to_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
    replies:referral_replies(count)
`;

export async function getMyReferrals(
    box: 'inbox' | 'sent' = 'inbox'
): Promise<InterdisciplinaryReferral[]> {
    const myId = await getMyProfessionalId();
    if (!myId) return [];

    const admin = createAdminClient();
    const column = box === 'inbox' ? 'to_professional_id' : 'from_professional_id';

    const { data } = await admin
        .from('interdisciplinary_referrals')
        .select(LIST_SELECT)
        .eq(column, myId)
        .order('created_at', { ascending: false });

    return (data || []).map(normalizeReferral);
}

export async function getStudentReferrals(studentId: string): Promise<InterdisciplinaryReferral[]> {
    const myId = await getMyProfessionalId();
    const profile = await getProfile();
    if (!myId && profile?.role !== 'manager') return [];

    const admin = createAdminClient();
    let query = admin
        .from('interdisciplinary_referrals')
        .select(LIST_SELECT)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    if (profile?.role !== 'manager' && myId) {
        query = query.or(`from_professional_id.eq.${myId},to_professional_id.eq.${myId}`);
    }

    const { data } = await query;
    return (data || []).map(normalizeReferral);
}

export async function getReferralThread(referralId: string): Promise<InterdisciplinaryReferral | null> {
    const myId = await getMyProfessionalId();
    const profile = await getProfile();
    if (!myId && profile?.role !== 'manager') return null;

    const admin = createAdminClient();
    const { data } = await admin
        .from('interdisciplinary_referrals')
        .select(`
            *,
            student:students!student_id(id, full_name),
            from_professional:professionals!from_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            to_professional:professionals!to_professional_id(id, profession_type, profile:profiles!profile_id(full_name)),
            replies:referral_replies(*, author:professionals!author_professional_id(profession_type, profile:profiles!profile_id(full_name)))
        `)
        .eq('id', referralId)
        .single();

    if (!data) return null;
    if (data.from_professional_id !== myId && data.to_professional_id !== myId && profile?.role !== 'manager') {
        return null;
    }

    const normalized = normalizeReferral(data);
    // Ordena respostas cronologicamente
    if (normalized.replies) {
        normalized.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return normalized;
}

export async function getPendingReferralCount(): Promise<number> {
    const myId = await getMyProfessionalId();
    if (!myId) return 0;
    const admin = createAdminClient();
    const { count } = await admin
        .from('interdisciplinary_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('to_professional_id', myId)
        .eq('status', 'pending');
    return count ?? 0;
}

export async function getCoProfessionals(studentId: string) {
    const myId = await getMyProfessionalId();
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_professionals')
        .select('professional:professionals!professional_id(id, profession_type, profile:profiles!profile_id(full_name))')
        .eq('student_id', studentId)
        .eq('status', 'active');

    return (data || [])
        .map((l: Record<string, any>) => l.professional)
        .filter((p: Record<string, any>) => p && p.id !== myId)
        .map((p: Record<string, any>) => ({
            id: p.id,
            profession_type: p.profession_type,
            full_name: p.profile?.full_name ?? 'Profissional',
        }));
}

export async function getMyProfessionalContext() {
    const id = await getMyProfessionalId();
    return { professionalId: id };
}
