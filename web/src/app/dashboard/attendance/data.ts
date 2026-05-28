import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { buildWorkWeek, getWeekStart, formatIsoDateLabel } from '@/lib/attendance';
import { ensureWeekAgendaFromBase } from '@/lib/attendance-store';
import type {
    AgendaKind,
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
    agenda: AgendaKind;
    ownerLabel: string;
    ownerLabelPlural: string;
    weekLabel: string;
    weekStart: string;
    weekDays: ReturnType<typeof buildWorkWeek>;
    students: JoinedStudent[];
    trainers: JoinedTrainer[];
    baseSlots: (ScheduleBaseSlot & { trainer: JoinedTrainer; entries: (ScheduleBaseEntry & { student?: JoinedStudent | null })[] })[];
    weekSlots: (ScheduleWeekSlot & { trainer: JoinedTrainer; entries: (ScheduleWeekEntry & { student?: JoinedStudent | null })[] })[];
    publicLink: AttendancePublicLink | null;
}

function agendaLabels(agenda: AgendaKind) {
    if (agenda === 'physiotherapy') {
        return { ownerLabel: 'Fisioterapeuta', ownerLabelPlural: 'Todos os fisioterapeutas' };
    }
    return { ownerLabel: 'Treinador', ownerLabelPlural: 'Todos os treinadores' };
}

// ── Training dataset ────────────────────────────────────────────────

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

// ── Physiotherapy dataset (owner-aliasing) ──────────────────────────

// Normalize a physio slot so the workspace's trainer reads keep working.
function aliasPhysioSlot(slot: any) {
    const professional = slot.professional || null;
    return {
        ...slot,
        trainer_id: slot.professional_id,
        trainer: professional
            ? { ...professional, profile: professional.profile }
            : null,
    };
}

async function fetchPhysioStudentsAndTrainers(supabase: any, professionalId?: string | null) {
    // Physiotherapists (owners list), aliased to JoinedTrainer shape.
    let prosQuery = supabase
        .from('professionals')
        .select('*, profile:profiles(*)')
        .eq('profession_type', 'physiotherapist')
        .eq('is_active', true)
        .order('created_at');

    if (professionalId) {
        prosQuery = prosQuery.eq('id', professionalId);
    }

    // Patients linked to the relevant physiotherapist(s) via student_professionals.
    let linksQuery = supabase
        .from('student_professionals')
        .select('student_id')
        .eq('status', 'active');

    if (professionalId) {
        linksQuery = linksQuery.eq('professional_id', professionalId);
    } else {
        // For manager: only links to active physiotherapists.
        const { data: physioPros } = await supabase
            .from('professionals')
            .select('id')
            .eq('profession_type', 'physiotherapist')
            .eq('is_active', true);
        const physioProIds = (physioPros || []).map((p: any) => p.id);
        linksQuery = physioProIds.length > 0
            ? linksQuery.in('professional_id', physioProIds)
            : linksQuery.in('professional_id', ['00000000-0000-0000-0000-000000000000']);
    }

    const [prosResult, linksResult] = await Promise.all([prosQuery, linksQuery]);

    const studentIds = Array.from(
        new Set((linksResult.data || []).map((row: any) => row.student_id).filter(Boolean))
    );

    const { data: students } = studentIds.length > 0
        ? await supabase
            .from('students')
            .select('*, trainer:trainers!students_trainer_id_fkey(*, profile:profiles(*))')
            .in('id', studentIds)
            .eq('status', 'active')
            .eq('is_archived', false)
            .order('full_name')
        : { data: [] };

    const trainers = ((prosResult.data || []) as any[]).map((professional) => ({
        ...professional,
        profile: professional.profile,
    })) as JoinedTrainer[];

    return {
        students: (students || []) as JoinedStudent[],
        trainers,
    };
}

async function fetchPhysioBaseAgenda(supabase: any, professionalId?: string | null) {
    let slotsQuery = supabase
        .from('physio_schedule_base_slots')
        .select('*, professional:professionals!professional_id(*, profile:profiles(*))')
        .eq('is_active', true)
        .order('start_time')
        .order('weekday');

    if (professionalId) {
        slotsQuery = slotsQuery.eq('professional_id', professionalId);
    }

    const { data: slots } = await slotsQuery;
    const slotIds = (slots || []).map((slot: any) => slot.id);

    const { data: entries } = slotIds.length > 0
        ? await supabase
            .from('physio_schedule_base_entries')
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
        ...aliasPhysioSlot(slot),
        entries: entriesBySlot.get(slot.id) || [],
    }));
}

