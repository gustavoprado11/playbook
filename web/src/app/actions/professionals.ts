'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/app/actions/auth';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';
import type { ProfessionType } from '@/types/database';

export async function listProfessionals(professionType?: ProfessionType) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado', data: null };
    }

    const supabase = await createClient();

    let query = supabase
        .from('professionals')
        .select(`
            *,
            profile:profiles!profile_id(full_name, email),
            student_count:student_professionals(count)
        `)
        .order('created_at', { ascending: false });

    if (professionType) {
        query = query.eq('profession_type', professionType);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing professionals:', error);
        return { error: 'Erro ao listar profissionais', data: null };
    }

    return { data, error: null };
}

export async function createProfessional(formData: FormData) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const email = normalizeEmail(formData.get('email') as string);
    const full_name = formData.get('full_name') as string;
    const password = formData.get('password') as string;
    const confirm_password = formData.get('confirm_password') as string;
    const profession_type = formData.get('profession_type') as ProfessionType;
    const start_date = formData.get('start_date') as string || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') as string;

    if (!email || !full_name) {
        return { error: 'Nome e e-mail são obrigatórios' };
    }

    if (!isValidEmail(email)) {
        return { error: 'Digite um e-mail válido, por exemplo nome@dominio.com' };
    }

    if (!password || password.length < 6) {
        return { error: 'A senha deve ter no mínimo 6 caracteres' };
    }

    if (password !== confirm_password) {
        return { error: 'As senhas não coincidem' };
    }

    if (!profession_type || !['nutritionist', 'physiotherapist'].includes(profession_type)) {
        return { error: 'Tipo de profissional inválido' };
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: 'Não foi possível criar o profissional no momento. Verifique a configuração do sistema.' };
    }

    try {
        const adminClient = createAdminClient();
        const supabase = await createClient();

        // Check if user already exists
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        let userId: string;

        if (existingUser) {
            userId = existingUser.id;

            const { data: existingProfessional } = await supabase
                .from('professionals')
                .select('id')
                .eq('profile_id', userId)
                .eq('profession_type', profession_type)
                .single();

            if (existingProfessional) {
                return { error: 'Este e-mail já está cadastrado como este tipo de profissional' };
            }
        } else {
            const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name,
                    role: 'professional',
                },
            });

            if (createError) {
                console.error('Error creating user:', createError);
                if (createError.message?.includes('already been registered')) {
                    return { error: 'Este e-mail já está cadastrado no sistema.' };
                }
                return { error: 'Não foi possível criar o usuário. Verifique se o e-mail é válido.' };
            }

            if (!userData?.user) {
                return { error: 'Erro ao criar usuário. Tente novamente.' };
            }

            userId = userData.user.id;
        }

        // Upsert profile with role and profession_type
        const { error: profileError } = await adminClient
            .from('profiles')
            .upsert({
                id: userId,
                email,
                full_name,
                role: 'professional',
                profession_type,
            });

        if (profileError) {
            console.error('Error upserting profile:', profileError);
            return { error: 'Erro ao criar perfil do profissional. Tente novamente.' };
        }

        // Create professional record
        const { error: professionalError } = await adminClient
            .from('professionals')
            .insert({
                profile_id: userId,
                profession_type,
                start_date,
                notes: notes || null,
            });

        if (professionalError) {
            console.error('Error creating professional:', professionalError);
            return { error: 'Erro ao criar registro do profissional. Tente novamente.' };
        }

        revalidatePath('/dashboard/manager/professionals');
        revalidatePath('/dashboard/manager/team');
        return { success: true };
    } catch (error) {
        if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
        if (typeof error === 'object' && error !== null && 'digest' in error) {
            const digest = (error as { digest?: string }).digest;
            if (digest?.startsWith('NEXT_REDIRECT')) throw error;
        }
        console.error('Unexpected error creating professional:', error);
        return { error: 'Não foi possível criar o profissional no momento. Tente novamente.' };
    }
}

export async function toggleProfessionalStatus(professionalId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const adminClient = createAdminClient();

    const { data: professional, error: fetchError } = await adminClient
        .from('professionals')
        .select('is_active')
        .eq('id', professionalId)
        .single();

    if (fetchError || !professional) {
        return { error: 'Profissional não encontrado' };
    }

    const { error } = await adminClient
        .from('professionals')
        .update({ is_active: !professional.is_active })
        .eq('id', professionalId);

    if (error) {
        console.error('Error toggling professional status:', error);
        return { error: 'Erro ao alterar status do profissional' };
    }

    revalidatePath('/dashboard/manager/professionals');
    revalidatePath('/dashboard/manager/team');
    return { success: true };
}

export async function resetProfessionalPassword(professionalId: string, password: string, confirmPassword: string) {
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

    const adminClient = createAdminClient();

    const { data: professional, error: fetchError } = await adminClient
        .from('professionals')
        .select('profile_id')
        .eq('id', professionalId)
        .single();

    if (fetchError || !professional) {
        return { error: 'Profissional não encontrado' };
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
        professional.profile_id,
        { password }
    );

    if (updateError) {
        console.error('Error resetting password:', updateError);
        return { error: 'Erro ao redefinir senha. Tente novamente.' };
    }

    return { success: true };
}

export async function linkStudentToProfessional(studentId: string, professionalId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
        .from('student_professionals')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('professional_id', professionalId)
        .single();

    if (existing) {
        if (existing.status === 'active') {
            return { error: 'Este vínculo já existe' };
        }
        const { error } = await adminClient
            .from('student_professionals')
            .update({ status: 'active', ended_at: null })
            .eq('id', existing.id);

        if (error) {
            return { error: 'Erro ao reativar vínculo' };
        }
    } else {
        const { error } = await adminClient
            .from('student_professionals')
            .insert({
                student_id: studentId,
                professional_id: professionalId,
            });

        if (error) {
            console.error('Error linking student to professional:', error);
            return { error: 'Erro ao vincular aluno ao profissional' };
        }
    }

    revalidatePath('/dashboard/manager/students');
    revalidatePath('/dashboard/manager/professionals');
    revalidatePath('/dashboard/manager/team');
    return { success: true };
}

export async function unlinkStudentFromProfessional(studentId: string, professionalId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') {
        return { error: 'Não autorizado' };
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
        .from('student_professionals')
        .update({
            status: 'inactive',
            ended_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .eq('professional_id', professionalId);

    if (error) {
        console.error('Error unlinking student from professional:', error);
        return { error: 'Erro ao desvincular aluno do profissional' };
    }

    revalidatePath('/dashboard/manager/students');
    revalidatePath('/dashboard/manager/professionals');
    revalidatePath('/dashboard/manager/team');
    return { success: true };
}
