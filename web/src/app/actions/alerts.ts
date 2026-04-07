'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, getTrainerId } from '@/app/actions/auth';

export interface DashboardAlert {
    id: string;
    severity: 'warning' | 'info';
    title: string;
    description: string;
    category: 'nutrition' | 'physiotherapy' | 'training' | 'admin';
    actionLabel?: string;
    actionHref?: string;
    count?: number;
}

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
    const profile = await getProfile();
    if (!profile) return [];

    switch (profile.role) {
        case 'manager':
            return getManagerAlerts();
        case 'trainer':
            return getTrainerAlerts();
        case 'professional':
            if (profile.profession_type === 'nutritionist') {
                return getNutritionistAlerts(profile.id);
            }
            if (profile.profession_type === 'physiotherapist') {
                return getPhysiotherapistAlerts(profile.id);
            }
            return [];
        default:
            return [];
    }
}

// =====================================================
// MANAGER ALERTS
// =====================================================

async function getManagerAlerts(): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Fetch all active professional links
    const { data: allLinks } = await admin
        .from('student_professionals')
        .select(`
            student_id,
            student:students!student_id(full_name, status),
            professional:professionals!professional_id(profession_type)
        `)
        .eq('status', 'active');

    // Nutrition: students with nutritionist but no recent consultation
    const nutritionistLinks = (allLinks || []).filter(
        (l: any) => {
            const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
            const stu = Array.isArray(l.student) ? l.student[0] : l.student;
            return prof?.profession_type === 'nutritionist' && stu?.status === 'active';
        }
    );

    if (nutritionistLinks.length > 0) {
        const studentIds = nutritionistLinks.map((l: any) => l.student_id);
        const { data: recentConsultations } = await admin
            .from('nutrition_consultations')
            .select('student_id')
            .in('student_id', studentIds)
            .gte('consultation_date', thirtyDaysAgo);

        const studentsWithRecentConsult = new Set(
            (recentConsultations || []).map((c: any) => c.student_id)
        );
        const overdueNutrition = nutritionistLinks.filter(
            (l: any) => !studentsWithRecentConsult.has(l.student_id)
        );

        if (overdueNutrition.length > 0) {
            alerts.push({
                id: 'manager-nutrition-overdue',
                severity: 'warning',
                title: 'Consultas nutricionais atrasadas',
                description: `${overdueNutrition.length} aluno(s) com nutricionista vinculado mas sem consulta nos últimos 30 dias.`,
                category: 'nutrition',
                actionLabel: 'Ver alunos',
                actionHref: '/dashboard/manager/students',
                count: overdueNutrition.length,
            });
        }
    }

    // Physio: students with physiotherapist but no recent session
    const physioLinks = (allLinks || []).filter(
        (l: any) => {
            const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
            const stu = Array.isArray(l.student) ? l.student[0] : l.student;
            return prof?.profession_type === 'physiotherapist' && stu?.status === 'active';
        }
    );

    if (physioLinks.length > 0) {
        const studentIds = physioLinks.map((l: any) => l.student_id);
        const { data: recentSessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .in('student_id', studentIds)
            .gte('session_date', thirtyDaysAgo);

        const studentsWithRecentSession = new Set(
            (recentSessions || []).map((s: any) => s.student_id)
        );
        const overduePhysio = physioLinks.filter(
            (l: any) => !studentsWithRecentSession.has(l.student_id)
        );

        if (overduePhysio.length > 0) {
            alerts.push({
                id: 'manager-physio-overdue',
                severity: 'warning',
                title: 'Sessões de fisioterapia atrasadas',
                description: `${overduePhysio.length} aluno(s) com fisioterapeuta vinculado mas sem sessão nos últimos 30 dias.`,
                category: 'physiotherapy',
                actionLabel: 'Ver alunos',
                actionHref: '/dashboard/manager/students',
                count: overduePhysio.length,
            });
        }
    }

    // Expired meal plans
    const { count: expiredCount } = await admin
        .from('nutrition_meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .lt('end_date', new Date().toISOString().split('T')[0]);

    if (expiredCount && expiredCount > 0) {
        alerts.push({
            id: 'manager-expired-meal-plans',
            severity: 'info',
            title: 'Planos alimentares vencidos',
            description: 'Existem planos alimentares marcados como ativos com data de validade expirada.',
            category: 'nutrition',
        });
    }

    // Orphan students (no trainer)
    const { count: orphanCount } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('is_archived', false)
        .is('trainer_id', null);

    if (orphanCount && orphanCount > 0) {
        alerts.push({
            id: 'manager-orphan-students',
            severity: 'warning',
            title: 'Alunos sem treinador',
            description: `${orphanCount} aluno(s) ativo(s) sem treinador vinculado.`,
            category: 'admin',
            actionLabel: 'Ver alunos',
            actionHref: '/dashboard/manager/students',
            count: orphanCount,
        });
    }

    return alerts;
}

// =====================================================
// TRAINER ALERTS
// =====================================================

async function getTrainerAlerts(): Promise<DashboardAlert[]> {
    const trainerId = await getTrainerId();
    if (!trainerId) return [];

    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Active students
    const { data: students } = await admin
        .from('students')
        .select('id, full_name')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .eq('is_archived', false);

    if (!students || students.length === 0) return alerts;
    const studentIds = students.map((s: any) => s.id);

    // Professional links
    const { data: links } = await admin
        .from('student_professionals')
        .select(`
            student_id,
            professional:professionals!professional_id(profession_type)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active');

    const normalizedLinks = (links || []).map((l: any) => {
        const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
        return { student_id: l.student_id, profession_type: prof?.profession_type };
    });

    // Nutrition overdue
    const nutritionStudentIds = normalizedLinks
        .filter(l => l.profession_type === 'nutritionist')
        .map(l => l.student_id);

    if (nutritionStudentIds.length > 0) {
        const { data: recentConsults } = await admin
            .from('nutrition_consultations')
            .select('student_id')
            .in('student_id', nutritionStudentIds)
            .gte('consultation_date', thirtyDaysAgo);

        const recent = new Set((recentConsults || []).map((c: any) => c.student_id));
        const overdueIds = nutritionStudentIds.filter(id => !recent.has(id));

        if (overdueIds.length > 0) {
            const names = overdueIds
                .map(id => students.find((s: any) => s.id === id)?.full_name)
                .filter(Boolean)
                .slice(0, 3);
            alerts.push({
                id: 'trainer-nutrition-overdue',
                severity: 'info',
                title: 'Alunos sem consulta nutricional recente',
                description: `${names.join(', ')}${overdueIds.length > 3 ? ` e mais ${overdueIds.length - 3}` : ''} — sem consulta há 30+ dias.`,
                category: 'nutrition',
                count: overdueIds.length,
            });
        }
    }

    // Physio overdue
    const physioStudentIds = normalizedLinks
        .filter(l => l.profession_type === 'physiotherapist')
        .map(l => l.student_id);

    if (physioStudentIds.length > 0) {
        const { data: recentSessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .in('student_id', physioStudentIds)
            .gte('session_date', thirtyDaysAgo);

        const recent = new Set((recentSessions || []).map((s: any) => s.student_id));
        const overdueIds = physioStudentIds.filter(id => !recent.has(id));

        if (overdueIds.length > 0) {
            const names = overdueIds
                .map(id => students.find((s: any) => s.id === id)?.full_name)
                .filter(Boolean)
                .slice(0, 3);
            alerts.push({
                id: 'trainer-physio-overdue',
                severity: 'info',
                title: 'Alunos sem sessão de fisioterapia recente',
                description: `${names.join(', ')}${overdueIds.length > 3 ? ` e mais ${overdueIds.length - 3}` : ''} — sem sessão há 30+ dias.`,
                category: 'physiotherapy',
                count: overdueIds.length,
            });
        }
    }

    return alerts;
}

// =====================================================
// NUTRITIONIST ALERTS
// =====================================================

async function getNutritionistAlerts(profileId: string): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];

    const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('profile_id', profileId)
        .eq('profession_type', 'nutritionist')
        .single();

    if (!professional) return alerts;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Active linked patients
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, student:students!student_id(full_name, status)')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    const activeLinks = (links || []).filter((l: any) => {
        const stu = Array.isArray(l.student) ? l.student[0] : l.student;
        return stu?.status === 'active';
    });
    if (activeLinks.length === 0) return alerts;

    const studentIds = activeLinks.map((l: any) => l.student_id);

    // 1. Patients without recent consultation
    const { data: recentConsults } = await admin
        .from('nutrition_consultations')
        .select('student_id')
        .eq('professional_id', professional.id)
        .in('student_id', studentIds)
        .gte('consultation_date', thirtyDaysAgo);

    const recent = new Set((recentConsults || []).map((c: any) => c.student_id));
    const overduePatients = activeLinks.filter((l: any) => !recent.has(l.student_id));

    if (overduePatients.length > 0) {
        const names = overduePatients
            .map((l: any) => {
                const stu = Array.isArray(l.student) ? l.student[0] : l.student;
                return stu?.full_name;
            })
            .filter(Boolean)
            .slice(0, 3);
        alerts.push({
            id: 'nutritionist-overdue-consults',
            severity: 'warning',
            title: 'Pacientes aguardando consulta',
            description: `${names.join(', ')}${overduePatients.length > 3 ? ` e mais ${overduePatients.length - 3}` : ''} — sem consulta nos últimos 30 dias.`,
            category: 'nutrition',
            actionLabel: 'Ver pacientes',
            actionHref: '/dashboard/nutritionist/patients',
            count: overduePatients.length,
        });
    }

    // 2. Meal plans expiring in 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const { data: expiringPlans } = await admin
        .from('nutrition_meal_plans')
        .select('id, title, end_date, student_id')
        .eq('professional_id', professional.id)
        .eq('is_active', true)
        .lte('end_date', sevenDaysFromNow)
        .gte('end_date', today);

    if (expiringPlans && expiringPlans.length > 0) {
        alerts.push({
            id: 'nutritionist-expiring-plans',
            severity: 'info',
            title: 'Planos alimentares vencendo em breve',
            description: `${expiringPlans.length} plano(s) alimentar(es) vencem nos próximos 7 dias.`,
            category: 'nutrition',
            actionLabel: 'Ver planos',
            actionHref: '/dashboard/nutritionist/meal-plans',
            count: expiringPlans.length,
        });
    }

    // 3. Recent labs with abnormal values
    const { data: recentLabs } = await admin
        .from('nutrition_lab_results')
        .select('id, results')
        .in('student_id', studentIds)
        .gte('exam_date', thirtyDaysAgo);

    const abnormalCount = (recentLabs || []).filter((lab: any) => {
        const results = lab.results || {};
        return Object.values(results).some((r: any) => r.status === 'high' || r.status === 'low');
    }).length;

    if (abnormalCount > 0) {
        alerts.push({
            id: 'nutritionist-abnormal-labs',
            severity: 'warning',
            title: 'Exames com valores alterados',
            description: `${abnormalCount} exame(s) recente(s) com valores fora da referência.`,
            category: 'nutrition',
            count: abnormalCount,
        });
    }

    return alerts;
}

// =====================================================
// PHYSIOTHERAPIST ALERTS
// =====================================================

async function getPhysiotherapistAlerts(profileId: string): Promise<DashboardAlert[]> {
    const admin = createAdminClient();
    const alerts: DashboardAlert[] = [];

    const { data: professional } = await admin
        .from('professionals')
        .select('id')
        .eq('profile_id', profileId)
        .eq('profession_type', 'physiotherapist')
        .single();

    if (!professional) return alerts;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    // Active linked patients
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, student:students!student_id(full_name, status)')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    const activeLinks = (links || []).filter((l: any) => {
        const stu = Array.isArray(l.student) ? l.student[0] : l.student;
        return stu?.status === 'active';
    });
    if (activeLinks.length === 0) return alerts;

    const studentIds = activeLinks.map((l: any) => l.student_id);

    // 1. Patients without recent session
    const { data: recentSessions } = await admin
        .from('physio_sessions')
        .select('student_id')
        .eq('professional_id', professional.id)
        .in('student_id', studentIds)
        .gte('session_date', thirtyDaysAgo);

    const recent = new Set((recentSessions || []).map((s: any) => s.student_id));
    const overduePatients = activeLinks.filter((l: any) => !recent.has(l.student_id));

    if (overduePatients.length > 0) {
        const names = overduePatients
            .map((l: any) => {
                const stu = Array.isArray(l.student) ? l.student[0] : l.student;
                return stu?.full_name;
            })
            .filter(Boolean)
            .slice(0, 3);
        alerts.push({
            id: 'physio-overdue-sessions',
            severity: 'warning',
            title: 'Pacientes aguardando sessão',
            description: `${names.join(', ')}${overduePatients.length > 3 ? ` e mais ${overduePatients.length - 3}` : ''} — sem sessão nos últimos 30 dias.`,
            category: 'physiotherapy',
            actionLabel: 'Ver pacientes',
            actionHref: '/dashboard/physiotherapist/patients',
            count: overduePatients.length,
        });
    }

    // 2. Active treatment plans without recent session (14+ days)
    const { data: activePlans } = await admin
        .from('physio_treatment_plans')
        .select('id, student_id')
        .eq('professional_id', professional.id)
        .eq('status', 'active');

    if (activePlans && activePlans.length > 0) {
        const planStudentIds = activePlans.map((p: any) => p.student_id);
        const { data: recentPlanSessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .eq('professional_id', professional.id)
            .in('student_id', planStudentIds)
            .gte('session_date', fourteenDaysAgo);

        const recentPlanSet = new Set((recentPlanSessions || []).map((s: any) => s.student_id));
        const stalePlans = activePlans.filter((p: any) => !recentPlanSet.has(p.student_id));

        if (stalePlans.length > 0) {
            alerts.push({
                id: 'physio-stale-plans',
                severity: 'info',
                title: 'Protocolos sem sessão recente',
                description: `${stalePlans.length} protocolo(s) ativo(s) sem sessão nos últimos 14 dias.`,
                category: 'physiotherapy',
                count: stalePlans.length,
            });
        }
    }

    return alerts;
}
