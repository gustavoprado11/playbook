'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, getTrainerId } from '@/app/actions/auth';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { CreateTrainerInput, CreateStudentInput, StudentStatus, UpdateStudentInput } from '@/types/database';

// =====================================================
// TRAINER ACTIONS
// =====================================================

export async function createTrainer(formData: FormData) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const email = normalizeEmail(formData.get('email') as string);
    const full_name = formData.get('full_name') as string;
    const password = formData.get('password') as string;
    const confirm_password = formData.get('confirm_password') as string;
    const start_date = formData.get('start_date') as string || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') as string;

    // Validate required fields
    if (!email || !full_name) {
        return { error: 'Nome e e-mail são obrigatórios' };
    }

    if (!isValidEmail(email)) {
        return { error: 'Digite um e-mail valido, por exemplo nome@dominio.com' };
    }

    if (!password || password.length < 6) {
        return { error: 'A senha deve ter no mínimo 6 caracteres' };
    }

    if (password !== confirm_password) {
        return { error: 'As senhas não coincidem' };
    }

    // Check if SUPABASE_SERVICE_ROLE_KEY is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
            error: 'Não foi possível criar o treinador no momento. Verifique a configuração do sistema ou tente novamente.'
        };
    }

    try {
        // Create admin client for user management
        const adminClient = createAdminClient();
        const supabase = await createClient();

        // Check if user already exists
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        let userId: string;

        if (existingUser) {
            // User already exists in Auth
            userId = existingUser.id;

            // Check if they already have a trainer record
            const { data: existingTrainer } = await supabase
                .from('trainers')
                .select('id')
                .eq('profile_id', userId)
                .single();

            if (existingTrainer) {
                return { error: 'Este e-mail já está cadastrado como treinador' };
            }
        } else {
            // Create user with admin API
            const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name,
                    role: 'trainer',
                },
            });

            if (createError) {
                console.error('Error creating user:', createError);

                // Check if it's a duplicate user error
                if (createError.message?.includes('already been registered')) {
                    return { error: 'Este e-mail já está cadastrado no sistema.' };
                }

                return { error: 'Não foi possível criar o usuário. Verifique se o e-mail é válido.' };
            }

            if (!userData?.user) {
                return { error: 'Erro ao criar usuário. Tente novamente.' };
            }

            userId = userData.user.id;

            // Profile is created automatically by the database trigger (handle_new_user)
            // Just verify it exists and has the correct role
            const { data: createdProfile } = await adminClient
                .from('profiles')
                .select('id, role')
                .eq('id', userId)
                .single();

            if (!createdProfile) {
                // Trigger didn't fire — create profile manually as fallback
                const { error: profileError } = await adminClient
                    .from('profiles')
                    .upsert({
                        id: userId,
                        email,
                        full_name,
                        role: 'trainer',
                    });

                if (profileError) {
                    console.error('Error creating profile:', profileError);
                    await adminClient.auth.admin.deleteUser(userId);
                    return { error: 'Erro ao criar perfil do treinador. Tente novamente.' };
                }
            }
        }

        // Create trainer record
        const { error: trainerError } = await supabase
            .from('trainers')
            .insert({
                profile_id: userId,
                start_date,
                notes: notes || null,
            });

        if (trainerError) {
            console.error('Error creating trainer:', trainerError);
            return { error: 'Erro ao criar registro do treinador. Tente novamente.' };
        }

        revalidatePath('/dashboard/manager/trainers');
        redirect('/dashboard/manager/trainers');
    } catch (error) {
        // Re-throw redirect exceptions (Next.js uses exceptions for flow control)
        if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
            throw error;
        }
        // Also check for the digest property that Next.js uses
        if (typeof error === 'object' && error !== null && 'digest' in error) {
            const digest = (error as { digest?: string }).digest;
            if (digest?.startsWith('NEXT_REDIRECT')) {
                throw error;
            }
        }

        console.error('Unexpected error creating trainer:', error);
        return {
            error: 'Não foi possível criar o treinador no momento. Verifique a configuração do sistema ou tente novamente.'
        };
    }
}

