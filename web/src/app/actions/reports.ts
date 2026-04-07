'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';

// ---- TIPOS ----

export interface PerformanceReportRow {
    trainerName: string;
    studentsStart: number;
    studentsEnd: number;
    cancellations: number;
    retentionRate: number;
    retentionTarget: number;
    retentionAchieved: boolean;
    referralsCount: number;
    referralsTarget: number;
    referralsAchieved: boolean;
    managementRate: number;
    managementTarget: number;
    managementAchieved: boolean;
    rewardAmount: number;
    isFinalized: boolean;
}

export interface PerformanceReport {
    referenceMonth: string;
    rows: PerformanceReportRow[];
    totals: {
        avgRetention: number;
        totalReferrals: number;
        avgManagement: number;
        totalRewards: number;
    };
}

export interface StudentMovementRow {
    studentName: string;
    trainerName: string;
    eventType: 'new' | 'cancelled' | 'paused' | 'reactivated' | 'transferred';
    eventDate: string;
    details?: string;
}

export interface StudentMovementReport {
    period: { start: string; end: string };
    rows: StudentMovementRow[];
    summary: {
        newStudents: number;
        cancellations: number;
        paused: number;
        reactivated: number;
        transfers: number;
        netChange: number;
    };
}

export interface ProfessionalActivityRow {
    professionalName: string;
    professionType: 'nutritionist' | 'physiotherapist';
    activePatients: number;
    activitiesThisMonth: number;
    activePlans: number;
    lastActivityDate?: string;
}

export interface ProfessionalActivityReport {
    referenceMonth: string;
    rows: ProfessionalActivityRow[];
}

export interface StudentEvolutionRow {
    date: string;
    discipline: 'training' | 'nutrition' | 'physiotherapy';
    type: string;
    description: string;
    professional?: string;
}

export interface StudentEvolutionReport {
    studentName: string;
    trainerName: string;
    period: { start: string; end: string };
    rows: StudentEvolutionRow[];
    linkedProfessionals: { name: string; type: string }[];
}

// ---- ACTIONS ----

export async function getPerformanceReport(referenceMonth: string): Promise<PerformanceReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    const { data: snapshots } = await admin
        .from('performance_snapshots')
        .select('*, trainer:trainers!trainer_id(*, profile:profiles!profile_id(full_name))')
        .eq('reference_month', referenceMonth)
        .order('created_at');

    if (!snapshots || snapshots.length === 0) return null;

    const rows: PerformanceReportRow[] = snapshots.map((s: any) => {
        const trainerProfile = Array.isArray(s.trainer?.profile) ? s.trainer.profile[0] : s.trainer?.profile;
        return {
            trainerName: trainerProfile?.full_name || 'Desconhecido',
            studentsStart: s.students_start,
            studentsEnd: s.students_end,
            cancellations: s.cancellations,
            retentionRate: Number(s.retention_rate),
            retentionTarget: Number(s.retention_target),
            retentionAchieved: s.retention_achieved,
            referralsCount: s.referrals_count,
            referralsTarget: s.referrals_target,
            referralsAchieved: s.referrals_achieved,
            managementRate: Number(s.management_rate),
            managementTarget: Number(s.management_target),
            managementAchieved: s.management_achieved,
            rewardAmount: Number(s.reward_amount),
            isFinalized: s.is_finalized,
        };
    });

    const eligible = rows.filter(r => r.studentsStart >= 5);
    const totals = {
        avgRetention: eligible.length > 0
            ? eligible.reduce((sum, r) => sum + r.retentionRate, 0) / eligible.length
            : 0,
        totalReferrals: rows.reduce((sum, r) => sum + r.referralsCount, 0),
        avgManagement: rows.length > 0
            ? rows.reduce((sum, r) => sum + r.managementRate, 0) / rows.length
            : 0,
        totalRewards: rows.reduce((sum, r) => sum + r.rewardAmount, 0),
    };

    return { referenceMonth, rows, totals };
}

