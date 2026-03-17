import { normalizeTimeInput } from '@/lib/attendance';
import type { ScheduleParticipant } from '@/types/database';

type SupabaseLike = any;

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
    trainerId?: string | null
) {
    let baseSlotsQuery = supabase
        .from('schedule_base_slots')
        .select('*')
        .eq('is_active', true);

    let existingWeekSlotsQuery = supabase
        .from('schedule_week_slots')
        .select('*')
        .eq('week_start', weekStart);

    if (trainerId) {
        baseSlotsQuery = baseSlotsQuery.eq('trainer_id', trainerId);
        existingWeekSlotsQuery = existingWeekSlotsQuery.eq('trainer_id', trainerId);
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
            `${slot.trainer_id}|${slot.weekday}|${slot.start_time}`
        )
    );

    const missingBaseSlots = (baseSlots || []).filter((slot: any) =>
        !existingByBase.has(slot.id) &&
        !existingByKey.has(`${slot.trainer_id}|${slot.weekday}|${slot.start_time}`)
    );

    if (missingBaseSlots.length === 0) {
        return;
    }

    const { data: insertedSlots, error: insertSlotsError } = await supabase
        .from('schedule_week_slots')
        .insert(missingBaseSlots.map((slot: any) => ({
            base_slot_id: slot.id,
            trainer_id: slot.trainer_id,
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
        .from('schedule_base_entries')
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
            .from('schedule_week_entries')
            .insert(weekEntries);

        if (entriesError) {
            console.error('Error cloning base entries into week agenda:', entriesError);
        }
    }
}

export function normalizeSlotPayload(input: {
    trainer_id: string;
    weekday: number;
    start_time: string;
    capacity: number;
    notes?: string;
}) {
    return {
        trainer_id: input.trainer_id,
        weekday: input.weekday,
        start_time: normalizeTimeInput(input.start_time),
        capacity: input.capacity,
        notes: input.notes?.trim() || null,
    };
}