export async function updateTrainer(trainerId: string, data: { full_name?: string; email?: string; start_date?: string; notes?: string }) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    if (data.email) {
        data.email = normalizeEmail(data.email);

        if (!isValidEmail(data.email)) {
            return { error: 'Digite um e-mail valido, por exemplo nome@dominio.com' };
        }
    }

    const adminClient = createAdminClient();
    const supabase = await createClient();

    // Get trainer to find profile_id
    const { data: trainer, error: fetchError } = await supabase
        .from('trainers')
        .select('profile_id')
        .eq('id', trainerId)
        .single();

    if (fetchError || !trainer) {
        return { error: 'Treinador não encontrado' };
    }

    // 1. Update Profile (Name/Email)
    if (data.full_name || data.email) {
        const { error: profileError } = await adminClient
            .from('profiles')
            .update({
                full_name: data.full_name,
                email: data.email
            })
            .eq('id', trainer.profile_id);

        if (profileError) {
            console.error('Error updating profile:', profileError);
            return { error: 'Erro ao atualizar perfil do treinador.' };
        }

        // Also update Auth User if email (optional, depends on if we want to change login)
        // Ignoring Auth Event update for now to avoid complexity with re-verification
    }

    // 2. Update Trainer Record
    if (data.start_date || data.notes !== undefined) {
        const { error: trainerError } = await supabase
            .from('trainers')
            .update({
                start_date: data.start_date,
                notes: data.notes
            })
            .eq('id', trainerId);

        if (trainerError) {
            console.error('Error updating trainer:', trainerError);
            return { error: 'Erro ao atualizar dados do treinador.' };
        }
    }

    revalidatePath('/dashboard/manager/trainers');
    return { success: true };
}

export async function resetTrainerPassword(trainerId: string, password: string, confirmPassword: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    if (!password || password.length < 6) {
        return { error: 'A senha deve ter no mínimo 6 caracteres' };
    }

    if (password !== confirmPassword) {
        return { error: 'As senhas não coincidem' };
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get trainer to find profile_id (which is the auth user ID)
    const { data: trainer, error: fetchError } = await supabase
        .from('trainers')
        .select('profile_id')
        .eq('id', trainerId)
        .single();

    if (fetchError || !trainer) {
        return { error: 'Treinador não encontrado' };
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
        trainer.profile_id,
        { password }
    );

    if (updateError) {
        console.error('Error resetting password:', updateError);
        return { error: 'Erro ao redefinir senha. Tente novamente.' };
    }

    return { success: true };
}

export async function toggleTrainerStatus(trainerId: string, isActive: boolean) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const { error } = await supabase
        .from('trainers')
        .update({ is_active: isActive })
        .eq('id', trainerId);

    if (error) {
        return { error: `Erro ao ${isActive ? 'ativar' : 'arquivar'} treinador.` };
    }

    revalidatePath('/dashboard/manager/trainers');
    return { success: true };
}

// =====================================================
// STUDENT ACTIONS
// =====================================================

