'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { ensureWeekAgendaFromBase, normalizeParticipants, normalizeSlotPayload, validateParticipants } from '@/lib/attendance-store';
import type { AttendancePublicLink, UpsertScheduleSlotInput } from '@/types/database';

async function getAccessContext() {
    const profile = await getProfile();

    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        throw new Error('Nao autorizado');
    }

    const supabase = await createClient();
    const trainerId = profile.role === 'trainer' ? await getTrainerId() : null;

    return {
        supabase,
        profile,
        trainerId,
    };
}

function revalidateAttendanceViews() {
    revalidatePath('/dashboard/manager/attendance');
    revalidatePath('/dashboard/trainer/attendance');
}

function resolveTrainerId(
    role: 'manager' | 'trainer',
    ownTrainerId: string | null,
    inputTrainerId?: string
) {
    const trainerId = role === 'trainer' ? ownTrainerId : inputTrainerId;

    if (!trainerId) {
        throw new Error('Selecione o treinador responsavel');
    }

    return trainerId;
}

async function replaceEntries(
    supabase: any,
    table: 'schedule_base_entries' | 'schedule_week_entries',
    keyName: 'slot_id' | 'week_slot_id',
    slotId: string,
    entries: any[]
) {
    await supabase.from(table).delete().eq(keyName, slotId);

    if (entries.length === 0) {
        return;
    }

    const { error } = await supabase
        .from(table)
        .insert(entries.map((entry) => ({
            ...entry,
            [keyName]: slotId,
        })));

    if (error) {
        console.error(`Error replacing ${table}:`, error);
        throw new Error('Nao foi possivel salvar os participantes do horario');
    }
}

function resolveBatchSlots(input: UpsertScheduleSlotInput) {
    const batch = (input.batch_slots && input.batch_slots.length > 0)
        ? input.batch_slots
        : [{ start_time: input.start_time, capacity: input.capacity }];

    const seen = new Set<string>();

    return batch.map((slot) => {
        const normalized = normalizeSlotPayload({
            trainer_id: '__unused__',
            weekday: input.weekday,
            start_time: slot.start_time,
            capacity: slot.capacity,
            notes: input.notes,
        });

        const key = normalized.start_time;
        if (seen.has(key)) {
            throw new Error('Nao repita o mesmo horario na mesma criacao em lote');
        }
        seen.add(key);

        return {
            start_time: normalized.start_time,
            capacity: normalized.capacity,
        };
    });
}

export async function upsertBaseScheduleSlot(input: UpsertScheduleSlotInput) {
    const { supabase, profile, trainerId } = await getAccessContext();
    validateParticipants(input.entries);

    const assignedTrainerId = resolveTrainerId(profile.role, trainerId, input.trainer_id);
    const batchSlots = resolveBatchSlots(input);
    const slotPayload = normalizeSlotPayload({
        trainer_id: assignedTrainerId,
        weekday: input.weekday,
        start_time: batchSlots[0].start_time,
        capacity: batchSlots[0].capacity,
        notes: input.notes,
    });

    let slotId = input.slot_id;

    if (slotId) {
        const { error } = await supabase
            .from('schedule_base_slots')
            .update(slotPayload)
            .eq('id', slotId);

        if (error) {
            console.error('Error updating base schedule slot:', error);
            throw new Error('Nao foi possivel atualizar o horario fixo');
        }
    } else if (batchSlots.length > 1) {
        const { error } = await supabase
            .from('schedule_base_slots')
            .insert(batchSlots.map((item) => ({
                trainer_id: assignedTrainerId,
                weekday: input.weekday,
                start_time: item.start_time,
                capacity: item.capacity,
                notes: input.notes?.trim() || null,
                created_by: profile.id,
            })));

        if (error) {
            console.error('Error creating base schedule slots:', error);
            throw new Error('Nao foi possivel criar os horarios fixos');
        }

        revalidateAttendanceViews();
        return { success: true };
    } else {
        const { data, error } = await supabase
            .from('schedule_base_slots')
            .insert({
                ...slotPayload,
                created_by: profile.id,
            })
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating base schedule slot:', error);
            throw new Error('Nao foi possivel criar o horario fixo');
        }

        slotId = data.id;
    }

    const ensuredSlotId = slotId;
    if (!ensuredSlotId) {
        throw new Error('Nao foi possivel identificar o horario fixo');
    }

    await replaceEntries(
        supabase,
        'schedule_base_entries',
        'slot_id',
        ensuredSlotId,
        normalizeParticipants(input.entries)
    );

    revalidateAttendanceViews();
    return { success: true };
}

