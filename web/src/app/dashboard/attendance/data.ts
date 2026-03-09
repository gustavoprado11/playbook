import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { buildWorkWeek, getWeekStart } from '@/lib/attendance';
import type { AttendancePublicLink, AttendanceRecord, Profile, Student, Trainer, WeeklyScheduleTemplate } from '@/types/database';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };
type JoinedTemplate = WeeklyScheduleTemplate & {
    student: JoinedStudent | null;
    trainer: JoinedTrainer;
};

export interface AttendancePageData {
    role: 'manager' | 'trainer';
    weekLabel: string;
    weekStart: string;
    weekDays: ReturnType<typeof buildWorkWeek>;
    students: JoinedStudent[];
    trainers: JoinedTrainer[];
    templates: JoinedTemplate[];
    records: AttendanceRecord[];
    publicLink: AttendancePublicLink | null;
}

async function fetchAttendanceData({
    referenceDate,
    role,
    trainerId,
    useAdmin = false,
}: {
    referenceDate?: string;
    role: 'manager' | 'trainer';
    trainerId?: string | null;
    useAdmin?: boolean;
}) {
    const supabase = useAdmin ? createAdminClient() : await createClient();
    const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
    const weekDays = buildWorkWeek(baseDate);
    const weekStart = getWeekStart(baseDate).toISOString().slice(0, 10);
    const weekEnd = weekDays[weekDays.length - 1].isoDate;

    let studentsQuery = supabase
        .from('students')
        .select('*, trainer:trainers(*, profile:profiles(*))')
        .eq('status', 'active')
        .eq('is_archived', false)
        .order('full_name');

    let templatesQuery = supabase
        .from('weekly_schedule_templates')
        .select('*, student:students(*, trainer:trainers(*, profile:profiles(*))), trainer:trainers(*, profile:profiles(*))')
        .eq('is_active', true)
        .order('start_time')
        .order('weekday');

    let recordsQuery = supabase
        .from('attendance_records')
        .select('*')
        .gte('session_date', weekStart)
        .lte('session_date', weekEnd)
        .order('session_date')
        .order('start_time');

    if (role === 'trainer' && trainerId) {
        studentsQuery = studentsQuery.eq('trainer_id', trainerId);
        templatesQuery = templatesQuery.eq('trainer_id', trainerId);
        recordsQuery = recordsQuery.eq('trainer_id', trainerId);
    }

    const [studentsResult, templatesResult, recordsResult, trainersResult] = await Promise.all([
        studentsQuery,
        templatesQuery,
        recordsQuery,
        supabase
            .from('trainers')
            .select('*, profile:profiles(*)')
            .eq('is_active', true)
            .order('created_at'),
    ]);

    return {
        weekLabel: `${weekDays[0].date.toLocaleDateString('pt-BR')} - ${weekDays[weekDays.length - 1].date.toLocaleDateString('pt-BR')}`,
        weekStart,
        weekDays,
        students: (studentsResult.data || []) as JoinedStudent[],
        trainers: (trainersResult.data || []) as JoinedTrainer[],
        templates: (templatesResult.data || []) as JoinedTemplate[],
        records: (recordsResult.data || []) as AttendanceRecord[],
    };
}

export async function getAttendancePageData(referenceDate?: string): Promise<AttendancePageData | null> {
    const profile = await getProfile();

    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        return null;
    }

    const trainerId = profile.role === 'trainer' ? await getTrainerId() : null;
    const data = await fetchAttendanceData({
        referenceDate,
        role: profile.role,
        trainerId,
    });

    let publicLink: AttendancePublicLink | null = null;
    if (profile.role === 'manager') {
        const supabase = await createClient();
        const { data: link } = await supabase
            .from('attendance_public_links')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        publicLink = (link || null) as AttendancePublicLink | null;
    }

    return {
        ...data,
        role: profile.role,
        publicLink,
    };
}

export async function getPublicAttendancePageData(
    accessToken: string,
    referenceDate?: string
): Promise<(Omit<AttendancePageData, 'publicLink'> & { publicLabel: string }) | null> {
    const admin = createAdminClient();
    const { data: link } = await admin
        .from('attendance_public_links')
        .select('*')
        .eq('access_token', accessToken)
        .eq('is_active', true)
        .maybeSingle();

    if (!link) {
        return null;
    }

    const data = await fetchAttendanceData({
        referenceDate,
        role: 'manager',
        useAdmin: true,
    });

    return {
        ...data,
        role: 'manager',
        publicLabel: (link as AttendancePublicLink).label,
    };
}
