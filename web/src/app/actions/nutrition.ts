'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    CreateNutritionConsultationInput,
    CreateMealPlanInput,
    CreateLabResultInput,
    NutritionConsultationType,
} from '@/types/database';

async function checkNutritionistAuth() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('profession_type', 'nutritionist')
        .eq('is_active', true)
        .single();

    if (!professional) return null;
    return { supabase, user, professionalId: professional.id };
}

// === PACIENTES ===

export async function listMyPatients() {
    const auth = await checkNutritionistAuth();
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

// === CONSULTAS ===

export async function listNutritionConsultations(studentId?: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    let query = supabase
        .from('nutrition_consultations')
        .select(`
            *,
            student:students!student_id(id, full_name)
        `)
        .eq('professional_id', professionalId)
        .order('consultation_date', { ascending: false });

    if (studentId) {
        query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing consultations:', error);
        return { error: 'Erro ao listar consultas', data: null };
    }

    return { data, error: null };
}

export async function getNutritionConsultation(consultationId: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase } = auth;

    const { data: consultation, error } = await supabase
        .from('nutrition_consultations')
        .select(`
            *,
            student:students!student_id(id, full_name),
            anamnesis:nutrition_anamnesis(*),
            metrics:nutrition_metrics(*)
        `)
        .eq('id', consultationId)
        .single();

    if (error) {
        console.error('Error fetching consultation:', error);
        return { error: 'Erro ao buscar consulta', data: null };
    }

    return { data: consultation, error: null };
}

export async function createNutritionConsultation(input: CreateNutritionConsultationInput) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    // Create consultation
    const { data: consultation, error: consultationError } = await supabase
        .from('nutrition_consultations')
        .insert({
            student_id: input.student_id,
            professional_id: professionalId,
            consultation_date: input.consultation_date || new Date().toISOString(),
            consultation_type: input.consultation_type,
            chief_complaint: input.chief_complaint || null,
            clinical_notes: input.clinical_notes || null,
        })
        .select()
        .single();

    if (consultationError || !consultation) {
        console.error('Error creating consultation:', consultationError);
        return { error: 'Erro ao criar consulta', data: null };
    }

    // Create anamnesis if provided
    if (input.anamnesis) {
        const { error: anamnesisError } = await supabase
            .from('nutrition_anamnesis')
            .insert({
                consultation_id: consultation.id,
                ...input.anamnesis,
            });

        if (anamnesisError) {
            console.error('Error creating anamnesis:', anamnesisError);
        }
    }

    // Create metrics if provided
    if (input.metrics) {
        const { error: metricsError } = await supabase
            .from('nutrition_metrics')
            .insert({
                consultation_id: consultation.id,
                ...input.metrics,
            });

        if (metricsError) {
            console.error('Error creating metrics:', metricsError);
        }
    }

    revalidatePath('/dashboard/nutritionist/patients');
    revalidatePath(`/dashboard/nutritionist/patients/${input.student_id}`);
    revalidatePath('/dashboard/nutritionist/consultations');

    return { data: consultation, error: null };
}

export async function updateNutritionConsultation(
    consultationId: string,
    input: Partial<CreateNutritionConsultationInput>
) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    // Update consultation fields
    const consultationUpdate: Record<string, unknown> = {};
    if (input.consultation_date) consultationUpdate.consultation_date = input.consultation_date;
    if (input.consultation_type) consultationUpdate.consultation_type = input.consultation_type;
    if (input.chief_complaint !== undefined) consultationUpdate.chief_complaint = input.chief_complaint;
    if (input.clinical_notes !== undefined) consultationUpdate.clinical_notes = input.clinical_notes;

    if (Object.keys(consultationUpdate).length > 0) {
        const { error } = await supabase
            .from('nutrition_consultations')
            .update(consultationUpdate)
            .eq('id', consultationId);

        if (error) {
            console.error('Error updating consultation:', error);
            return { error: 'Erro ao atualizar consulta' };
        }
    }

    // Upsert anamnesis
    if (input.anamnesis) {
        const { error } = await supabase
            .from('nutrition_anamnesis')
            .upsert({
                consultation_id: consultationId,
                ...input.anamnesis,
            }, { onConflict: 'consultation_id' });

        if (error) {
            console.error('Error upserting anamnesis:', error);
        }
    }

    // Upsert metrics
    if (input.metrics) {
        const { error } = await supabase
            .from('nutrition_metrics')
            .upsert({
                consultation_id: consultationId,
                ...input.metrics,
            }, { onConflict: 'consultation_id' });

        if (error) {
            console.error('Error upserting metrics:', error);
        }
    }

    revalidatePath('/dashboard/nutritionist');
    return { success: true };
}

