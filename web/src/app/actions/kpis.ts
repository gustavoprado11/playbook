'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';

// ---- TIPOS ----

export interface CoverageKPI {
    totalActiveStudents: number;
    withNutrition: number;
    withPhysio: number;
    withBoth: number;
    trainingOnly: number;
    coverageRate: number;
}

export interface EngagementKPI {
    discipline: 'nutrition' | 'physiotherapy';
    totalLinked: number;
    activeThisMonth: number;
    avgActivitiesPerStudent: number;
    inactiveOver30Days: number;
    engagementRate: number;
}

export interface RetentionCorrelation {
    segment: string;
    studentCount: number;
    cancellationsLast90Days: number;
    retentionRate: number;
    avgMonthsActive: number;
}

export interface MetricTrend {
    studentId: string;
    studentName: string;
    metric: string;
    dataPoints: { date: string; value: number }[];
    trend: 'improving' | 'stable' | 'declining';
    changePercent: number;
}

export interface KPIHighlight {
    type: 'positive' | 'attention' | 'neutral';
    title: string;
    description: string;
}

export interface CrossDisciplineKPIs {
    referenceDate: string;
    coverage: CoverageKPI;
    engagement: EngagementKPI[];
    retentionCorrelation: RetentionCorrelation[];
    metricTrends: {
        nutrition: MetricTrend[];
        physio: MetricTrend[];
    };
    highlights: KPIHighlight[];
}

// ---- MAIN ACTION ----

export async function getCrossDisciplineKPIs(): Promise<CrossDisciplineKPIs | null> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') return null;

    const [coverage, engagement, retentionCorrelation, metricTrends] = await Promise.all([
        getCoverageKPI(),
        getEngagementKPIs(),
        getRetentionCorrelation(),
        getMetricTrends(),
    ]);

    const highlights = generateHighlights(coverage, engagement, retentionCorrelation, metricTrends);

    return {
        referenceDate: new Date().toISOString().split('T')[0],
        coverage,
        engagement,
        retentionCorrelation,
        metricTrends,
        highlights,
    };
}

// ---- COVERAGE ----

async function getCoverageKPI(): Promise<CoverageKPI> {
    const admin = createAdminClient();

    // Get active student IDs (single query for both count and filtering)
    const { data: activeStudents } = await admin
        .from('students')
        .select('id')
        .eq('status', 'active')
        .eq('is_archived', false);

    const activeStudentIds = new Set((activeStudents || []).map((s: any) => s.id));
    const total = activeStudentIds.size;

    // Get all active student-professional links (only for active students)
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, professional:professionals!professional_id(profession_type)')
        .eq('status', 'active');

    // Build a map: studentId -> Set of profession types (only active students, exclude trainers)
    const studentDisciplines = new Map<string, Set<string>>();
    (links || []).forEach((l: any) => {
        if (!activeStudentIds.has(l.student_id)) return; // Skip non-active students
        const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
        if (!prof) return;
        // Only count nutritionist and physiotherapist — trainers don't count as "multidisciplinary"
        if (prof.profession_type === 'trainer') return;
        if (!studentDisciplines.has(l.student_id)) {
            studentDisciplines.set(l.student_id, new Set());
        }
        studentDisciplines.get(l.student_id)!.add(prof.profession_type);
    });

    let withNutrition = 0;
    let withPhysio = 0;
    let withBoth = 0;

    studentDisciplines.forEach((types) => {
        const hasN = types.has('nutritionist');
        const hasP = types.has('physiotherapist');
        if (hasN) withNutrition++;
        if (hasP) withPhysio++;
        if (hasN && hasP) withBoth++;
    });

    const trainingOnly = total - studentDisciplines.size;
    const coverageRate = total > 0 ? (studentDisciplines.size / total) * 100 : 0;

    return { totalActiveStudents: total, withNutrition, withPhysio, withBoth, trainingOnly, coverageRate };
}

// ---- ENGAGEMENT ----

