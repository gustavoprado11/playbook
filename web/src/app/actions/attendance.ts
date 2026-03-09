'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeTimeInput } from '@/lib/attendance';
import { createClient } from '@/lib/supabase/server';
import type { AttendancePublicLink, AttendanceStatus, SetAttendanceStatusInput, UpsertWeeklyScheduleInput, WeeklyScheduleTemplate } from '@/types/database';

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

function assertParticipantInput(input: UpsertWeeklyScheduleInput) {
    const hasStudent = Boolean(input.student_id);
    const hasGuest = Boolean(input.guest_name?.trim());

    if (hasStudent === hasGuest) {
        throw new Error('Informe um aluno cadastrado ou um nome avulso');
    }
}

export async function upsertWeeklyScheduleSlot(input: UpsertWeeklyScheduleInput) {
    const { supabase, profile, trainerId } = await getAccessContext();
    assertParticipantInput(input);

    const assignedTrainerId = profile.role === 'trainer' ? trainerId : input.trainer_id;

    if (!assignedTrainerId) {
        throw new Error('Selecione o treinador responsavel pelo horario');
    }

    const payload = {
        student_id: input.student_id || null,
        guest_name: input.student_id ? null : input.guest_name?.trim() || null,
        guest_origin: input.student_id ? null : input.guest_origin?.trim() || null,
        trainer_id: assignedTrainerId,
        weekday: input.weekday,
        start_time: normalizeTimeInput(input.start_time),
        notes: input.notes?.trim() || null,
        created_by: profile.id,
    };

    if (input.id) {
        const { error } = await supabase
            .from('weekly_schedule_templates')
            .update(payload)
            .eq('id', input.id);

        if (error) {
            console.error('Error updating schedule slot:', error);
            throw new Error('Nao foi possivel atualizar o horario base');
        }
    } else {
        const { error } = await supabase
            .from('weekly_schedule_templates')
            .insert(payload);

        if (error) {
            console.error('Error creating schedule slot:', error);
            throw new Error('Nao foi possivel criar o horario base');
        }
    }

    revalidateAttendanceViews();
    return { success: true };
}

export async function archiveWeeklyScheduleSlot(slotId: string) {
    const { supabase } = await getAccessContext();

    const { error } = await supabase
        .from('weekly_schedule_templates')
        .update({ is_active: false })
        .eq('id', slotId);

    if (error) {
        console.error('Error archiving schedule slot:', error);
        throw new Error('Nao foi possivel remover o horario base');
    }

    revalidateAttendanceViews();
    return { success: true };
}

async function getScheduleTemplateForStatus(
    scheduleTemplateId: string,
    useAdmin = false
): Promise<Pick<WeeklyScheduleTemplate, 'id' | 'student_id' | 'guest_name' | 'guest_origin' | 'trainer_id' | 'start_time'> | null> {
    const client = useAdmin ? createAdminClient() : await createClient();
    const { data, error } = await client
        .from('weekly_schedule_templates')
        .select('id, student_id, guest_name, guest_origin, trainer_id, start_time')
        .eq('id', scheduleTemplateId)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return null;
    }

    return data as Pick<WeeklyScheduleTemplate, 'id' | 'student_id' | 'guest_name' | 'guest_origin' | 'trainer_id' | 'start_time'>;
}

async function persistAttendanceStatus(
    template: Pick<WeeklyScheduleTemplate, 'id' | 'student_id' | 'guest_name' | 'guest_origin' | 'trainer_id' | 'start_time'>,
    sessionDate: string,
    status: AttendanceStatus,
    markedBy: string | null,
    useAdmin = false
) {
    const client = useAdmin ? createAdminClient() : await createClient();

    if (status === 'pending') {
        const { error } = await client
            .from('attendance_records')
            .delete()
            .eq('schedule_template_id', template.id)
            .eq('session_date', sessionDate);

        if (error) {
            console.error('Error clearing attendance status:', error);
            throw new Error('Nao foi possivel limpar a marcacao');
        }

        return;
    }

    const { error } = await client
        .from('attendance_records')
        .upsert(
            {
                schedule_template_id: template.id,
                student_id: template.student_id,
                guest_name: template.guest_name,
                guest_origin: template.guest_origin,
                trainer_id: template.trainer_id,
                session_date: sessionDate,
                start_time: template.start_time,
                status,
                marked_by: markedBy,
                marked_at: new Date().toISOString(),
            },
            { onConflict: 'schedule_template_id,session_date' }
        );

    if (error) {
        console.error('Error setting attendance status:', error);
        throw new Error('Nao foi possivel salvar a presenca');
    }
}

export async function setAttendanceStatus(input: SetAttendanceStatusInput) {
    const { profile } = await getAccessContext();
    const template = await getScheduleTemplateForStatus(input.schedule_template_id);

    if (!template) {
        throw new Error('Horario base nao encontrado');
    }

    await persistAttendanceStatus(template, input.session_date, input.status, profile.id);
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

export async function setPublicAttendanceStatus(accessToken: string, input: SetAttendanceStatusInput) {
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

    const template = await getScheduleTemplateForStatus(input.schedule_template_id, true);

    if (!template) {
        throw new Error('Horario base nao encontrado');
    }

    await persistAttendanceStatus(template, input.session_date, input.status, null, true);
    return { success: true };
}