export async function deleteNutritionConsultation(consultationId: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('nutrition_consultations')
        .delete()
        .eq('id', consultationId);

    if (error) {
        console.error('Error deleting consultation:', error);
        return { error: 'Erro ao excluir consulta' };
    }

    revalidatePath('/dashboard/nutritionist');
    return { success: true };
}

// === PLANOS ALIMENTARES ===

export async function listMealPlans(studentId?: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    let query = supabase
        .from('nutrition_meal_plans')
        .select(`
            *,
            student:students!student_id(id, full_name)
        `)
        .eq('professional_id', professionalId)
        .order('start_date', { ascending: false });

    if (studentId) {
        query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing meal plans:', error);
        return { error: 'Erro ao listar planos alimentares', data: null };
    }

    return { data, error: null };
}

export async function createMealPlan(input: CreateMealPlanInput) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    // Deactivate previous active plans for this student
    await supabase
        .from('nutrition_meal_plans')
        .update({ is_active: false })
        .eq('student_id', input.student_id)
        .eq('professional_id', professionalId)
        .eq('is_active', true);

    const { data, error } = await supabase
        .from('nutrition_meal_plans')
        .insert({
            student_id: input.student_id,
            professional_id: professionalId,
            title: input.title,
            objective: input.objective || null,
            total_calories: input.total_calories || null,
            protein_g: input.protein_g || null,
            carbs_g: input.carbs_g || null,
            fat_g: input.fat_g || null,
            fiber_g: input.fiber_g || null,
            start_date: input.start_date,
            end_date: input.end_date || null,
            notes: input.notes || null,
            meals: input.meals,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating meal plan:', error);
        return { error: 'Erro ao criar plano alimentar', data: null };
    }

    revalidatePath('/dashboard/nutritionist/meal-plans');
    revalidatePath(`/dashboard/nutritionist/patients/${input.student_id}`);

    return { data, error: null };
}

export async function updateMealPlan(planId: string, input: Partial<CreateMealPlanInput>) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('nutrition_meal_plans')
        .update(input)
        .eq('id', planId);

    if (error) {
        console.error('Error updating meal plan:', error);
        return { error: 'Erro ao atualizar plano alimentar' };
    }

    revalidatePath('/dashboard/nutritionist');
    return { success: true };
}

export async function toggleMealPlanActive(planId: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { data: plan } = await supabase
        .from('nutrition_meal_plans')
        .select('is_active')
        .eq('id', planId)
        .single();

    if (!plan) return { error: 'Plano não encontrado' };

    const { error } = await supabase
        .from('nutrition_meal_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', planId);

    if (error) {
        console.error('Error toggling meal plan:', error);
        return { error: 'Erro ao alterar status do plano' };
    }

    revalidatePath('/dashboard/nutritionist');
    return { success: true };
}

// === EXAMES ===

export async function createLabResult(input: CreateLabResultInput) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase, professionalId } = auth;

    const { data, error } = await supabase
        .from('nutrition_lab_results')
        .insert({
            student_id: input.student_id,
            professional_id: professionalId,
            exam_date: input.exam_date,
            exam_type: input.exam_type,
            results: input.results,
            notes: input.notes || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating lab result:', error);
        return { error: 'Erro ao registrar exame', data: null };
    }

    revalidatePath(`/dashboard/nutritionist/patients/${input.student_id}`);
    return { data, error: null };
}

export async function listLabResults(studentId: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado', data: null };

    const { supabase } = auth;

    const { data, error } = await supabase
        .from('nutrition_lab_results')
        .select('*')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false });

    if (error) {
        console.error('Error listing lab results:', error);
        return { error: 'Erro ao listar exames', data: null };
    }

    return { data, error: null };
}

export async function deleteLabResult(labResultId: string) {
    const auth = await checkNutritionistAuth();
    if (!auth) return { error: 'Não autorizado' };

    const { supabase } = auth;

    const { error } = await supabase
        .from('nutrition_lab_results')
        .delete()
        .eq('id', labResultId);

    if (error) {
        console.error('Error deleting lab result:', error);
        return { error: 'Erro ao excluir exame' };
    }

    revalidatePath('/dashboard/nutritionist');
    return { success: true };
}
