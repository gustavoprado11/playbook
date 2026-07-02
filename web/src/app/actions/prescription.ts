'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    Exercise,
    MovementPattern,
    BlockCategory,
    TrainingMethod,
    CreateExerciseInput,
    UpdateExerciseInput,
    ProgramTemplate,
    ProgramTemplateTree,
    ProgramTreeInput,
    PrescribableStudent,
    AssignedProgram,
    AssignedProgramTree,
    AssignedProgramTreeInput,
    AssignedSessionInput,
    AssignedBlockInput,
    AssignedItemInput,
    WorkoutLog,
    WorkoutLogTree,
    WorkoutLogInput,
    SetLogInput,
    StudentSessionForLog,
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

// Métodos de treino p/ o select do builder (preset referenciado por item.method_key).
export async function getTrainingMethods(): Promise<TrainingMethod[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('training_methods')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
    if (error) {
        console.error('getTrainingMethods', error);
        return [];
    }
    return (data ?? []) as TrainingMethod[];
}

// ==========================================
// PROGRAM TEMPLATES (A2)
// ==========================================

export async function listProgramTemplates(): Promise<ProgramTemplate[]> {
    const { supabase } = await checkAuth();
    // RLS já filtra p/ dono/manager.
    const { data, error } = await supabase
        .from('program_templates')
        .select('*, sessions:session_templates(id)')
        .eq('is_active', true)
        .order('name');
    if (error) {
        console.error('listProgramTemplates', error);
        return [];
    }
    return (data ?? []) as ProgramTemplate[];
}

export async function getProgramTemplate(id: string): Promise<ProgramTemplateTree | null> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('program_templates')
        .select(`
            *,
            sessions:session_templates(
                *,
                blocks:block_templates(
                    *,
                    items:item_templates(
                        *,
                        sets:set_templates(*)
                    )
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        if (error && error.code !== 'PGRST116') console.error('getProgramTemplate', error);
        return null;
    }

    // Ordena a árvore em JS (order_index / set_number) — mais robusto que .order aninhado.
    const tree = data as ProgramTemplateTree;
    tree.sessions = (tree.sessions ?? []).sort((a, b) => a.order_index - b.order_index);
    for (const s of tree.sessions) {
        s.blocks = (s.blocks ?? []).sort((a, b) => a.order_index - b.order_index);
        for (const b of s.blocks) {
            b.items = (b.items ?? []).sort((a, b2) => a.order_index - b2.order_index);
            for (const it of b.items) {
                it.sets = (it.sets ?? []).sort((a, b3) => a.set_number - b3.set_number);
            }
        }
    }
    return tree;
}

export async function saveProgramTree(input: ProgramTreeInput): Promise<string> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    if (!input.name?.trim()) throw new Error('Nome do programa é obrigatório');

    const { data, error } = await supabase.rpc('save_program_tree', { payload: input });
    if (error) {
        console.error('saveProgramTree', error);
        if (error.message?.includes('not owned')) {
            throw new Error('Você não tem permissão para editar este programa');
        }
        throw new Error('Falha ao salvar o programa');
    }

    const programId = data as string;
    revalidatePath('/dashboard/trainer/prescricao/programas');
    revalidatePath(`/dashboard/trainer/prescricao/programas/${programId}`);
    return programId;
}

export async function deleteProgramTemplate(id: string): Promise<void> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    const { error } = await supabase
        .from('program_templates')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        console.error('deleteProgramTemplate', error);
        throw new Error('Falha ao arquivar o programa');
    }

    revalidatePath('/dashboard/trainer/prescricao/programas');
}

// ==========================================
// ASSIGNED PROGRAMS (A3) — instância por aluno
// ==========================================

// Alunos que o treinador pode prescrever (RLS/attends_student já filtra).
export async function getPrescribableStudents(): Promise<PrescribableStudent[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('students')
        .select('id, full_name, status')
        .eq('status', 'active')
        .order('full_name');
    if (error) {
        console.error('getPrescribableStudents', error);
        return [];
    }
    return (data ?? []) as PrescribableStudent[];
}

export async function listStudentAssignments(studentId: string): Promise<AssignedProgram[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('assigned_programs')
        .select('*, sessions:assigned_sessions(id)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('listStudentAssignments', error);
        return [];
    }
    return (data ?? []) as AssignedProgram[];
}

export async function getAssignedProgram(id: string): Promise<AssignedProgramTree | null> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('assigned_programs')
        .select(`
            *,
            sessions:assigned_sessions(
                *,
                blocks:assigned_blocks(
                    *,
                    items:assigned_items(
                        *,
                        sets:assigned_sets(*)
                    )
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        if (error && error.code !== 'PGRST116') console.error('getAssignedProgram', error);
        return null;
    }

    const tree = data as AssignedProgramTree;
    tree.sessions = (tree.sessions ?? []).sort((a, b) => a.order_index - b.order_index);
    for (const s of tree.sessions) {
        s.blocks = (s.blocks ?? []).sort((a, b) => a.order_index - b.order_index);
        for (const b of s.blocks) {
            b.items = (b.items ?? []).sort((a, b2) => a.order_index - b2.order_index);
            for (const it of b.items) {
                it.sets = (it.sets ?? []).sort((a, b3) => a.set_number - b3.set_number);
            }
        }
    }
    return tree;
}

export async function saveAssignedProgramTree(input: AssignedProgramTreeInput): Promise<string> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    if (!input.name?.trim()) throw new Error('Nome do programa é obrigatório');
    if (!input.student_id) throw new Error('Aluno é obrigatório');

    const { data, error } = await supabase.rpc('save_assigned_program_tree', { payload: input });
    if (error) {
        console.error('saveAssignedProgramTree', error);
        if (error.message?.includes('Not allowed')) {
            throw new Error('Você não atende este aluno');
        }
        throw new Error('Falha ao salvar o programa do aluno');
    }

    const assignedId = data as string;
    revalidatePath(`/dashboard/trainer/prescricao/alunos/${input.student_id}`);
    revalidatePath(`/dashboard/trainer/prescricao/alunos/${input.student_id}/${assignedId}`);
    return assignedId;
}

