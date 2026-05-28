'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StudentSharedNote, SharedNoteCategory } from '@/types/database';

export async function getSharedNotes(studentId: string): Promise<StudentSharedNote[]> {
    const admin = createAdminClient();
    const { data } = await admin
        .from('student_shared_notes')
        .select(`
            *,
            author_professional:professionals!author_professional_id(profession_type),
            author_profile:profiles!author_profile_id(full_name, role, profession_type)
        `)
        .eq('student_id', studentId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    return (data || []).map((n: Record<string, any>) => ({
        ...n,
        author: {
            full_name: n.author_profile?.full_name ?? 'Profissional',
            profession_type: n.author_profile?.profession_type ?? n.author_professional?.profession_type ?? null,
            role: n.author_profile?.role ?? 'professional',
        },
    })) as StudentSharedNote[];
}

export async function createSharedNote(input: {
    studentId: string;
    body: string;
    category?: SharedNoteCategory;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    const { data: pro } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

    const { error } = await supabase.from('student_shared_notes').insert({
        student_id: input.studentId,
        author_profile_id: user.id,
        author_professional_id: pro?.id ?? null,
        body: input.body,
        category: input.category ?? 'general',
    });

    if (error) return { error: 'Não foi possível salvar a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function togglePinSharedNote(noteId: string, isPinned: boolean) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('student_shared_notes')
        .update({ is_pinned: isPinned })
        .eq('id', noteId);
    if (error) return { error: 'Não foi possível fixar a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteSharedNote(noteId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('student_shared_notes').delete().eq('id', noteId);
    if (error) return { error: 'Não foi possível excluir a nota.' };
    revalidatePath('/dashboard');
    return { success: true };
}
