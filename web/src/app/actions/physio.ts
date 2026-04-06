'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    CreatePhysioSessionInput,
    CreateTreatmentPlanInput,
    PhysioTreatmentStatus,
} from '@/types/database';

async function checkPhysioAuth() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('profession_type', 'physiotherapist')
        .eq('is_active', true)
        .single();

    if (!professional) return null;
    return { supabase, user, professionalId: professional.id };
}

// === PACIENTES ===

export async function listMyPhysioPatients() {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    const { data, error } = await supabase
        .from('student_professionals')
        .select(`
            *,
            student:students!student_id(*)
        `)
        .eq('professional_id', professionalId)
        .eq('status', 'active')
        .order('started_at', { ascending: false });

    if (error) {
        console.error('Error listing patients:', error);
        return { error: 'Erro ao listar pacientes', data: null };
    }

    return { data, error: null };
}

// === SESSÕES ===

export async function listPhysioSessions(studentId?: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    let query = supabase
        .from('physio_sessions')
        .select(`
            *,
            student:students!student_id(id, full_name)
        `)
        .eq('professional_id', professionalId)
        .order('session_date', { ascending: false });

    if (studentId) {
        query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing sessions:', error);
        return { error: 'Erro ao listar sessões', data: null };
    }

    return { data, error: null };
}

export async function getPhysioSession(sessionId: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase } = auth;

    const { data: session, error } = await supabase
        .from('physio_sessions')
        .select(`
            *,
            student:students!student_id(id, full_name),
            anamnesis:physio_anamnesis(*),
            metrics:physio_metrics(*),
            evolution:physio_session_evolution(*)
        `)
        .eq('id', sessionId)
        .single();

    if (error) {
        console.error('Error fetching session:', error);
        return { error: 'Erro ao buscar sessão', data: null };
    }

    return { data: session, error: null };
}

export async function createPhysioSession(input: CreatePhysioSessionInput) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    // Create session
    const { data: session, error: sessionError } = await supabase
        .from('physio_sessions')
        .insert({
            student_id: input.student_id,
            professional_id: professionalId,
            session_date: input.session_date || new Date().toISOString(),
            session_type: input.session_type,
            clinical_notes: input.clinical_notes || null,
        })
        .select()
        .single();

    if (sessionError || !session) {
        console.error('Error creating session:', sessionError);
        return { error: 'Erro ao criar sessão', data: null };
    }

    // Create anamnesis if provided (typically for initial_assessment)
    if (input.anamnesis) {
        const { error } = await supabase
            .from('physio_anamnesis')
            .insert({
                session_id: session.id,
                ...input.anamnesis,
            });

        if (error) console.error('Error creating anamnesis:', error);
    }

    // Create metrics if provided
    if (input.metrics && input.metrics.length > 0) {
        const metricsData = input.metrics.map(m => ({
            session_id: session.id,
            ...m,
        }));

        const { error } = await supabase
            .from('physio_metrics')
            .insert(metricsData);

        if (error) console.error('Error creating metrics:', error);
    }

    // Create evolution if provided
    if (input.evolution) {
        const { error } = await supabase
            .from('physio_session_evolution')
            .insert({
                session_id: session.id,
                ...input.evolution,
            });

        if (error) console.error('Error creating evolution:', error);
    }

    revalidatePath('/dashboard/physiotherapist/patients');
    revalidatePath(`/dashboard/physiotherapist/patients/${input.student_id}`);
    revalidatePath('/dashboard/physiotherapist/sessions');

    return { data: session, error: null };
}