// O coração do A3: copia o template p/ uma instância do aluno, tirando SNAPSHOTS
// dos exercícios do catálogo NESTE momento. Uma RPC atômica.
export async function assignProgramTemplate(templateId: string, studentId: string): Promise<string> {
    const template = await getProgramTemplate(templateId);
    if (!template) throw new Error('Template não encontrado');

    const exercises = await getExercises();
    const exMap = new Map(exercises.map((e) => [e.id, e]));

    const input: AssignedProgramTreeInput = {
        id: null,
        student_id: studentId,
        source_template_id: templateId,
        name: template.name,
        description: template.description,
        goal: template.goal,
        status: 'active',
        sessions: (template.sessions ?? []).map<AssignedSessionInput>((s) => ({
            name: s.name,
            order_index: s.order_index,
            scheduled_days: s.scheduled_days,
            notes: s.notes,
            blocks: (s.blocks ?? []).map<AssignedBlockInput>((b) => ({
                phase: b.phase,
                category_key: b.category_key,
                order_index: b.order_index,
                label: b.label,
                notes: b.notes,
                items: (b.items ?? []).map<AssignedItemInput>((it) => {
                    const ex = it.exercise_id ? exMap.get(it.exercise_id) : undefined;
                    return {
                        exercise_id: it.exercise_id,
                        exercise_name: ex?.name ?? it.custom_name ?? 'Exercício',
                        movement_pattern_key: ex?.movement_pattern_key ?? null,
                        primary_muscles: ex?.primary_muscles ?? [],
                        secondary_muscles: ex?.secondary_muscles ?? [],
                        video_url: ex?.video_url ?? null,
                        cues: ex?.cues ?? null,
                        custom_name: it.custom_name,
                        group_label: it.group_label,
                        order_index: it.order_index,
                        method_key: it.method_key,
                        rounds: it.rounds,
                        notes: it.notes,
                        sets: (it.sets ?? []).map((st) => ({
                            set_number: st.set_number,
                            set_type: st.set_type,
                            reps: st.reps,
                            reps_max: st.reps_max,
                            each_side: st.each_side,
                            load_kg: st.load_kg,
                            rir: st.rir,
                            tempo: st.tempo,
                            rest_seconds: st.rest_seconds,
                            round_number: st.round_number,
                            duration_seconds: st.duration_seconds,
                            distance_m: st.distance_m,
                            target_zone: st.target_zone,
                            notes: st.notes,
                        })),
                    };
                }),
            })),
        })),
    };

    return saveAssignedProgramTree(input);
}

export async function archiveAssignedProgram(id: string, studentId: string): Promise<void> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);

    const { error } = await supabase
        .from('assigned_programs')
        .update({ status: 'archived' })
        .eq('id', id);

    if (error) {
        console.error('archiveAssignedProgram', error);
        throw new Error('Falha ao arquivar o programa do aluno');
    }

    revalidatePath(`/dashboard/trainer/prescricao/alunos/${studentId}`);
}

// ==========================================
// WORKOUT LOGS (A4) — execução coach-facing
// ==========================================

