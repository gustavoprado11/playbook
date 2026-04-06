'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import type {
    NutritionConsultation,
    NutritionMealPlan,
    NutritionLabResult,
    PhysioSession,
    PhysioTreatmentPlan,
} from '@/types/database';

export interface IntegratedStudentView {
    nutrition: {
        hasLinkedProfessional: boolean;
        professionalName?: string;
        recentConsultations: NutritionConsultation[];
        activeMealPlans: NutritionMealPlan[];
        recentLabResults: NutritionLabResult[];
        lastConsultationDate?: string;
    };
    physio: {
        hasLinkedProfessional: boolean;
        professionalName?: string;
        recentSessions: PhysioSession[];
        activeTreatmentPlans: PhysioTreatmentPlan[];
        lastSessionDate?: string;
    };
    timeline: TimelineEvent[];
}

export interface TimelineEvent {
    id: string;
    date: string;
    type: 'assessment' | 'nutrition_consultation' | 'physio_session' | 'meal_plan' | 'treatment_plan' | 'status_change' | 'lab_result';
    title: string;
    description?: string;
    professional?: string;
    discipline: 'training' | 'nutrition' | 'physiotherapy' | 'admin';
}

export async function getStudentIntegratedView(studentId: string): Promise<IntegratedStudentView | null> {
    const profile = await getProfile();
    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        return null;
    }

    const admin = createAdminClient();

    // Fetch all linked professionals for this student
    const { data: links } = await admin
        .from('student_professionals')
        .select(`
            professional:professionals!professional_id(
                id, profession_type,
                profile:profiles!profile_id(full_name)
            )
        `)
        .eq('student_id', studentId)
        .eq('status', 'active');

    // Normalize: Supabase may return professional as array or object
    const normalizedLinks = (links || []).map((l: any) => {
        const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
        const profProfile = prof?.profile;
        const profileObj = Array.isArray(profProfile) ? profProfile[0] : profProfile;
        return {
            professional: prof ? { ...prof, profile: profileObj } : null,
        };
    });

    const nutritionistLink = normalizedLinks.find(
        (l) => l.professional?.profession_type === 'nutritionist'
    );
    const physioLink = normalizedLinks.find(
        (l) => l.professional?.profession_type === 'physiotherapist'
    );

    const nutritionistId = nutritionistLink?.professional?.id;
    const physioId = physioLink?.professional?.id;

    // Parallel fetch
    const [
        consultationsResult,
        mealPlansResult,
        labResultsResult,
        sessionsResult,
        treatmentPlansResult,
        assessmentsResult,
        eventsResult,
    ] = await Promise.all([
        nutritionistId
            ? admin
                .from('nutrition_consultations')
                .select('*')
                .eq('student_id', studentId)
                .order('consultation_date', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] }),

        nutritionistId
            ? admin
                .from('nutrition_meal_plans')
                .select('*')
                .eq('student_id', studentId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),

        nutritionistId
            ? admin
                .from('nutrition_lab_results')
                .select('*')
                .eq('student_id', studentId)
                .order('exam_date', { ascending: false })
                .limit(3)
            : Promise.resolve({ data: [] }),

        physioId
            ? admin
                .from('physio_sessions')
                .select('*')
                .eq('student_id', studentId)
                .order('session_date', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] }),

        physioId
            ? admin
                .from('physio_treatment_plans')
                .select('*')
                .eq('student_id', studentId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),

        admin
            .from('student_assessments')
            .select('*')
            .eq('student_id', studentId)
            .order('performed_at', { ascending: false })
            .limit(5),

        admin
            .from('student_events')
            .select('*')
            .eq('student_id', studentId)
            .order('event_date', { ascending: false })
            .limit(10),
    ]);

    const consultations = (consultationsResult.data || []) as NutritionConsultation[];
    const mealPlans = (mealPlansResult.data || []) as NutritionMealPlan[];
    const labResults = (labResultsResult.data || []) as NutritionLabResult[];
    const sessions = (sessionsResult.data || []) as PhysioSession[];
    const treatmentPlans = (treatmentPlansResult.data || []) as PhysioTreatmentPlan[];
    const assessments = assessmentsResult.data || [];
    const events = eventsResult.data || [];

    // Build unified timeline
    const timeline: TimelineEvent[] = [];

    assessments.forEach((a: any) => {
        timeline.push({
            id: a.id,
            date: a.performed_at,
            type: 'assessment',
            title: 'Avaliação Física',
            description: 'Protocolo registrado',
            discipline: 'training',
        });
    });

    consultations.forEach((c) => {
        timeline.push({
            id: c.id,
            date: c.consultation_date,
            type: 'nutrition_consultation',
            title: 'Consulta Nutricional',
            description: c.chief_complaint || undefined,
            professional: nutritionistLink?.professional?.profile?.full_name,
            discipline: 'nutrition',
        });
    });

    sessions.forEach((s) => {
        timeline.push({
            id: s.id,
            date: s.session_date,
            type: 'physio_session',
            title: 'Sessão de Fisioterapia',
            description: s.clinical_notes || undefined,
            professional: physioLink?.professional?.profile?.full_name,
            discipline: 'physiotherapy',
        });
    });

    mealPlans.forEach((p) => {
        timeline.push({
            id: p.id,
            date: p.start_date || p.created_at,
            type: 'meal_plan',
            title: `Plano Alimentar: ${p.title}`,
            professional: nutritionistLink?.professional?.profile?.full_name,
            discipline: 'nutrition',
        });
    });

    labResults.forEach((r) => {
        timeline.push({
            id: r.id,
            date: r.exam_date,
            type: 'lab_result',
            title: `Exame: ${r.exam_type}`,
            discipline: 'nutrition',
        });
    });

    events.forEach((e: any) => {
        if (e.event_type === 'status_change') {
            timeline.push({
                id: e.id,
                date: e.event_date,
                type: 'status_change',
                title: `Status: ${e.old_value?.status} → ${e.new_value?.status}`,
                discipline: 'admin',
            });
        }
    });

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        nutrition: {
            hasLinkedProfessional: !!nutritionistId,
            professionalName: nutritionistLink?.professional?.profile?.full_name,
            recentConsultations: consultations,
            activeMealPlans: mealPlans,
            recentLabResults: labResults,
            lastConsultationDate: consultations[0]?.consultation_date,
        },
        physio: {
            hasLinkedProfessional: !!physioId,
            professionalName: physioLink?.professional?.profile?.full_name,
            recentSessions: sessions,
            activeTreatmentPlans: treatmentPlans,
            lastSessionDate: sessions[0]?.session_date,
        },
        timeline,
    };
}