export async function createStudent(formData: FormData) {
    const profile = await getProfile();
    if (!profile || !['manager', 'trainer'].includes(profile.role)) {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();
    const ownTrainerId = profile.role === 'trainer' ? await getTrainerId() : null;

    if (profile.role === 'trainer' && !ownTrainerId) {
        return { error: 'Perfil de treinador não encontrado' };
    }

    const full_name = formData.get('full_name') as string;
    const email = formData.get('email') as string || null;
    const phone = formData.get('phone') as string || null;
    const trainer_id = profile.role === 'trainer'
        ? ownTrainerId!
        : formData.get('trainer_id') as string;
    const origin = formData.get('origin') as 'organic' | 'referral' | 'marketing';
    const referred_by_trainer_id = profile.role === 'trainer' && origin === 'referral'
        ? ownTrainerId
        : formData.get('referred_by_trainer_id') as string || null;
    const start_date = formData.get('start_date') as string || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') as string || null;

    const { data: newStudent, error } = await supabase
        .from('students')
        .insert({
            full_name,
            email,
            phone,
            trainer_id,
            origin,
            referred_by_trainer_id: origin === 'referral' ? referred_by_trainer_id : null,
            start_date,
            notes,
        })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    // Log student registration activity (fire-and-forget)
    try {
        const admin = createAdminClient();
        await admin.from('trainer_activity_log').insert({
            trainer_id,
            activity_type: 'student_registered',
            metadata: {
                student_id: newStudent?.id || null,
                student_name: full_name,
            },
        });
    } catch {
        // Silent failure
    }

    revalidatePath('/dashboard/manager/students');
    revalidatePath('/dashboard/trainer/students');
    redirect(profile.role === 'trainer' ? '/dashboard/trainer/students' : '/dashboard/manager/students');
}

// Imports already at top of file


export async function updateStudent(
    studentId: string,
    data: UpdateStudentInput
) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        throw new Error('Não autorizado');
    }

    const supabase = await createClient();

    // Fetch current state to compare for events
    const { data: currentStudent, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

    if (fetchError || !currentStudent) {
        throw new Error('Alesso não encontrado');
    }

    const updates: any = { ...data };
    const eventsToLog: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Handle Status Change Logic
    if (data.status && data.status !== currentStudent.status) {
        // Status Event
        eventsToLog.push({
            student_id: studentId,
            event_type: 'status_change',
            old_value: { status: currentStudent.status },
            new_value: { status: data.status },
            event_date: today,
            created_by: profile.id
        });

        if (data.status === 'cancelled') {
            // Ensure end_date is set
            updates.end_date = data.end_date || today;
        } else if (data.status === 'active' && currentStudent.status === 'paused') {
            // Reactivating: Keeps history but maybe clear end_date if it was set?
            // "NÃO apagar end_date histórico" - OK, we accept potentially existing end_date or ignore it
            // Code doesn't explicitly clear it unless we want to "reset" the churn date.
            // If they were cancelled -> active (reactivation after churn), that's different.
            // But rule says Paused -> Active: "NÃO apagar end_date histórico".
            // Since end_date is usually for CANCELLATION, paused usually doesn't set it.
            // If they were cancelled before, end_date was set. Reactivating -> likely new start?
            // For now, adhere to explicit instruction: DO NOT clear.
        }
    }

    // Handle Trainer Change Logic
    if (data.trainer_id && data.trainer_id !== currentStudent.trainer_id) {
        eventsToLog.push({
            student_id: studentId,
            event_type: 'trainer_change',
            old_value: { trainer_id: currentStudent.trainer_id },
            new_value: { trainer_id: data.trainer_id },
            event_date: today,
            created_by: profile.id
        });
    }

    // Prepare Update Object (filtering undefined)
    const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Transaction-like update (Events first or after? Events usually after successful update, but parallel is fine)

    // 1. Update Student
    const { error: updateError } = await supabase
        .from('students')
        .update(cleanUpdates)
        .eq('id', studentId);

    if (updateError) {
        throw new Error(`Erro ao atualizar aluno: ${updateError.message}`);
    }

    // 2. Insert Events
    if (eventsToLog.length > 0) {
        const { error: eventError } = await supabase
            .from('student_events')
            .insert(eventsToLog);

        if (eventError) console.error('Error logging events:', eventError);
    }

    revalidatePath('/dashboard/manager/students');
    return { success: true };
}

export async function archiveStudent(studentId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        throw new Error('Não autorizado');
    }

    const supabase = await createClient();

    const { error } = await supabase
        .from('students')
        .update({ is_archived: true })
        .eq('id', studentId);

    if (error) {
        throw new Error(`Erro ao arquivar aluno: ${error.message}`);
    }

    revalidatePath('/dashboard/manager/students');
    return { success: true };
}

export async function unarchiveStudent(studentId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        throw new Error('Não autorizado');
    }

    const supabase = await createClient();

    const { error } = await supabase
        .from('students')
        .update({ is_archived: false })
        .eq('id', studentId);

    if (error) {
        throw new Error(`Erro ao desarquivar aluno: ${error.message}`);
    }

    revalidatePath('/dashboard/manager/students');
    return { success: true };
}

// =====================================================
// TRAINER: ARCHIVE OWN STUDENT
// =====================================================

