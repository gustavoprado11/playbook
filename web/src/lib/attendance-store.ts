import { normalizeTimeInput } from '@/lib/attendance';
import type { AgendaKind, ScheduleParticipant } from '@/types/database';

type SupabaseLike = any;

export interface TableSet {
    baseSlots: string;
    baseEntries: string;
    weekSlots: string;
    weekEntries: string;
    ownerCol: 'trainer_id' | 'professional_id';
}

export function tableset(agenda: AgendaKind = 'training'): TableSet {
    if (agenda === 'physiotherapy') {
        return {
            baseSlots: 'physio_schedule_base_slots',
            baseEntries: 'physio_schedule_base_entries',
            weekSlots: 'physio_schedule_week_slots',
            weekEntries: 'physio_schedule_week_entries',
            ownerCol: 'professional_id',
        };
    }

    return {
        baseSlots: 'schedule_base_slots',
        baseEntries: 'schedule_base_entries',
        weekSlots: 'schedule_week_slots',
        weekEntries: 'schedule_week_entries',
        ownerCol: 'trainer_id',
    };
}

export function normalizeParticipants(entries: ScheduleParticipant[], includeStatus = false) {
    return entries
        .map((entry, index) => ({
            student_id: entry.student_id || null,
            guest_name: entry.student_id ? null : entry.guest_name?.trim() || null,
            guest_origin: entry.student_id ? null : entry.guest_origin?.trim() || null,
            position: index + 1,
            status: includeStatus ? entry.status || 'pending' : undefined,
            notes: entry.notes?.trim() || null,
        }))
        .filter((entry) => Boolean(entry.student_id) || Boolean(entry.guest_name));
}

export function validateParticipants(entries: ScheduleParticipant[]) {
    entries.forEach((entry) => {
        const hasStudent = Boolean(entry.student_id);
        const hasGuest = Boolean(entry.guest_name?.trim());

        if (hasStudent === hasGuest) {
            throw new Error('Cada linha precisa ter um aluno cadastrado ou um nome avulso');
        }
    });
}

export async function ensureWeekAgendaFromBase(
    supabase: SupabaseLike,
    weekStart: string,
    ownerId?: string | null,
    agenda: AgendaKind = 'training'
) {
    const tables = tableset(agenda);
    const ownerCol = tables.ownerCol;

    let baseSlotsQuery = supabase
        .from(tables.baseSlots)
        .select('*')
        .eq('is_active', true);

    let existingWeekSlotsQuery = supabase
        .from(tables.weekSlots)
        .select('*')
        .eq('week_start', weekStart);

    if (ownerId) {
        baseSlotsQuery = baseSlotsQuery.eq(ownerCol, ownerId);
        existingWeekSlotsQuery = existingWeekSlotsQuery.eq(ownerCol, ownerId);
    }

    const [{ data: baseSlots }, { data: existingWeekSlots }] = await Promise.all([
        baseSlotsQuery,
        existingWeekSlotsQuery,
    ]);

    const existingByBase = new Set(
        (existingWeekSlots || [])
            .filter((slot: any) => slot.base_slot_id)
            .map((slot: any) => slot.base_slot_id as string)
    );

    // Also track by composite key to avoid unique constraint violations
    const existingByKey = new Set(
        (existingWeekSlots || []).map((slot: any) =>
            `${slot[ownerCol]}|${slot.weekday}|${slot.start_time}`
        )
    );

    const missingBaseSlots = (baseSlots || []).filter((slot: any) =>
        !existingByBase.has(slot.id) &&
        !existingByKey.has(`${slot[ownerCol]}|${slot.weekday}|${slot.start_time}`)
    );

    if (missingBaseSlots.length === 0) {
        return;
    }

    const { data: insertedSlots, error: insertSlotsError } = await supabase
        .from(tables.weekSlots)
        .insert(missingBaseSlots.map((slot: any) => ({
            base_slot_id: slot.id,
            [ownerCol]: slot[ownerCol],
            week_start: weekStart,
            weekday: slot.weekday,
            start_time: slot.start_time,
            capacity: slot.capacity,
            notes: slot.notes,
            created_by: slot.created_by,
        })))
        .select('*');

    if (insertSlotsError || !insertedSlots) {
        console.error('Error cloning base slots into week agenda:', insertSlotsError);
        return;
    }

    const { data: baseEntries } = await supabase
        .from(tables.baseEntries)
        .select('*')
        .in('slot_id', missingBaseSlots.map((slot: any) => slot.id))
        .order('position');

    const insertedByBase = new Map(insertedSlots.map((slot: any) => [slot.base_slot_id, slot.id]));
    const weekEntries = (baseEntries || []).map((entry: any) => ({
        week_slot_id: insertedByBase.get(entry.slot_id),
        student_id: entry.student_id,
        guest_name: entry.guest_name,
        guest_origin: entry.guest_origin,
        position: entry.position,
        status: 'pending',
        notes: entry.notes,
    })).filter((entry: any) => entry.week_slot_id);

    if (weekEntries.length > 0) {
        const { error: entriesError } = await supabase
            .from(tables.weekEntries)
            .insert(weekEntries);

        if (entriesError) {
            console.error('Error cloning base entries into week agenda:', entriesError);
        }
    }
}

export function normalizeSlotPayload(input: {
    ownerCol: 'trainer_id' | 'professional_id';
    ownerId: string;
    weekday: number;
    start_time: string;
    capacity: number;
    notes?: string;
}) {
    return {
        [input.ownerCol]: input.ownerId,
        weekday: input.weekday,
        start_time: normalizeTimeInput(input.start_time),
        capacity: input.capacity,
        notes: input.notes?.trim() || null,
    };
}