export async function archiveBaseScheduleSlot(slotId: string) {
    const { supabase } = await getAccessContext();

    const { error } = await supabase
        .from('schedule_base_slots')
        .update({ is_active: false })
        .eq('id', slotId);

    if (error) {
        console.error('Error archiving base schedule slot:', error);
        throw new Error('Nao foi possivel remover o horario fixo');
    }

    revalidateAttendanceViews();
    return { success: true };
}

async function upsertWeekScheduleSlotInternal(
    supabase: any,
    input: UpsertScheduleSlotInput,
    trainerId: string,
    createdBy?: string | null
) {
    if (!input.week_start) {
        throw new Error('Semana invalida');
    }

    validateParticipants(input.entries);
    const batchSlots = resolveBatchSlots(input);

    const slotPayload = normalizeSlotPayload({
        trainer_id: trainerId,
        weekday: input.weekday,
        start_time: batchSlots[0].start_time,
        capacity: batchSlots[0].capacity,
        notes: input.notes,
    });

    let slotId = input.slot_id;

    if (slotId) {
        const { error } = await supabase
            .from('schedule_week_slots')
            .update(slotPayload)
            .eq('id', slotId);

        if (error) {
            console.error('Error updating week schedule slot:', error);
            throw new Error('Nao foi possivel atualizar o horario da semana');
        }
    } else if (batchSlots.length > 1) {
        const { error } = await supabase
            .from('schedule_week_slots')
            .insert(batchSlots.map((item) => ({
                trainer_id: trainerId,
                week_start: input.week_start,
                weekday: input.weekday,
                start_time: item.start_time,
                capacity: item.capacity,
                notes: input.notes?.trim() || null,
                created_by: createdBy || null,
            })));

        if (error) {
            console.error('Error creating week schedule slots:', error);
            throw new Error('Nao foi possivel criar os horarios da semana');
        }

        return { success: true };
    } else {
        const { data, error } = await supabase
            .from('schedule_week_slots')
            .insert({
                ...slotPayload,
                week_start: input.week_start,
                created_by: createdBy || null,
            })
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating week schedule slot:', error);
            throw new Error('Nao foi possivel criar o horario da semana');
        }

        slotId = data.id;
    }

    const ensuredSlotId = slotId;
    if (!ensuredSlotId) {
        throw new Error('Nao foi possivel identificar o horario da semana');
    }

    await replaceEntries(
        supabase,
        'schedule_week_entries',
        'week_slot_id',
        ensuredSlotId,
        normalizeParticipants(input.entries, true)
    );

    return { success: true };
}

export async function upsertWeekScheduleSlot(input: UpsertScheduleSlotInput) {
    const { supabase, profile, trainerId } = await getAccessContext();
    const assignedTrainerId = resolveTrainerId(profile.role, trainerId, input.trainer_id);

    await ensureWeekAgendaFromBase(supabase, input.week_start!, profile.role === 'trainer' ? assignedTrainerId : undefined);
    await upsertWeekScheduleSlotInternal(supabase, input, assignedTrainerId, profile.id);
    revalidateAttendanceViews();
    return { success: true };
}

export async function deleteWeekScheduleSlot(slotId: string) {
    const { supabase } = await getAccessContext();

    const { error } = await supabase
        .from('schedule_week_slots')
        .delete()
        .eq('id', slotId);

    if (error) {
        console.error('Error deleting week schedule slot:', error);
        throw new Error('Nao foi possivel remover o horario da semana');
    }

    revalidateAttendanceViews();
    return { success: true };
}