export async function updatePhysioSession(sessionId: string, input: Partial<CreatePhysioSessionInput>) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    // Update session fields
    const sessionUpdate: Record<string, unknown> = {};
    if (input.session_date) sessionUpdate.session_date = input.session_date;
    if (input.session_type) sessionUpdate.session_type = input.session_type;
    if (input.clinical_notes !== undefined) sessionUpdate.clinical_notes = input.clinical_notes;

    if (Object.keys(sessionUpdate).length > 0) {
        const { error } = await supabase
            .from('physio_sessions')
            .update(sessionUpdate)
            .eq('id', sessionId);

        if (error) {
            console.error('Error updating session:', error);
            return { error: 'Erro ao atualizar sessão' };
        }
    }

    // Upsert anamnesis
    if (input.anamnesis) {
        const { error } = await supabase
            .from('physio_anamnesis')
            .upsert({
                session_id: sessionId,
                ...input.anamnesis,
            }, { onConflict: 'session_id' });

        if (error) console.error('Error upserting anamnesis:', error);
    }

    // Replace metrics (delete and re-insert)
    if (input.metrics) {
        await supabase
            .from('physio_metrics')
            .delete()
            .eq('session_id', sessionId);

        if (input.metrics.length > 0) {
            const metricsData = input.metrics.map(m => ({
                session_id: sessionId,
                ...m,
            }));
            const { error } = await supabase
                .from('physio_metrics')
                .insert(metricsData);

            if (error) console.error('Error inserting metrics:', error);
        }
    }

    // Upsert evolution
    if (input.evolution) {
        const { error } = await supabase
            .from('physio_session_evolution')
            .upsert({
                session_id: sessionId,
                ...input.evolution,
            }, { onConflict: 'session_id' });

        if (error) console.error('Error upserting evolution:', error);
    }

    revalidatePath('/dashboard/physiotherapist');
    return { success: true };
}

export async function deletePhysioSession(sessionId: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('physio_sessions')
        .delete()
        .eq('id', sessionId);

    if (error) {
        console.error('Error deleting session:', error);
        return { error: 'Erro ao excluir sessão' };
    }

    revalidatePath('/dashboard/physiotherapist');
    return { success: true };
}

// === PROTOCOLOS DE TRATAMENTO ===

export async function listTreatmentPlans(studentId?: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    let query = supabase
        .from('physio_treatment_plans')
        .select(`
            *,
            student:students!student_id(id, full_name)
        `)
        .eq('professional_id', professionalId)
        .order('created_at', { ascending: false });

    if (studentId) {
        query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing treatment plans:', error);
        return { error: 'Erro ao listar protocolos', data: null };
    }

    return { data, error: null };
}

export async function createTreatmentPlan(input: CreateTreatmentPlanInput) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    const { data, error } = await supabase
        .from('physio_treatment_plans')
        .insert({
            student_id: input.student_id,
            professional_id: professionalId,
            diagnosis: input.diagnosis,
            objectives: input.objectives,
            contraindications: input.contraindications || [],
            estimated_sessions: input.estimated_sessions || null,
            frequency: input.frequency || null,
            start_date: input.start_date,
            end_date: input.end_date || null,
            exercises: input.exercises || [],
            modalities: input.modalities || [],
            notes: input.notes || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating treatment plan:', error);
        return { error: 'Erro ao criar protocolo', data: null };
    }

    revalidatePath('/dashboard/physiotherapist/treatment-plans');
    revalidatePath(`/dashboard/physiotherapist/patients/${input.student_id}`);

    return { data, error: null };
}

export async function updateTreatmentPlan(
    planId: string,
    input: Partial<CreateTreatmentPlanInput & { status: PhysioTreatmentStatus }>
) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('physio_treatment_plans')
        .update(input)
        .eq('id', planId);

    if (error) {
        console.error('Error updating treatment plan:', error);
        return { error: 'Erro ao atualizar protocolo' };
    }

    revalidatePath('/dashboard/physiotherapist');
    return { success: true };
}

export async function completeTreatmentPlan(planId: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('physio_treatment_plans')
        .update({
            status: 'completed',
            end_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', planId);

    if (error) {
        console.error('Error completing treatment plan:', error);
        return { error: 'Erro ao concluir protocolo' };
    }

    revalidatePath('/dashboard/physiotherapist');
    return { success: true };
}

// === ANEXOS ===

export async function deletePhysioAttachment(attachmentId: string) {
    const auth = await checkPhysioAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    // Get file path before deleting
    const { data: attachment } = await supabase
        .from('physio_attachments')
        .select('file_path')
        .eq('id', attachmentId)
        .single();

    if (attachment?.file_path) {
        await supabase.storage.from('physio-attachments').remove([attachment.file_path]);
    }

    const { error } = await supabase
        .from('physio_attachments')
        .delete()
        .eq('id', attachmentId);

    if (error) {
        console.error('Error deleting attachment:', error);
        return { error: 'Erro ao excluir anexo' };
    }

    revalidatePath('/dashboard/physiotherapist');
    return { success: true };
}