async function fetchPhysioWeekAgenda(supabase: any, weekStart: string, professionalId?: string | null) {
    const admin = createAdminClient();
    await ensureWeekAgendaFromBase(admin, weekStart, professionalId, 'physiotherapy');

    let slotsQuery = supabase
        .from('physio_schedule_week_slots')
        .select('*, professional:professionals!professional_id(*, profile:profiles(*))')
        .eq('week_start', weekStart)
        .order('start_time')
        .order('weekday');

    if (professionalId) {
        slotsQuery = slotsQuery.eq('professional_id', professionalId);
    }

    const { data: slots } = await slotsQuery;
    const slotIds = (slots || []).map((slot: any) => slot.id);

    const { data: entries } = slotIds.length > 0
        ? await supabase
            .from('physio_schedule_week_entries')
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
        ...aliasPhysioSlot(slot),
        entries: entriesBySlot.get(slot.id) || [],
    }));
}

async function resolvePhysiotherapistId(supabase: any, profileId: string) {
    const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', profileId)
        .eq('profession_type', 'physiotherapist')
        .maybeSingle();

    return professional?.id || null;
}

export async function getAttendancePageData(
    agenda: AgendaKind = 'training',
    referenceDate?: string
): Promise<AttendancePageData | null> {
    const profile = await getProfile();

    if (!profile) {
        return null;
    }

    const supabase = await createClient();
    const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
    const weekDays = buildWorkWeek(baseDate);
    const weekStart = getWeekStart(baseDate).toISOString().slice(0, 10);
    const labels = agendaLabels(agenda);

    if (agenda === 'physiotherapy') {
        const isManager = profile.role === 'manager';
        const isPhysio = profile.role === 'professional' && profile.profession_type === 'physiotherapist';

        if (!isManager && !isPhysio) {
            return null;
        }

        const professionalId = isPhysio ? await resolvePhysiotherapistId(supabase, profile.id) : null;

        if (isPhysio && !professionalId) {
            return null;
        }

        const [{ students, trainers }, baseSlots, weekSlots, publicLinkResult] = await Promise.all([
            fetchPhysioStudentsAndTrainers(supabase, professionalId),
            fetchPhysioBaseAgenda(supabase, professionalId),
            fetchPhysioWeekAgenda(supabase, weekStart, professionalId),
            isManager
                ? supabase
                    .from('attendance_public_links')
                    .select('*')
                    .eq('is_active', true)
                    .eq('agenda', 'physiotherapy')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        return {
            role: isManager ? 'manager' : 'trainer',
            agenda,
            ownerLabel: labels.ownerLabel,
            ownerLabelPlural: labels.ownerLabelPlural,
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

    if (!['manager', 'trainer'].includes(profile.role)) {
        return null;
    }

    const trainerId = profile.role === 'trainer' ? await getTrainerId() : null;

    const [{ students, trainers }, baseSlots, weekSlots, publicLinkResult] = await Promise.all([
        fetchStudentsAndTrainers(supabase, trainerId),
        fetchBaseAgenda(supabase, trainerId),
        fetchWeekAgenda(supabase, weekStart, trainerId),
        profile.role === 'manager'
            ? supabase
                .from('attendance_public_links')
                .select('*')
                .eq('is_active', true)
                .eq('agenda', 'training')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    return {
        role: profile.role as 'manager' | 'trainer',
        agenda,
        ownerLabel: labels.ownerLabel,
        ownerLabelPlural: labels.ownerLabelPlural,
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

    const agenda = ((link as any).agenda || 'training') as AgendaKind;
    const labels = agendaLabels(agenda);
    const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
    const weekDays = buildWorkWeek(baseDate);
    const weekStart = getWeekStart(baseDate).toISOString().slice(0, 10);

    const [{ students, trainers }, baseSlots, weekSlots] = agenda === 'physiotherapy'
        ? await Promise.all([
            fetchPhysioStudentsAndTrainers(admin),
            fetchPhysioBaseAgenda(admin),
            fetchPhysioWeekAgenda(admin, weekStart),
        ])
        : await Promise.all([
            fetchStudentsAndTrainers(admin),
            fetchBaseAgenda(admin),
            fetchWeekAgenda(admin, weekStart),
        ]);

    return {
        role: 'manager',
        agenda,
        ownerLabel: labels.ownerLabel,
        ownerLabelPlural: labels.ownerLabelPlural,
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