export async function getOrCreateAttendancePublicLink() {
    const { supabase, profile } = await getAccessContext();

    if (profile.role !== 'manager') {
        throw new Error('Nao autorizado');
    }

    const { data: existing } = await supabase
        .from('attendance_public_links')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) {
        return existing as AttendancePublicLink;
    }

    const accessToken = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabase
        .from('attendance_public_links')
        .insert({
            label: 'Recepcao',
            access_token: accessToken,
            created_by: profile.id,
        })
        .select('*')
        .single();

    if (error || !data) {
        console.error('Error creating attendance public link:', error);
        throw new Error('Nao foi possivel gerar o link publico');
    }

    revalidateAttendanceViews();
    return data as AttendancePublicLink;
}

export async function regenerateAttendancePublicLink() {
    const { supabase, profile } = await getAccessContext();

    if (profile.role !== 'manager') {
        throw new Error('Nao autorizado');
    }

    await supabase
        .from('attendance_public_links')
        .update({ is_active: false })
        .eq('is_active', true);

    const accessToken = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabase
        .from('attendance_public_links')
        .insert({
            label: 'Recepcao',
            access_token: accessToken,
            created_by: profile.id,
        })
        .select('*')
        .single();

    if (error || !data) {
        console.error('Error regenerating attendance public link:', error);
        throw new Error('Nao foi possivel regenerar o link publico');
    }

    revalidateAttendanceViews();
    return data as AttendancePublicLink;
}

async function assertPublicLink(accessToken: string) {
    const admin = createAdminClient();
    const { data: link } = await admin
        .from('attendance_public_links')
        .select('id')
        .eq('access_token', accessToken)
        .eq('is_active', true)
        .maybeSingle();

    if (!link) {
        throw new Error('Link de agenda invalido');
    }

    return admin;
}

export async function upsertPublicBaseScheduleSlot(accessToken: string, input: UpsertScheduleSlotInput) {
    const admin = await assertPublicLink(accessToken);
    const assignedTrainerId = resolveTrainerId('manager', null, input.trainer_id);
    const batchSlots = resolveBatchSlots(input);
    const slotPayload = normalizeSlotPayload({
        trainer_id: assignedTrainerId,
        weekday: input.weekday,
        start_time: batchSlots[0].start_time,
        capacity: batchSlots[0].capacity,
        notes: input.notes,
    });

    validateParticipants(input.entries);

    let slotId = input.slot_id;

    if (slotId) {
        const { error } = await admin
            .from('schedule_base_slots')
            .update(slotPayload)
            .eq('id', slotId);

        if (error) {
            console.error('Error updating public base schedule slot:', error);
            throw new Error('Nao foi possivel atualizar o horario fixo');
        }
    } else if (batchSlots.length > 1) {
        const { error } = await admin
            .from('schedule_base_slots')
            .insert(batchSlots.map((item) => ({
                trainer_id: assignedTrainerId,
                weekday: input.weekday,
                start_time: item.start_time,
                capacity: item.capacity,
                notes: input.notes?.trim() || null,
                created_by: null,
            })));

        if (error) {
            console.error('Error creating public base schedule slots:', error);
            throw new Error('Nao foi possivel criar os horarios fixos');
        }

        return { success: true };
    } else {
        const { data, error } = await admin
            .from('schedule_base_slots')
            .insert({
                ...slotPayload,
                created_by: null,
            })
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating public base schedule slot:', error);
            throw new Error('Nao foi possivel criar o horario fixo');
        }

        slotId = data.id;
    }

    if (!slotId) {
        throw new Error('Nao foi possivel identificar o horario fixo');
    }

    await replaceEntries(
        admin,
        'schedule_base_entries',
        'slot_id',
        slotId,
        normalizeParticipants(input.entries)
    );

    return { success: true };
}

export async function archivePublicBaseScheduleSlot(accessToken: string, slotId: string) {
    const admin = await assertPublicLink(accessToken);
    const { error } = await admin
        .from('schedule_base_slots')
        .update({ is_active: false })
        .eq('id', slotId);

    if (error) {
        console.error('Error archiving public base schedule slot:', error);
        throw new Error('Nao foi possivel remover o horario fixo');
    }

    return { success: true };
}

