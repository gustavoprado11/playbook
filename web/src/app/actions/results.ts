'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
    CreateProtocolInput,
    CreateAssessmentInput,
    AssessmentProtocol,
    StudentAssessment
} from '@/types/database';

// Helper: Ensure user is authenticated
async function checkAuth() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error('Unauthorized');
    }
    return { supabase, user };
}

// ==========================================
// PROTOCOL ACTIONS
// ==========================================

export async function createProtocol(input: CreateProtocolInput) {
    const { supabase, user } = await checkAuth();

    // Verify manager role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'manager') {
        throw new Error('Only managers can create protocols');
    }

    // 1. Create Protocol
    const { data: protocol, error: protocolError } = await supabase
        .from('assessment_protocols')
        .insert({
            name: input.name,
            pillar: input.pillar,
            description: input.description,
            created_by: user.id
        })
        .select()
        .single();

    if (protocolError) {
        console.error('Error creating protocol:', protocolError);
        throw new Error('Failed to create protocol');
    }

    // 2. Create Metrics (if any)
    if (input.metrics.length > 0) {
        const metricsToInsert = input.metrics.map((m, index) => ({
            protocol_id: protocol.id, // Using the ID from the created protocol
            name: m.name,
            unit: m.unit,
            display_order: index,
            is_required: m.is_required
        }));

        const { error: metricsError } = await supabase
            .from('protocol_metrics')
            .insert(metricsToInsert);

        if (metricsError) {
            console.error('Error creating metrics:', metricsError);
            // Ideally rollback protocol here, but Supabase doesn't support multi-table transactions via client properly without explicit RPC.
            // For now we assume integrity. Logic for cleaner rollback could be a stored procedure.
            throw new Error('Failed to create protocol metrics');
        }
    }

    revalidatePath('/dashboard/manager/results');
    return protocol as AssessmentProtocol;
}

export async function getProtocols() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('assessment_protocols')
        .select(`
            *,
            metrics:protocol_metrics(*)
        `)
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('Error fetching protocols:', error);
        return [];
    }

    // Sort metrics by display_order
    const protocols = data.map(p => ({
        ...p,
        metrics: p.metrics?.sort((a: any, b: any) => a.display_order - b.display_order)
    }));

    return protocols as AssessmentProtocol[];
}

import type { UpdateProtocolInput } from '@/types/database';

export async function deleteProtocol(protocolId: string) {
    const { supabase, user } = await checkAuth();

    // Verify manager
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'manager') {
        throw new Error('Only managers can delete protocols');
    }

    // Soft delete
    const { error } = await supabase
        .from('assessment_protocols')
        .update({ is_active: false })
        .eq('id', protocolId);

    if (error) {
        console.error('Error deleting protocol:', error);
        throw new Error('Failed to delete protocol');
    }

    revalidatePath('/dashboard/manager/results');
}

export async function updateProtocol(input: UpdateProtocolInput) {
    const { supabase, user } = await checkAuth();

    // Verify manager
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'manager') {
        throw new Error('Only managers can update protocols');
    }

    // 1. Update Protocol Fields
    const { error: protocolError } = await supabase
        .from('assessment_protocols')
        .update({
            name: input.name,
            pillar: input.pillar,
            description: input.description
        })
        .eq('id', input.id);

    if (protocolError) {
        console.error('Error updating protocol:', protocolError);
        throw new Error('Failed to update protocol');
    }

    // 2. Handle Metrics
    // We need to handle: New (no ID), Update (ID), Archive (is_active=false)

    for (const [index, metric] of input.metrics.entries()) {
        if (metric.id) {
            // Existing Metric

            // Check if unit is changing and if results exist
            if (metric.is_active !== false) { // Skip check if archiving
                const { data: existingMetric } = await supabase
                    .from('protocol_metrics')
                    .select('unit')
                    .eq('id', metric.id)
                    .single();

                if (existingMetric && existingMetric.unit !== metric.unit) {
                    // Check for results
                    const { count } = await supabase
                        .from('assessment_results')
                        .select('id', { count: 'exact', head: true })
                        .eq('metric_id', metric.id);

                    if (count && count > 0) {
                        // For safety, we silently ignore unit change or throw. 
                        // Let's keep the old unit but update other fields to prevent data corruption.
                        // Or better, we just don't include unit in the update if it changed.
                        // But for simplicity/strictness, let's allow it but warn the user in UI. 
                        // Here we will enforce: CANNOT change unit if results exist.
                        // Actually, let's just use the OLD unit if it exists.
                        metric.unit = existingMetric.unit;
                    }
                }
            }

            const { error: metricError } = await supabase
                .from('protocol_metrics')
                .update({
                    name: metric.name,
                    unit: metric.unit,
                    display_order: index,
                    is_required: metric.is_required,
                    is_active: metric.is_active ?? true // Default to true if undefined
                })
                .eq('id', metric.id);

            if (metricError) console.error('Error updating metric:', metricError);

        } else {
            // New Metric
            const { error: newMetricError } = await supabase
                .from('protocol_metrics')
                .insert({
                    protocol_id: input.id,
                    name: metric.name,
                    unit: metric.unit,
                    display_order: index,
                    is_required: metric.is_required,
                    is_active: true
                });

            if (newMetricError) console.error('Error creating new metric:', newMetricError);
        }
    }

    revalidatePath('/dashboard/manager/results');
}