async function getEngagementKPIs(): Promise<EngagementKPI[]> {
    const admin = createAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const results: EngagementKPI[] = [];

    // Get active student IDs to filter links
    const { data: activeStudents } = await admin
        .from('students')
        .select('id')
        .eq('status', 'active')
        .eq('is_archived', false);

    const activeStudentIds = new Set((activeStudents || []).map((s: any) => s.id));

    // Professional links (only active students)
    const { data: nutLinks } = await admin
        .from('student_professionals')
        .select('student_id, professional:professionals!professional_id(profession_type)')
        .eq('status', 'active');

    const nutStudentIds = (nutLinks || [])
        .filter((l: any) => {
            if (!activeStudentIds.has(l.student_id)) return false;
            const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
            return prof?.profession_type === 'nutritionist';
        })
        .map((l: any) => l.student_id);

    const physioStudentIds = (nutLinks || [])
        .filter((l: any) => {
            if (!activeStudentIds.has(l.student_id)) return false;
            const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
            return prof?.profession_type === 'physiotherapist';
        })
        .map((l: any) => l.student_id);

    // Nutrition engagement
    if (nutStudentIds.length > 0) {
        const { data: consultations } = await admin
            .from('nutrition_consultations')
            .select('student_id')
            .in('student_id', nutStudentIds)
            .gte('consultation_date', monthStart);

        const activeSet = new Set((consultations || []).map((c: any) => c.student_id));
        const totalActivities = consultations?.length || 0;

        const { data: recentAny } = await admin
            .from('nutrition_consultations')
            .select('student_id')
            .in('student_id', nutStudentIds)
            .gte('consultation_date', thirtyDaysAgo);

        const recentSet = new Set((recentAny || []).map((c: any) => c.student_id));
        const inactive = nutStudentIds.filter(id => !recentSet.has(id)).length;

        results.push({
            discipline: 'nutrition',
            totalLinked: nutStudentIds.length,
            activeThisMonth: activeSet.size,
            avgActivitiesPerStudent: activeSet.size > 0 ? totalActivities / activeSet.size : 0,
            inactiveOver30Days: inactive,
            engagementRate: nutStudentIds.length > 0 ? (activeSet.size / nutStudentIds.length) * 100 : 0,
        });
    } else {
        results.push({ discipline: 'nutrition', totalLinked: 0, activeThisMonth: 0, avgActivitiesPerStudent: 0, inactiveOver30Days: 0, engagementRate: 0 });
    }

    // Physio engagement
    if (physioStudentIds.length > 0) {
        const { data: sessions } = await admin
            .from('physio_sessions')
            .select('student_id')
            .in('student_id', physioStudentIds)
            .gte('session_date', monthStart);

        const activeSet = new Set((sessions || []).map((s: any) => s.student_id));
        const totalActivities = sessions?.length || 0;

        const { data: recentAny } = await admin
            .from('physio_sessions')
            .select('student_id')
            .in('student_id', physioStudentIds)
            .gte('session_date', thirtyDaysAgo);

        const recentSet = new Set((recentAny || []).map((s: any) => s.student_id));
        const inactive = physioStudentIds.filter(id => !recentSet.has(id)).length;

        results.push({
            discipline: 'physiotherapy',
            totalLinked: physioStudentIds.length,
            activeThisMonth: activeSet.size,
            avgActivitiesPerStudent: activeSet.size > 0 ? totalActivities / activeSet.size : 0,
            inactiveOver30Days: inactive,
            engagementRate: physioStudentIds.length > 0 ? (activeSet.size / physioStudentIds.length) * 100 : 0,
        });
    } else {
        results.push({ discipline: 'physiotherapy', totalLinked: 0, activeThisMonth: 0, avgActivitiesPerStudent: 0, inactiveOver30Days: 0, engagementRate: 0 });
    }

    return results;
}

// ---- RETENTION CORRELATION ----

