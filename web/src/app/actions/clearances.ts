'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StudentClearance, ClearanceLevel } from '@/types/database';

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

interface CreateClearanceInput {
    studentId: string;
    level: ClearanceLevel;
    description: string;
    bodyRegion?: string;
    affectedMovements?: string[];
    reviewDate?: string;
}

export async function createClearance(input: CreateClearanceInput) {
    const proId = await getMyProfessionalId();
    if (!proId) return { error: 'Profissional não encontrado.' };

    const supabase = await createClient();
    const { error } = await supabase.from('student_clearances').insert({
        student_id: input.studentId,
        issued_by_professional_id: proId,
        clearance_level: input.level,
        description: input.description,
        body_region: input.bodyRegion ?? null,
        affected_movements: input.affectedMovements ?? null,
        review_date: input.reviewDate ?? null,
    });

    if (error) return { error: 'Não foi possível registrar a liberação.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function liftClearance(clearanceId: string, note?: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('student_clearances')
        .update({ status: 'lifted', lifted_at: new Date().toISOString(), lifted_note: note ?? null })
        .eq('id', clearanceId);

    if (error) return { error: 'Não foi possível encerrar a liberação.' };
    revalidatePath('/dashboard');
    return { success: true };
}

const SELECT = `*, issued_by:professionals!issued_by_professional_id(profession_type, profile:profiles!profile_id(full_name))`;

function normalize(c: Record<string, any>): StudentClearance {
    return {
        ...c,
        issued_by: c.issued_by && {
            full_name: c.issued_by.profile?.full_name ?? '',
            profession_type: c.issued_by.profession_type,
        },
    } as StudentClearance;
}

export async function getActiveClearances(studentId: string): Promise<StudentClearance[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_clearances')
        .select(SELECT)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
    return (data || []).map(normalize);
}

export async function getClearanceHistory(studentId: string): Promise<StudentClearance[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_clearances')
        .select(SELECT)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
    return (data || []).map(normalize);
}

export async function getActiveClearancesForStudents(
    studentIds: string[]
): Promise<Record<string, StudentClearance[]>> {
    if (studentIds.length === 0) return {};
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_clearances')
        .select(SELECT)
        .in('student_id', studentIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    const map: Record<string, StudentClearance[]> = {};
    for (const row of data || []) {
        const c = normalize(row);
        (map[c.student_id] ||= []).push(c);
    }
    return map;
}