export async function getStudentMovementReport(
    startDate: string,
    endDate: string
): Promise<StudentMovementReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    const [eventsResult, newStudentsResult] = await Promise.all([
        admin
            .from('student_events')
            .select(`
                *,
                student:students!student_id(
                    full_name,
                    trainer:trainers!students_trainer_id_fkey(
                        profile:profiles!profile_id(full_name)
                    )
                )
            `)
            .gte('event_date', startDate)
            .lte('event_date', endDate)
            .order('event_date', { ascending: false }),
        admin
            .from('students')
            .select('full_name, start_date, trainer:trainers!students_trainer_id_fkey(profile:profiles!profile_id(full_name))')
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .eq('is_archived', false),
    ]);

    const rows: StudentMovementRow[] = [];

    (newStudentsResult.data || []).forEach((s: any) => {
        const trainerProfile = Array.isArray(s.trainer?.profile) ? s.trainer.profile[0] : s.trainer?.profile;
        rows.push({
            studentName: s.full_name,
            trainerName: trainerProfile?.full_name || '-',
            eventType: 'new',
            eventDate: s.start_date,
        });
    });

    (eventsResult.data || []).forEach((e: any) => {
        const studentObj = Array.isArray(e.student) ? e.student[0] : e.student;
        const trainerProfile = Array.isArray(studentObj?.trainer?.profile)
            ? studentObj.trainer.profile[0]
            : studentObj?.trainer?.profile;

        if (e.event_type === 'status_change') {
            const oldStatus = e.old_value?.status;
            const newStatus = e.new_value?.status;
            let eventType: StudentMovementRow['eventType'] = 'cancelled';

            if (newStatus === 'cancelled') eventType = 'cancelled';
            else if (newStatus === 'paused') eventType = 'paused';
            else if (newStatus === 'active' && (oldStatus === 'cancelled' || oldStatus === 'paused')) eventType = 'reactivated';

            rows.push({
                studentName: studentObj?.full_name || '-',
                trainerName: trainerProfile?.full_name || '-',
                eventType,
                eventDate: e.event_date,
                details: `${oldStatus} → ${newStatus}`,
            });
        } else if (e.event_type === 'trainer_change') {
            rows.push({
                studentName: studentObj?.full_name || '-',
                trainerName: trainerProfile?.full_name || '-',
                eventType: 'transferred',
                eventDate: e.event_date,
                details: 'Transferência de treinador',
            });
        }
    });

    rows.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    const summary = {
        newStudents: rows.filter(r => r.eventType === 'new').length,
        cancellations: rows.filter(r => r.eventType === 'cancelled').length,
        paused: rows.filter(r => r.eventType === 'paused').length,
        reactivated: rows.filter(r => r.eventType === 'reactivated').length,
        transfers: rows.filter(r => r.eventType === 'transferred').length,
        netChange: 0,
    };
    summary.netChange = summary.newStudents + summary.reactivated - summary.cancellations;

    return { period: { start: startDate, end: endDate }, rows, summary };
}

export async function getProfessionalActivityReport(
    referenceMonth: string
): Promise<ProfessionalActivityReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();
    const monthStart = referenceMonth.length === 7 ? `${referenceMonth}-01` : referenceMonth;
    const startDate = new Date(monthStart + 'T12:00:00');
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);

    const { data: professionals } = await admin
        .from('professionals')
        .select('id, profession_type, profile:profiles!profile_id(full_name)')
        .eq('is_active', true);

    if (!professionals || professionals.length === 0) return null;

    const rows: ProfessionalActivityRow[] = [];

    for (const prof of professionals) {
        const profProfile = Array.isArray((prof as any).profile) ? (prof as any).profile[0] : (prof as any).profile;
        const profName = profProfile?.full_name || 'Desconhecido';
        const profType = prof.profession_type as 'nutritionist' | 'physiotherapist';

        const { count: activePatients } = await admin
            .from('student_professionals')
            .select('id', { count: 'exact', head: true })
            .eq('professional_id', prof.id)
            .eq('status', 'active');

        if (profType === 'nutritionist') {
            const [consultResult, planResult, lastResult] = await Promise.all([
                admin.from('nutrition_consultations').select('id', { count: 'exact', head: true })
                    .eq('professional_id', prof.id).gte('consultation_date', monthStart).lte('consultation_date', monthEnd),
                admin.from('nutrition_meal_plans').select('id', { count: 'exact', head: true })
                    .eq('professional_id', prof.id).eq('is_active', true),
                admin.from('nutrition_consultations').select('consultation_date')
                    .eq('professional_id', prof.id).order('consultation_date', { ascending: false }).limit(1),
            ]);

            rows.push({
                professionalName: profName,
                professionType: profType,
                activePatients: activePatients || 0,
                activitiesThisMonth: consultResult.count || 0,
                activePlans: planResult.count || 0,
                lastActivityDate: lastResult.data?.[0]?.consultation_date,
            });
        } else {
            const [sessionResult, planResult, lastResult] = await Promise.all([
                admin.from('physio_sessions').select('id', { count: 'exact', head: true })
                    .eq('professional_id', prof.id).gte('session_date', monthStart).lte('session_date', monthEnd),
                admin.from('physio_treatment_plans').select('id', { count: 'exact', head: true })
                    .eq('professional_id', prof.id).eq('status', 'active'),
                admin.from('physio_sessions').select('session_date')
                    .eq('professional_id', prof.id).order('session_date', { ascending: false }).limit(1),
            ]);

            rows.push({
                professionalName: profName,
                professionType: profType,
                activePatients: activePatients || 0,
                activitiesThisMonth: sessionResult.count || 0,
                activePlans: planResult.count || 0,
                lastActivityDate: lastResult.data?.[0]?.session_date,
            });
        }
    }

    return { referenceMonth, rows };
}