export async function trainerArchiveStudent(studentId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        throw new Error('Não autorizado');
    }

    const trainerId = await getTrainerId();
    if (!trainerId) {
        throw new Error('Perfil de treinador não encontrado');
    }

    const supabase = await createClient();

    // Verify student belongs to this trainer
    const { data: student, error: fetchError } = await supabase
        .from('students')
        .select('id, trainer_id, full_name')
        .eq('id', studentId)
        .single();

    if (fetchError || !student) {
        throw new Error('Aluno não encontrado');
    }

    if (student.trainer_id !== trainerId) {
        throw new Error('Você só pode arquivar alunos da sua carteira');
    }

    // Archive the student (no status change, no event logged)
    const { error: archiveError } = await supabase
        .from('students')
        .update({ is_archived: true })
        .eq('id', studentId);

    if (archiveError) {
        throw new Error('Erro ao arquivar aluno');
    }

    // Clean up schedule entries using admin client (bypasses RLS for entries in other trainers' slots)
    const admin = createAdminClient();

    await admin
        .from('schedule_base_entries')
        .delete()
        .eq('student_id', studentId);

    await admin
        .from('schedule_week_entries')
        .delete()
        .eq('student_id', studentId);

    // Log archive activity (fire-and-forget)
    try {
        await admin.from('trainer_activity_log').insert({
            trainer_id: trainerId,
            activity_type: 'student_archived',
            metadata: {
                student_id: studentId,
                student_name: student.full_name,
            },
        });
    } catch {
        // Silent failure
    }

    revalidatePath('/dashboard/trainer/students');
    revalidatePath('/dashboard/trainer/attendance');
    revalidatePath('/dashboard/manager/attendance');
    return { success: true };
}

// =====================================================
// SNAPSHOT ACTIONS
// =====================================================

