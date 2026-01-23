'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
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

    const email = formData.get('email') as string;
    const full_name = formData.get('full_name') as string;
    const start_date = formData.get('start_date') as string || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') as string;

    // Validate required fields
    if (!email || !full_name) {
        return { error: 'Nome e e-mail são obrigatórios' };
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
            // Using createUser gives us control over the process
            const temporaryPassword = crypto.randomUUID();

            const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
                email,
                password: temporaryPassword,
                email_confirm: true, // Auto-confirm email since we're sending recovery link
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

            // Create profile using admin client (bypasses RLS)
            const { error: profileError } = await adminClient
                .from('profiles')
                .insert({
                    id: userId,
                    email,
                    full_name,
                    role: 'trainer',
                });

            if (profileError) {
                console.error('Error creating profile:', profileError);
                // Clean up the auth user
                await adminClient.auth.admin.deleteUser(userId);
                return { error: 'Erro ao criar perfil do treinador. Tente novamente.' };
            }

            // Note: No password recovery needed - trainer will use Magic Link to access
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
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const supabase = await createClient();

    const full_name = formData.get('full_name') as string;
    const email = formData.get('email') as string || null;
    const phone = formData.get('phone') as string || null;
    const trainer_id = formData.get('trainer_id') as string;
    const origin = formData.get('origin') as 'organic' | 'referral' | 'marketing';
    const referred_by_trainer_id = formData.get('referred_by_trainer_id') as string || null;
    const start_date = formData.get('start_date') as string || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') as string || null;

    const { error } = await supabase
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
        });

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/dashboard/manager/students');
    redirect('/dashboard/manager/students');
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