export async function upsertPublicWeekScheduleSlot(accessToken: string, input: UpsertScheduleSlotInput) {
    const admin = await assertPublicLink(accessToken);
    await ensureWeekAgendaFromBase(admin, input.week_start!);
    await upsertWeekScheduleSlotInternal(admin, input, resolveTrainerId('manager', null, input.trainer_id), null);
    return { success: true };
}

export async function deletePublicWeekScheduleSlot(accessToken: string, slotId: string) {
    const admin = await assertPublicLink(accessToken);
    const { error } = await admin.from('schedule_week_slots').delete().eq('id', slotId);

    if (error) {
        console.error('Error deleting public week slot:', error);
        throw new Error('Nao foi possivel remover o horario da semana');
    }

    return { success: true };
}

// ── Granular entry actions ──────────────────────────────────────────

async function addEntryInternal(
    supabase: any,
    slotId: string,
    slotType: 'base' | 'week',
    studentId?: string,
    guestName?: string,
    guestOrigin?: string,
) {
    const slotTable = slotType === 'base' ? 'schedule_base_slots' : 'schedule_week_slots';
    const entryTable = slotType === 'base' ? 'schedule_base_entries' : 'schedule_week_entries';
    const fkColumn = slotType === 'base' ? 'slot_id' : 'week_slot_id';

    const { data: slot, error: slotError } = await supabase
        .from(slotTable)
        .select('capacity')
        .eq('id', slotId)
        .single();

    if (slotError || !slot) {
        throw new Error('Horario nao encontrado');
    }

    const { count } = await supabase
        .from(entryTable)
        .select('id', { count: 'exact', head: true })
        .eq(fkColumn, slotId);

    if ((count ?? 0) >= slot.capacity) {
        throw new Error('Horario lotado');
    }

    const nextPosition = (count ?? 0) + 1;

    const entry: Record<string, unknown> = {
        [fkColumn]: slotId,
        student_id: studentId || null,
        guest_name: studentId ? null : guestName?.trim() || null,
        guest_origin: studentId ? null : guestOrigin?.trim() || null,
        position: nextPosition,
        notes: null,
    };

    if (slotType === 'week') {
        entry.status = 'pending';
    }

    const { error } = await supabase.from(entryTable).insert(entry);

    if (error) {
        console.error(`Error adding entry to ${entryTable}:`, error);
        throw new Error('Nao foi possivel adicionar o participante');
    }
}

async function removeEntryInternal(
    supabase: any,
    entryId: string,
    slotType: 'base' | 'week',
) {
    const entryTable = slotType === 'base' ? 'schedule_base_entries' : 'schedule_week_entries';
    const fkColumn = slotType === 'base' ? 'slot_id' : 'week_slot_id';

    const { data: entry, error: fetchError } = await supabase
        .from(entryTable)
        .select(`id, ${fkColumn}`)
        .eq('id', entryId)
        .single();

    if (fetchError || !entry) {
        throw new Error('Participante nao encontrado');
    }

    const slotId = entry[fkColumn];

    const { error: deleteError } = await supabase
        .from(entryTable)
        .delete()
        .eq('id', entryId);

    if (deleteError) {
        console.error(`Error removing entry from ${entryTable}:`, deleteError);
        throw new Error('Nao foi possivel remover o participante');
    }

    const { data: remaining } = await supabase
        .from(entryTable)
        .select('id')
        .eq(fkColumn, slotId)
        .order('position');

    if (remaining && remaining.length > 0) {
        await Promise.all(
            remaining.map((row: any, index: number) =>
                supabase
                    .from(entryTable)
                    .update({ position: index + 1 })
                    .eq('id', row.id)
            )
        );
    }
}