// ==========================================
// ASSESSMENT ACTIONS
// ==========================================

export async function createAssessment(input: CreateAssessmentInput) {
    const { supabase, user } = await checkAuth();

    // 1. Create Assessment Instance
    const { data: assessment, error: assessmentError } = await supabase
        .from('student_assessments')
        .insert({
            student_id: input.student_id,
            protocol_id: input.protocol_id,
            performed_at: input.performed_at,
            notes: input.notes,
            created_by: user.id
        })
        .select()
        .single();

    if (assessmentError) {
        console.error('Error creating assessment:', assessmentError);
        if (assessmentError.code === '42501') {
            throw new Error('Permission denied. You can only record assessments for your own students.');
        }
        throw new Error('Failed to create assessment');
    }

    // 2. Create Results
    if (input.results.length > 0) {
        const resultsToInsert = input.results.map(r => ({
            assessment_id: assessment.id,
            metric_id: r.metric_id,
            value: r.value
        }));

        const { error: resultsError } = await supabase
            .from('assessment_results')
            .insert(resultsToInsert);

        if (resultsError) {
            console.error('Error recording results:', resultsError);
            throw new Error('Failed to record assessment results');
        }
    }

    revalidatePath(`/dashboard/trainer/students/${input.student_id}`);
    revalidatePath('/dashboard/trainer/students');
    revalidatePath('/dashboard/trainer'); // Update KPIs
    revalidatePath('/dashboard/manager/students');
    return assessment as StudentAssessment;
}

export async function updateAssessment(input: CreateAssessmentInput & { assessment_id: string }) {
    const { supabase } = await checkAuth();

    const { error: assessmentError } = await supabase
        .from('student_assessments')
        .update({
            performed_at: input.performed_at,
            notes: input.notes,
        })
        .eq('id', input.assessment_id)
        .eq('student_id', input.student_id);

    if (assessmentError) {
        console.error('Error updating assessment:', assessmentError);
        if (assessmentError.code === '42501') {
            throw new Error('Você só pode editar avaliações dos seus próprios alunos.');
        }
        throw new Error('Falha ao atualizar avaliação');
    }

    const { error: deleteResultsError } = await supabase
        .from('assessment_results')
        .delete()
        .eq('assessment_id', input.assessment_id);

    if (deleteResultsError) {
        console.error('Error clearing assessment results:', deleteResultsError);
        throw new Error('Falha ao atualizar os resultados da avaliação');
    }

    if (input.results.length > 0) {
        const { error: insertResultsError } = await supabase
            .from('assessment_results')
            .insert(input.results.map((result) => ({
                assessment_id: input.assessment_id,
                metric_id: result.metric_id,
                value: result.value,
            })));

        if (insertResultsError) {
            console.error('Error re-inserting assessment results:', insertResultsError);
            throw new Error('Falha ao salvar os novos resultados da avaliação');
        }
    }

    revalidatePath(`/dashboard/trainer/students/${input.student_id}`);
    revalidatePath('/dashboard/trainer/students');
    revalidatePath('/dashboard/trainer');
    revalidatePath('/dashboard/manager/students');
}

export async function deleteAssessment(studentId: string, assessmentId: string) {
    const { supabase } = await checkAuth();

    const { error } = await supabase
        .from('student_assessments')
        .delete()
        .eq('id', assessmentId)
        .eq('student_id', studentId);

    if (error) {
        console.error('Error deleting assessment:', error);
        if (error.code === '42501') {
            throw new Error('Você só pode excluir avaliações dos seus próprios alunos.');
        }
        throw new Error('Falha ao excluir avaliação');
    }

    revalidatePath(`/dashboard/trainer/students/${studentId}`);
    revalidatePath('/dashboard/trainer/students');
    revalidatePath('/dashboard/trainer');
    revalidatePath('/dashboard/manager/students');
}

export async function getStudentAssessments(studentId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('student_assessments')
        .select(`
            *,
            protocol:assessment_protocols(*, metrics:protocol_metrics(*)),
            results:assessment_results(*, metric:protocol_metrics(*)),
            creator:profiles(full_name)
        `)
        .eq('student_id', studentId)
        .order('performed_at', { ascending: false });

    if (error) {
        console.error('Error fetching assessments:', error);
        return [];
    }

    return data as StudentAssessment[];
}
