import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { buildWorkWeek, getWeekStart, formatIsoDateLabel } from '@/lib/attendance';
import { ensureWeekAgendaFromBase } from '@/lib/attendance-store';
import type {
    AttendancePublicLink,
    Profile,
    ScheduleBaseEntry,
    ScheduleBaseSlot,
    ScheduleWeekEntry,
    ScheduleWeekSlot,
    Student,
    Trainer,
} from '@/types/database';

type JoinedStudent = Student & { trainer: Trainer & { profile: Profile } };
type JoinedTrainer = Trainer & { profile: Profile };

export interface AttendancePageData {
    role: 'manager' | 'trainer';
    weekLabel: string;
    weekStart: string;
    weekDays: ReturnType<typeof buildWorkWeek>;
    students: JoinedStudent[];
    trainers: JoinedTrainer[];
    baseSlots: (ScheduleBaseSlot & { trainer: JoinedTrainer; entries: (ScheduleBaseEntry & { student?: JoinedStudent | null })[] })[];
    weekSlots: (ScheduleWeekSlot & { trainer: JoinedTrainer; entries: (ScheduleWeekEntry & { student?: JoinedStudent | null })[] })[];
    publicLink: AttendancePublicLink | null;
}

async function fetchStudentsAndTrainers(supabase: any, trainerId?: string | null) {
    let studentsQuery = supabase
        .from('students')
        .select('*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*))')
        .eq('status', 'active')
        .eq('is_archived', false)
        .order('full_name');

    let trainersQuery = supabase
        .from('trainers')
        .select('*, profile:profiles(*)')
        .eq('is_active', true)
        .order('created_at');

    if (trainerId) {
        studentsQuery = studentsQuery.eq('trainer_id', trainerId);
        trainersQuery = trainersQuery.eq('id', trainerId);
    }

    const [studentsResult, trainersResult] = await Promise.all([studentsQuery, trainersQuery]);

    return {
        students: (studentsResult.data || []) as JoinedStudent[],
        trainers: (trainersResult.data || []) as JoinedTrainer[],
    };
}

async function fetchBaseAgenda(supabase: any, trainerId?: string | null) {
    let slotsQuery = supabase
        .from('schedule_base_slots')
        .select('*, trainer:trainers(*, profile:profiles(*))')
        .eq('is_active', true)
        .order('start_time')
        .order('weekday');

    if (trainerId) {
        slotsQuery = slotsQuery.eq('trainer_id', trainerId);
    }

    const { data: slots } = await slotsQuery;
    const slotIds = (slots || []).map((slot: any) => slot.id);

    const { data: entries } = slotIds.length > 0
        ? await supabase
            .from('schedule_base_entries')
            .select('*, student:students(*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*)))')
            .in('slot_id', slotIds)
            .order('position')
        : { data: [] };

    const entriesBySlot = new Map<string, any[]>();
    (entries || []).forEach((entry: any) => {
        const list = entriesBySlot.get(entry.slot_id) || [];
        list.push(entry);
        entriesBySlot.set(entry.slot_id, list);
    });

    return ((slots || []) as any[]).map((slot) => ({
        ...slot,
        entries: entriesBySlot.get(slot.id) || [],
    }));
}

async function fetchWeekAgenda(supabase: any, weekStart: string, trainerId?: string | null) {
    const admin = createAdminClient();
    await ensureWeekAgendaFromBase(admin, weekStart, trainerId);

    let slotsQuery = supabase
        .from('schedule_week_slots')
        .select('*, trainer:trainers(*, profile:profiles(*))')
        .eq('week_start', weekStart)
        .order('start_time')
        .order('weekday');

    if (trainerId) {
        slotsQuery = slotsQuery.eq('trainer_id', trainerId);
    }

    const { data: slots } = await slotsQuery;
    const slotIds = (slots || []).map((slot: any) => slot.id);

    const { data: entries } = slotIds.length > 0
        ? await supabase
            .from('schedule_week_entries')
            .select('*, student:students(*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*)))')
            .in('week_slot_id', slotIds)
            .order('position')
        : { data: [] };

    const entriesBySlot = new Map<string, any[]>();
    (entries || []).forEach((entry: any) => {
        const list = entriesBySlot.get(entry.week_slot_id) || [];
        list.push(entry);
        entriesBySlot.set(entry.week_slot_id, list);
    });

    return ((slots || []) as any[]).map((slot) => ({
        ...slot,
        entries: entriesBySlot.get(slot.id) || [],
    }));
}

export async function getAttendancePageData(referenceDate?: string): Promise<AttendancePageData | null> {
    const profile = await getProfile();

    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        return null;
    }

    const supabase = await createClient();
    const trainerId = profile.role === 'trainer' ? await getTrainerId() : null;
    const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
    const weekDays = buildWorkWeek(baseDate);
    const weekStart = getWeekStart(baseDate).toISOString().slice(0, 10);

    const [{ students, trainers }, baseSlots, weekSlots, publicLinkResult] = await Promise.all([
        fetchStudentsAndTrainers(supabase, trainerId),
        fetchBaseAgenda(supabase, trainerId),
        fetchWeekAgenda(supabase, weekStart, trainerId),
        profile.role === 'manager'
            ? supabase
                .from('attendance_public_links')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    return {
        role: profile.role,
        weekLabel: `${formatIsoDateLabel(weekDays[0].isoDate)} - ${formatIsoDateLabel(weekDays[weekDays.length - 1].isoDate)}`,
        weekStart,
        weekDays,
        students,
        trainers,
        baseSlots: baseSlots as any,
        weekSlots: weekSlots as any,
        publicLink: (publicLinkResult.data || null) as AttendancePublicLink | null,
    };
}

export async function getPublicAttendancePageData(
    accessToken: string,
    referenceDate?: string
): Promise<(Omit<AttendancePageData, 'publicLink' | 'role'> & { role: 'manager'; publicLabel: string }) | null> {
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

    const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
    const weekDays = buildWorkWeek(baseDate);
    const weekStart = getWeekStart(baseDate).toISOString().slice(0, 10);

    const [{ students, trainers }, baseSlots, weekSlots] = await Promise.all([
        fetchStudentsAndTrainers(admin),
        fetchBaseAgenda(admin),
        fetchWeekAgenda(admin, weekStart),
    ]);

    return {
        role: 'manager',
        weekLabel: `${formatIsoDateLabel(weekDays[0].isoDate)} - ${formatIsoDateLabel(weekDays[weekDays.length - 1].isoDate)}`,
        weekStart,
        weekDays,
        students,
        trainers,
        baseSlots: baseSlots as any,
        weekSlots: weekSlots as any,
        publicLabel: (link as AttendancePublicLink).label,
    };
}
