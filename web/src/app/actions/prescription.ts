'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    Exercise,
    MovementPattern,
    BlockCategory,
    CreateExerciseInput,
    UpdateExerciseInput,
} from '@/types/database';

// Helper: ensure user is authenticated
async function checkAuth() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        throw new Error('Unauthorized');
    }
    return { supabase, user };
}

// Helper: role gate (manager or trainer)
async function assertTrainerOrManager(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        throw new Error('Only managers and trainers can manage exercises');
    }
}

// ==========================================
// CATALOG READS
// ==========================================

// Catálogo (studio-global): lista ATIVOS (RLS deixa todos autenticados lerem ativos).
export async function getExercises(): Promise<Exercise[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('getExercises', error);
        return [];
    }
    return (data ?? []) as Exercise[];
}

// Taxonomia p/ popular os selects do formulário.
export async function getCatalogTaxonomy(): Promise<{
    patterns: MovementPattern[];
    categories: BlockCategory[];
}> {
    const { supabase } = await checkAuth();
    const [p, c] = await Promise.all([
        supabase.from('movement_patterns').select('*').eq('is_active', true).order('display_order'),
        supabase.from('block_categories').select('*').eq('is_active', true).order('display_order'),
    ]);
    return {
        patterns: (p.data ?? []) as MovementPattern[],
        categories: (c.data ?? []) as BlockCategory[],
    };
}

// ==========================================
// CATALOG MUTATIONS
// ==========================================

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    const name = input.name?.trim();
    if (!name) throw new Error('Nome do exercício é obrigatório');

    const { data, error } = await supabase
        .from('exercises')
        .insert({
            name,
            movement_pattern_key: input.movement_pattern_key ?? null,
            default_category_key: input.default_category_key ?? null,
            primary_muscles: input.primary_muscles ?? [],
            secondary_muscles: input.secondary_muscles ?? [],
            equipment: input.equipment ?? null,
            difficulty: input.difficulty ?? null,
            video_url: input.video_url ?? null,
            cues: input.cues ?? null,
            created_by: user.id, // = auth.uid(); satisfaz RLS exercises_insert
        })
        .select()
        .single();

    if (error) {
        console.error('createExercise', error);
        throw new Error('Falha ao criar exercício');
    }

    revalidatePath('/dashboard/trainer/prescricao/exercicios');
    return data as Exercise;
}

export async function updateExercise(input: UpdateExerciseInput): Promise<Exercise> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    const name = input.name?.trim();
    if (!name) throw new Error('Nome do exercício é obrigatório');

    // RLS só deixa dono (created_by) ou manager atualizar → não precisa re-checar posse aqui;
    // se a linha não for editável pelo usuário, o update afeta 0 linhas.
    const { data, error } = await supabase
        .from('exercises')
        .update({
            name,
            movement_pattern_key: input.movement_pattern_key ?? null,
            default_category_key: input.default_category_key ?? null,
            primary_muscles: input.primary_muscles ?? [],
            secondary_muscles: input.secondary_muscles ?? [],
            equipment: input.equipment ?? null,
            difficulty: input.difficulty ?? null,
            video_url: input.video_url ?? null,
            cues: input.cues ?? null,
        })
        .eq('id', input.id)
        .select()
        .single();

    if (error) {
        console.error('updateExercise', error);
        throw new Error('Falha ao atualizar exercício');
    }

    revalidatePath('/dashboard/trainer/prescricao/exercicios');
    return data as Exercise;
}

export async function archiveExercise(id: string): Promise<void> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    const { error } = await supabase
        .from('exercises')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        console.error('archiveExercise', error);
        throw new Error('Falha ao arquivar exercício');
    }

    revalidatePath('/dashboard/trainer/prescricao/exercicios');
}