export async function addEntryToSlot(input: {
    slotId: string;
    slotType: 'base' | 'week';
    studentId?: string;
    guestName?: string;
    guestOrigin?: string;
}) {
    const { supabase, profile, trainerId } = await getAccessContext();
    await addEntryInternal(supabase, input.slotId, input.slotType, input.studentId, input.guestName, input.guestOrigin);

    // Log schedule activity for trainers (fire-and-forget)
    if (profile.role === 'trainer' && trainerId) {
        try {
            const admin = createAdminClient();
            await admin.from('trainer_activity_log').insert({
                trainer_id: trainerId,
                activity_type: 'schedule_update',
                metadata: {
                    action: 'add_entry',
                    slot_type: input.slotType,
                    student_id: input.studentId || null,
                    guest_name: input.guestName || null,
                },
            });
        } catch {
            // Silent failure
        }
    }

    revalidateAttendanceViews();
    return { success: true };
}

export async function removeEntryFromSlot(input: {
    entryId: string;
    slotType: 'base' | 'week';
}) {
    const { supabase, profile, trainerId } = await getAccessContext();
    await removeEntryInternal(supabase, input.entryId, input.slotType);

    // Log schedule activity for trainers (fire-and-forget)
    if (profile.role === 'trainer' && trainerId) {
        try {
            const admin = createAdminClient();
            await admin.from('trainer_activity_log').insert({
                trainer_id: trainerId,
                activity_type: 'schedule_update',
                metadata: {
                    action: 'remove_entry',
                    slot_type: input.slotType,
                    entry_id: input.entryId,
                },
            });
        } catch {
            // Silent failure
        }
    }

    revalidateAttendanceViews();
    return { success: true };
}

export async function addPublicEntryToSlot(accessToken: string, input: {
    slotId: string;
    slotType: 'base' | 'week';
    studentId?: string;
    guestName?: string;
    guestOrigin?: string;
}) {
    const admin = await assertPublicLink(accessToken);
    await addEntryInternal(admin, input.slotId, input.slotType, input.studentId, input.guestName, input.guestOrigin);
    return { success: true };
}

export async function removePublicEntryFromSlot(accessToken: string, input: {
    entryId: string;
    slotType: 'base' | 'week';
}) {
    const admin = await assertPublicLink(accessToken);
    await removeEntryInternal(admin, input.entryId, input.slotType);
    return { success: true };
}

// ── Attendance marking actions ──────────────────────────────────────

async function markAttendanceInternal(
    supabase: any,
    entryId: string,
    status: 'pending' | 'present' | 'absent',
    markedBy?: string | null,
) {
    const { error } = await supabase
        .from('schedule_week_entries')
        .update({
            status,
            marked_by: status === 'pending' ? null : markedBy || null,
            marked_at: status === 'pending' ? null : new Date().toISOString(),
        })
        .eq('id', entryId);

    if (error) {
        console.error('Error marking attendance:', error);
        throw new Error('Nao foi possivel marcar a presenca');
    }
}

export async function markAttendance(input: {
    entryId: string;
    status: 'pending' | 'present' | 'absent';
}) {
    const { supabase, profile } = await getAccessContext();
    await markAttendanceInternal(supabase, input.entryId, input.status, profile.id);
    revalidateAttendanceViews();
    return { success: true };
}

export async function markPublicAttendance(input: {
    entryId: string;
    status: 'pending' | 'present' | 'absent';
    token: string;
}) {
    const admin = await assertPublicLink(input.token);
    await markAttendanceInternal(admin, input.entryId, input.status);
    return { success: true };
}

async function markAllPresentInternal(
    supabase: any,
    weekSlotId: string,
    markedBy?: string | null,
) {
    const { error } = await supabase
        .from('schedule_week_entries')
        .update({
            status: 'present',
            marked_by: markedBy || null,
            marked_at: new Date().toISOString(),
        })
        .eq('week_slot_id', weekSlotId)
        .neq('status', 'present');

    if (error) {
        console.error('Error marking all present:', error);
        throw new Error('Nao foi possivel marcar todos como presentes');
    }
}

export async function markAllPresent(input: { weekSlotId: string }) {
    const { supabase, profile } = await getAccessContext();
    await markAllPresentInternal(supabase, input.weekSlotId, profile.id);
    revalidateAttendanceViews();
    return { success: true };
}

export async function markAllPublicPresent(input: { weekSlotId: string; token: string }) {
    const admin = await assertPublicLink(input.token);
    await markAllPresentInternal(admin, input.weekSlotId);
    return { success: true };
}