// Sessões atribuídas ativas do aluno (achatadas) p/ o dialog "Registrar execução".
export async function getStudentSessionsForLog(studentId: string): Promise<StudentSessionForLog[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('assigned_programs')
        .select('id, name, status, sessions:assigned_sessions(id, name, order_index)')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('name');
    if (error) {
        console.error('getStudentSessionsForLog', error);
        return [];
    }
    const out: StudentSessionForLog[] = [];
    for (const p of (data ?? []) as any[]) {
        const sessions = [...(p.sessions ?? [])].sort((a, b) => a.order_index - b.order_index);
        for (const s of sessions) {
            out.push({ assigned_program_id: p.id, program_name: p.name, assigned_session_id: s.id, session_name: s.name });
        }
    }
    return out;
}

export async function listWorkoutLogs(studentId: string): Promise<WorkoutLog[]> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('workout_logs')
        .select('*, sets:set_logs(id, completed)')
        .eq('student_id', studentId)
        .order('performed_at', { ascending: false });
    if (error) {
        console.error('listWorkoutLogs', error);
        return [];
    }
    return (data ?? []) as WorkoutLog[];
}

export async function getWorkoutLog(id: string): Promise<WorkoutLogTree | null> {
    const { supabase } = await checkAuth();
    const { data, error } = await supabase
        .from('workout_logs')
        .select('*, sets:set_logs(*)')
        .eq('id', id)
        .single();
    if (error || !data) {
        if (error && error.code !== 'PGRST116') console.error('getWorkoutLog', error);
        return null;
    }
    const tree = data as WorkoutLogTree;
    tree.sets = (tree.sets ?? []).sort((a, b) => a.order_index - b.order_index);
    return tree;
}

export async function saveWorkoutLog(input: WorkoutLogInput): Promise<string> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);
    if (!input.student_id) throw new Error('Aluno é obrigatório');

    const { data, error } = await supabase.rpc('save_workout_log', { payload: input });
    if (error) {
        console.error('saveWorkoutLog', error);
        if (error.message?.includes('Not allowed')) {
            throw new Error('Você não atende este aluno');
        }
        throw new Error('Falha ao salvar o registro de execução');
    }
    const logId = data as string;
    revalidatePath(`/dashboard/trainer/prescricao/alunos/${input.student_id}`);
    revalidatePath(`/dashboard/trainer/prescricao/alunos/${input.student_id}/execucoes/${logId}`);
    return logId;
}

// Cria um log a partir da sessão atribuída (snapshot do prescrito, actuals vazios).
export async function startWorkoutLog(assignedSessionId: string): Promise<string> {
    const { supabase } = await checkAuth();
    const { data: session, error } = await supabase
        .from('assigned_sessions')
        .select(`
            id, name,
            program:assigned_programs(id, student_id),
            blocks:assigned_blocks(
                order_index, phase, category_key,
                items:assigned_items(
                    order_index, exercise_name, group_label,
                    sets:assigned_sets(*)
                )
            )
        `)
        .eq('id', assignedSessionId)
        .single();

    if (error || !session) throw new Error('Sessão não encontrada');
    const s = session as any;
    const program = Array.isArray(s.program) ? s.program[0] : s.program;
    if (!program?.student_id) throw new Error('Programa do aluno não encontrado');

    const blocks = [...(s.blocks ?? [])].sort((a: any, b: any) => a.order_index - b.order_index);
    const sets: SetLogInput[] = [];
    let order = 0;
    for (const b of blocks) {
        const items = [...(b.items ?? [])].sort((a: any, b2: any) => a.order_index - b2.order_index);
        for (const it of items) {
            const itSets = [...(it.sets ?? [])].sort((a: any, b3: any) => (a.set_number ?? 0) - (b3.set_number ?? 0));
            for (const st of itSets) {
                sets.push({
                    assigned_set_id: st.id,
                    exercise_name: it.exercise_name,
                    group_label: it.group_label,
                    phase: b.phase,
                    category_key: b.category_key,
                    set_number: st.set_number,
                    planned_reps: st.reps,
                    planned_reps_max: st.reps_max,
                    planned_load_kg: st.load_kg,
                    planned_duration_seconds: st.duration_seconds,
                    planned_distance_m: st.distance_m,
                    planned_target_zone: st.target_zone,
                    completed: false,
                    order_index: order++,
                });
            }
        }
    }

    return saveWorkoutLog({
        student_id: program.student_id,
        assigned_program_id: program.id,
        assigned_session_id: s.id,
        session_name: s.name,
        sets,
    });
}

export async function deleteWorkoutLog(id: string, studentId: string): Promise<void> {
    const { supabase, user } = await checkAuth();
    await assertTrainerOrManager(supabase, user.id);
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    if (error) {
        console.error('deleteWorkoutLog', error);
        throw new Error('Falha ao excluir o registro');
    }
    revalidatePath(`/dashboard/trainer/prescricao/alunos/${studentId}`);
}