async function getRetentionCorrelation(): Promise<RetentionCorrelation[]> {
    const admin = createAdminClient();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const today = new Date();

    // All active + recently cancelled students
    const { data: allStudents } = await admin
        .from('students')
        .select('id, full_name, status, start_date, is_archived')
        .eq('is_archived', false)
        .in('status', ['active', 'cancelled', 'paused']);

    if (!allStudents || allStudents.length === 0) return [];

    // Professional links
    const { data: links } = await admin
        .from('student_professionals')
        .select('student_id, professional:professionals!professional_id(profession_type)')
        .eq('status', 'active');

    const studentDisciplines = new Map<string, Set<string>>();
    (links || []).forEach((l: any) => {
        const prof = Array.isArray(l.professional) ? l.professional[0] : l.professional;
        if (!prof) return;
        if (!studentDisciplines.has(l.student_id)) studentDisciplines.set(l.student_id, new Set());
        studentDisciplines.get(l.student_id)!.add(prof.profession_type);
    });

    // Recent cancellations
    const { data: recentCancellations } = await admin
        .from('student_events')
        .select('student_id')
        .eq('event_type', 'status_change')
        .gte('event_date', ninetyDaysAgo);

    // Filter to only status_change to cancelled
    const cancelledStudentIds = new Set<string>();
    // We need to also check new_value, so let's re-query with more detail
    const { data: cancelEvents } = await admin
        .from('student_events')
        .select('student_id, new_value')
        .eq('event_type', 'status_change')
        .gte('event_date', ninetyDaysAgo);

    (cancelEvents || []).forEach((e: any) => {
        if (e.new_value?.status === 'cancelled') cancelledStudentIds.add(e.student_id);
    });

    // Segment students
    const segments: Record<string, { students: any[]; cancellations: number }> = {
        'Só Treino': { students: [], cancellations: 0 },
        'Treino + Nutrição': { students: [], cancellations: 0 },
        'Treino + Fisioterapia': { students: [], cancellations: 0 },
        'Multidisciplinar': { students: [], cancellations: 0 },
    };

    allStudents.forEach((s: any) => {
        const disciplines = studentDisciplines.get(s.id);
        const hasN = disciplines?.has('nutritionist');
        const hasP = disciplines?.has('physiotherapist');
        const isCancelled = cancelledStudentIds.has(s.id);

        let segment: string;
        if (hasN && hasP) segment = 'Multidisciplinar';
        else if (hasN) segment = 'Treino + Nutrição';
        else if (hasP) segment = 'Treino + Fisioterapia';
        else segment = 'Só Treino';

        segments[segment].students.push(s);
        if (isCancelled) segments[segment].cancellations++;
    });

    return Object.entries(segments)
        .filter(([, data]) => data.students.length > 0)
        .map(([segment, data]) => {
            const count = data.students.length;
            const avgMonths = data.students.reduce((sum: number, s: any) => {
                const months = (today.getTime() - new Date(s.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
                return sum + months;
            }, 0) / count;

            return {
                segment,
                studentCount: count,
                cancellationsLast90Days: data.cancellations,
                retentionRate: count > 0 ? ((count - data.cancellations) / count) * 100 : 0,
                avgMonthsActive: Math.round(avgMonths * 10) / 10,
            };
        });
}

// ---- METRIC TRENDS ----

async function getMetricTrends(): Promise<{ nutrition: MetricTrend[]; physio: MetricTrend[] }> {
    const admin = createAdminClient();
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

    // Nutrition: weight trends from consultation metrics
    const { data: consultations } = await admin
        .from('nutrition_consultations')
        .select('student_id, consultation_date, metrics:nutrition_metrics(weight_kg, bmi, body_fat_pct)')
        .gte('consultation_date', sixMonthsAgo)
        .order('consultation_date', { ascending: true });

    // Get student names
    const studentIds = [...new Set((consultations || []).map((c: any) => c.student_id))];
    const { data: students } = await admin
        .from('students')
        .select('id, full_name')
        .in('id', studentIds.length > 0 ? studentIds : ['__none__']);

    const nameMap = new Map((students || []).map((s: any) => [s.id, s.full_name]));

    // Group by student for weight
    const weightByStudent = new Map<string, { date: string; value: number }[]>();
    (consultations || []).forEach((c: any) => {
        const metrics = Array.isArray(c.metrics) ? c.metrics[0] : c.metrics;
        if (!metrics?.weight_kg) return;
        if (!weightByStudent.has(c.student_id)) weightByStudent.set(c.student_id, []);
        weightByStudent.get(c.student_id)!.push({ date: c.consultation_date, value: metrics.weight_kg });
    });

    const nutritionTrends: MetricTrend[] = [];
    weightByStudent.forEach((points, studentId) => {
        if (points.length < 2) return;
        const first = points[0].value;
        const last = points[points.length - 1].value;
        const changePercent = ((last - first) / first) * 100;
        const trend: MetricTrend['trend'] = changePercent <= -2 ? 'improving' : changePercent >= 2 ? 'declining' : 'stable';

        nutritionTrends.push({
            studentId,
            studentName: nameMap.get(studentId) || 'Desconhecido',
            metric: 'weight',
            dataPoints: points,
            trend,
            changePercent: Math.round(changePercent * 10) / 10,
        });
    });

    // Sort: most improving first, then most declining
    nutritionTrends.sort((a, b) => a.changePercent - b.changePercent);

    // Physio: pain trends
    const { data: sessions } = await admin
        .from('physio_sessions')
        .select('student_id, session_date, evolution:physio_session_evolution(pain_before, pain_after)')
        .gte('session_date', sixMonthsAgo)
        .order('session_date', { ascending: true });

    const physioStudentIds = [...new Set((sessions || []).map((s: any) => s.student_id))];
    const { data: physioStudents } = await admin
        .from('students')
        .select('id, full_name')
        .in('id', physioStudentIds.length > 0 ? physioStudentIds : ['__none__']);

    const physioNameMap = new Map((physioStudents || []).map((s: any) => [s.id, s.full_name]));

    const painByStudent = new Map<string, { date: string; value: number }[]>();
    (sessions || []).forEach((s: any) => {
        const evo = Array.isArray(s.evolution) ? s.evolution[0] : s.evolution;
        if (!evo || evo.pain_after === null) return;
        if (!painByStudent.has(s.student_id)) painByStudent.set(s.student_id, []);
        painByStudent.get(s.student_id)!.push({ date: s.session_date, value: evo.pain_after });
    });

    const physioTrends: MetricTrend[] = [];
    painByStudent.forEach((points, studentId) => {
        if (points.length < 2) return;
        const first = points[0].value;
        const last = points[points.length - 1].value;
        const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
        const trend: MetricTrend['trend'] = changePct <= -5 ? 'improving' : changePct >= 5 ? 'declining' : 'stable';

        physioTrends.push({
            studentId,
            studentName: physioNameMap.get(studentId) || 'Desconhecido',
            metric: 'pain',
            dataPoints: points,
            trend,
            changePercent: Math.round(changePct * 10) / 10,
        });
    });

    physioTrends.sort((a, b) => a.changePercent - b.changePercent);

    return {
        nutrition: nutritionTrends.slice(0, 10),
        physio: physioTrends.slice(0, 10),
    };
}

// ---- HIGHLIGHTS ----

function generateHighlights(
    coverage: CoverageKPI,
    engagement: EngagementKPI[],
    retention: RetentionCorrelation[],
    trends: { nutrition: MetricTrend[]; physio: MetricTrend[] },
): KPIHighlight[] {
    const highlights: KPIHighlight[] = [];

    // Coverage
    if (coverage.coverageRate > 50) {
        highlights.push({
            type: 'positive',
            title: `${coverage.coverageRate.toFixed(0)}% com acompanhamento multidisciplinar`,
            description: `${coverage.totalActiveStudents - coverage.trainingOnly} de ${coverage.totalActiveStudents} alunos ativos têm pelo menos um profissional vinculado além do treinador.`,
        });
    } else if (coverage.totalActiveStudents > 0) {
        highlights.push({
            type: 'neutral',
            title: `${coverage.coverageRate.toFixed(0)}% com acompanhamento extra`,
            description: `${coverage.trainingOnly} alunos estão apenas com treino. Vincular profissionais pode melhorar retenção.`,
        });
    }

    // Engagement alerts
    engagement.forEach(e => {
        if (e.inactiveOver30Days > 0) {
            const label = e.discipline === 'nutrition' ? 'nutricionista' : 'fisioterapeuta';
            highlights.push({
                type: 'attention',
                title: `${e.inactiveOver30Days} aluno(s) sem atividade de ${label}`,
                description: `Vinculados a ${label} mas sem consulta/sessão nos últimos 30 dias.`,
            });
        }
    });

    // Retention comparison
    const trainingOnly = retention.find(r => r.segment === 'Só Treino');
    const multi = retention.find(r => r.segment === 'Multidisciplinar');
    if (trainingOnly && multi && trainingOnly.studentCount >= 3 && multi.studentCount >= 3) {
        const diff = multi.retentionRate - trainingOnly.retentionRate;
        if (diff > 5) {
            highlights.push({
                type: 'positive',
                title: `Multidisciplinar retém ${diff.toFixed(0)}% mais`,
                description: `Alunos com acompanhamento completo têm ${multi.retentionRate.toFixed(0)}% de retenção vs ${trainingOnly.retentionRate.toFixed(0)}% só treino.`,
            });
        }
    }

    // Declining metrics
    const declining = [...trends.nutrition, ...trends.physio].filter(t => t.trend === 'declining');
    if (declining.length > 0) {
        highlights.push({
            type: 'attention',
            title: `${declining.length} aluno(s) com métricas em declínio`,
            description: `Tendência negativa em peso ou dor detectada nos últimos 6 meses.`,
        });
    }

    return highlights;
}