export async function getStudentEvolutionReport(
    studentId: string,
    startDate: string,
    endDate: string,
): Promise<StudentEvolutionReport | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const admin = createAdminClient();

    const { data: student } = await admin
        .from('students')
        .select('full_name, trainer:trainers!students_trainer_id_fkey(profile:profiles!profile_id(full_name))')
        .eq('id', studentId)
        .single();

    if (!student) return null;

    const { data: links } = await admin
        .from('student_professionals')
        .select('professional:professionals!professional_id(profession_type, profile:profiles!profile_id(full_name))')
        .eq('student_id', studentId)
        .eq('status', 'active');

    const [assessments, consultations, sessions, events] = await Promise.all([
        admin.from('student_assessments').select('id, performed_at')
            .eq('student_id', studentId).gte('performed_at', startDate).lte('performed_at', endDate)
            .order('performed_at', { ascending: false }),
        admin.from('nutrition_consultations').select('id, consultation_date, chief_complaint')
            .eq('student_id', studentId).gte('consultation_date', startDate).lte('consultation_date', endDate)
            .order('consultation_date', { ascending: false }),
        admin.from('physio_sessions').select('id, session_date, clinical_notes')
            .eq('student_id', studentId).gte('session_date', startDate).lte('session_date', endDate)
            .order('session_date', { ascending: false }),
        admin.from('student_events').select('id, event_date, event_type, old_value, new_value')
            .eq('student_id', studentId).gte('event_date', startDate).lte('event_date', endDate)
            .order('event_date', { ascending: false }),
    ]);

    const rows: StudentEvolutionRow[] = [];

    (assessments.data || []).forEach((a: any) => {
        rows.push({ date: a.performed_at, discipline: 'training', type: 'Avaliação Física', description: 'Protocolo de avaliação registrado' });
    });
    (consultations.data || []).forEach((c: any) => {
        rows.push({ date: c.consultation_date, discipline: 'nutrition', type: 'Consulta Nutricional', description: c.chief_complaint || 'Consulta realizada' });
    });
    (sessions.data || []).forEach((s: any) => {
        rows.push({ date: s.session_date, discipline: 'physiotherapy', type: 'Sessão de Fisioterapia', description: s.clinical_notes?.substring(0, 100) || 'Sessão realizada' });
    });
    (events.data || []).forEach((e: any) => {
        if (e.event_type === 'status_change') {
            rows.push({ date: e.event_date, discipline: 'training', type: 'Mudança de Status', description: `${e.old_value?.status} → ${e.new_value?.status}` });
        }
    });

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const trainerProfile = Array.isArray((student as any).trainer?.profile) ? (student as any).trainer.profile[0] : (student as any).trainer?.profile;

    return {
        studentName: (student as any).full_name,
        trainerName: trainerProfile?.full_name || '-',
        period: { start: startDate, end: endDate },
        rows,
        linkedProfessionals: (links || []).map((l: any) => {
            const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
            const profProfile = Array.isArray(prof?.profile) ? prof.profile[0] : prof?.profile;
            return { name: profProfile?.full_name || '-', type: prof?.profession_type || '-' };
        }),
    };
}

// Helper: list months with snapshots
export async function getAvailableSnapshotMonths(): Promise<string[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return [];

    const admin = createAdminClient();
    const { data } = await admin
        .from('performance_snapshots')
        .select('reference_month')
        .order('reference_month', { ascending: false });

    const unique = [...new Set((data || []).map((d: any) => d.reference_month))];
    return unique as string[];
}

// Helper: list students for combobox
export async function getStudentsList(): Promise<{ id: string; name: string }[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return [];

    const admin = createAdminClient();
    const { data } = await admin
        .from('students')
        .select('id, full_name')
        .eq('is_archived', false)
        .order('full_name');

    return (data || []).map((s: any) => ({ id: s.id, name: s.full_name }));
}