export async function generateSnapshot(trainerId: string, referenceMonth: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .rpc('generate_performance_snapshot', {
            p_trainer_id: trainerId,
            p_reference_month: referenceMonth,
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/manager');
    return { success: true, snapshotId: data };
}

export async function generateAllSnapshots(referenceMonth: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    // Get all active trainers
    const { data: trainers } = await supabase
        .from('trainers')
        .select('id')
        .eq('is_active', true);

    if (!trainers || trainers.length === 0) {
        return { error: 'Nenhum treinador ativo encontrado' };
    }

    // Generate snapshot for each trainer
    const results = await Promise.all(
        trainers.map(async (trainer) => {
            const result = await generateSnapshot(trainer.id, referenceMonth);
            return { trainerId: trainer.id, ...result };
        })
    );

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
        return { error: `${errors.length} erros ao gerar snapshots` };
    }

    return { success: true, count: results.length };
}

export async function finalizeSnapshot(trainerId: string, referenceMonth: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .rpc('finalize_performance_snapshot', {
            p_trainer_id: trainerId,
            p_reference_month: referenceMonth,
            p_finalized_by: profile.id,
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/manager');
    return { success: true };
}

// =====================================================
// TRAINER ACTIVITY DETAILS
// =====================================================

export type ActivityDetail = {
    id: string;
    occurredAt: string;
    activityType?: string;
    studentName?: string;
    detail: string;
};

type ActivityType = 'login' | 'result_management' | 'student_status_update' | 'referral_registered' | 'student_registered' | 'schedule_update' | 'student_archived';

const STATUS_LABELS: Record<string, string> = {
    active: 'ativo',
    cancelled: 'cancelado',
    paused: 'pausado',
};

export async function getTrainerActivityDetails(input: {
    trainerId: string;
    activityType: ActivityType;
    limit?: number;
}): Promise<ActivityDetail[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        throw new Error('Não autorizado');
    }

    const supabase = await createClient();
    const limit = input.limit || 10;

    const { data: logs, error } = await supabase
        .from('trainer_activity_log')
        .select('id, occurred_at, metadata')
        .eq('trainer_id', input.trainerId)
        .eq('activity_type', input.activityType)
        .order('occurred_at', { ascending: false })
        .limit(limit);

    if (error || !logs) {
        return [];
    }

    // Collect student IDs to resolve names in a single query
    const studentIds = new Set<string>();
    for (const log of logs) {
        const meta = log.metadata as Record<string, unknown> | null;
        if (meta?.student_id && typeof meta.student_id === 'string') {
            studentIds.add(meta.student_id);
        }
    }

    const studentNames = new Map<string, string>();
    if (studentIds.size > 0) {
        const { data: students } = await supabase
            .from('students')
            .select('id, full_name')
            .in('id', Array.from(studentIds));

        if (students) {
            for (const s of students) {
                studentNames.set(s.id, s.full_name);
            }
        }
    }

    return logs.map((log) => {
        const meta = log.metadata as Record<string, unknown> | null;
        const studentId = (meta?.student_id as string) || undefined;
        const studentName = studentId
            ? studentNames.get(studentId) || (meta?.student_name as string) || 'Aluno removido'
            : undefined;

        let detail: string;
        switch (input.activityType) {
            case 'login':
                detail = 'Login realizado';
                break;
            case 'referral_registered':
                detail = `${studentName || 'Aluno'} registrado como indicação`;
                break;
            case 'student_status_update': {
                const oldStatus = STATUS_LABELS[(meta?.old_status as string) || ''] || (meta?.old_status as string) || '?';
                const newStatus = STATUS_LABELS[(meta?.new_status as string) || ''] || (meta?.new_status as string) || '?';
                detail = `${studentName || 'Aluno'}: ${oldStatus} → ${newStatus}`;
                break;
            }
            case 'result_management':
                detail = `Avaliação registrada para ${studentName || 'aluno'}`;
                break;
            case 'student_registered':
                detail = `${studentName || 'Aluno'} cadastrado`;
                break;
            case 'schedule_update': {
                const action = meta?.action as string;
                if (action === 'add_entry') {
                    detail = studentName ? `${studentName} adicionado ao horário` : 'Aluno adicionado ao horário';
                } else if (action === 'remove_entry') {
                    detail = 'Aluno removido do horário';
                } else {
                    detail = 'Agenda atualizada';
                }
                break;
            }
            case 'student_archived':
                detail = `${studentName || 'Aluno'} arquivado`;
                break;
            default:
                detail = 'Atividade registrada';
        }

        return {
            id: log.id,
            occurredAt: log.occurred_at,
            activityType: input.activityType,
            studentName,
            detail,
        };
    });
}

export async function getTrainerFullHistory(input: {
    trainerId: string;
    limit?: number;
}): Promise<(ActivityDetail & { activityType: string })[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        throw new Error('Não autorizado');
    }

    const supabase = await createClient();
    const limit = input.limit || 20;

    const { data: logs, error } = await supabase
        .from('trainer_activity_log')
        .select('id, occurred_at, activity_type, metadata')
        .eq('trainer_id', input.trainerId)
        .order('occurred_at', { ascending: false })
        .limit(limit);

    if (error || !logs) return [];

    const studentIds = new Set<string>();
    for (const log of logs) {
        const meta = log.metadata as Record<string, unknown> | null;
        if (meta?.student_id && typeof meta.student_id === 'string') {
            studentIds.add(meta.student_id);
        }
    }

    const studentNames = new Map<string, string>();
    if (studentIds.size > 0) {
        const { data: students } = await supabase
            .from('students')
            .select('id, full_name')
            .in('id', Array.from(studentIds));
        if (students) {
            for (const s of students) studentNames.set(s.id, s.full_name);
        }
    }

    return logs.map((log) => {
        const meta = log.metadata as Record<string, unknown> | null;
        const studentId = (meta?.student_id as string) || undefined;
        const studentName = studentId
            ? studentNames.get(studentId) || (meta?.student_name as string) || 'Aluno removido'
            : undefined;

        let detail: string;
        switch (log.activity_type) {
            case 'login': detail = 'Login realizado'; break;
            case 'referral_registered': detail = `${studentName || 'Aluno'} registrado como indicação`; break;
            case 'student_status_update': {
                const o = STATUS_LABELS[(meta?.old_status as string) || ''] || (meta?.old_status as string) || '?';
                const n = STATUS_LABELS[(meta?.new_status as string) || ''] || (meta?.new_status as string) || '?';
                detail = `${studentName || 'Aluno'}: ${o} → ${n}`; break;
            }
            case 'result_management': detail = `Avaliação registrada para ${studentName || 'aluno'}`; break;
            case 'student_registered': detail = `${studentName || 'Aluno'} cadastrado`; break;
            case 'schedule_update': {
                const action = meta?.action as string;
                detail = action === 'add_entry'
                    ? (studentName ? `${studentName} adicionado ao horário` : 'Aluno adicionado ao horário')
                    : action === 'remove_entry' ? 'Aluno removido do horário' : 'Agenda atualizada';
                break;
            }
            case 'student_archived': detail = `${studentName || 'Aluno'} arquivado`; break;
            default: detail = 'Atividade registrada';
        }

        return { id: log.id, occurredAt: log.occurred_at, activityType: log.activity_type, studentName, detail };
    });
}
