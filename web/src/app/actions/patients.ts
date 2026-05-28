'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, getTrainerId } from '@/app/actions/auth';

export interface StudentSearchResult {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    has_trainer: boolean;
    already_linked: boolean;
}

// Remove caracteres que quebrariam o filtro .or/ilike do PostgREST.
function sanitize(query: string) {
    return query.trim().replace(/[%,()]/g, '');
}

async function getMyProfessionalId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
    return data?.id ?? null;
}

// ── Profissional (nutri/fisio): busca + adicionar paciente ──────────

export async function searchStudentsForLinking(query: string): Promise<StudentSearchResult[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'professional') return [];

    const myProId = await getMyProfessionalId();
    if (!myProId) return [];

    const q = sanitize(query);
    if (q.length < 2) return [];

    const admin = createAdminClient();
    const { data: students } = await admin
        .from('students')
        .select('id, full_name, email, phone, trainer_id')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .eq('is_archived', false)
        .order('full_name')
        .limit(10);

    const list = students || [];
    const ids = list.map((s) => s.id);

    const { data: links } = ids.length > 0
        ? await admin
            .from('student_professionals')
            .select('student_id, status')
            .eq('professional_id', myProId)
            .in('student_id', ids)
        : { data: [] };

    const activeLinked = new Set(
        (links || []).filter((l: { status: string }) => l.status === 'active').map((l: { student_id: string }) => l.student_id)
    );

    return list.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        phone: s.phone,
        has_trainer: Boolean(s.trainer_id),
        already_linked: activeLinked.has(s.id),
    }));
}

interface AddPatientInput {
    existingStudentId?: string;
    newStudent?: { full_name: string; email?: string; phone?: string };
}

export async function addPatientForProfessional(input: AddPatientInput) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'professional') return { error: 'Não autorizado' };

    const myProId = await getMyProfessionalId();
    if (!myProId) return { error: 'Profissional não encontrado.' };

    const admin = createAdminClient();
    let studentId = input.existingStudentId;

    if (!studentId) {
        const name = input.newStudent?.full_name?.trim();
        if (!name) return { error: 'Informe o nome do paciente.' };
        const { data: created, error } = await admin
            .from('students')
            .insert({
                full_name: name,
                email: input.newStudent?.email?.trim() || null,
                phone: input.newStudent?.phone?.trim() || null,
                trainer_id: null,
                origin: 'organic',
                start_date: new Date().toISOString().split('T')[0],
            })
            .select('id')
            .single();

        if (error || !created) {
            console.error('Error creating patient:', error);
            return { error: 'Não foi possível criar o paciente.' };
        }
        studentId = created.id;
    }

    const { data: existingLink } = await admin
        .from('student_professionals')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('professional_id', myProId)
        .maybeSingle();

    if (existingLink) {
        if (existingLink.status !== 'active') {
            await admin
                .from('student_professionals')
                .update({ status: 'active', ended_at: null })
                .eq('id', existingLink.id);
        } else {
            return { error: 'Este paciente já está na sua carteira.' };
        }
    } else {
        const { error } = await admin
            .from('student_professionals')
            .insert({ student_id: studentId, professional_id: myProId });
        if (error) {
            console.error('Error linking patient:', error);
            return { error: 'Não foi possível vincular o paciente.' };
        }
    }

    revalidatePath('/dashboard/nutritionist/patients');
    revalidatePath('/dashboard/physiotherapist/patients');
    return { success: true };
}

// ── Treinador: buscar e assumir aluno já existente ──────────────────

export async function searchStudentsToClaim(query: string): Promise<StudentSearchResult[]> {
    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') return [];

    const q = sanitize(query);
    if (q.length < 2) return [];

    const admin = createAdminClient();
    // Apenas alunos ainda sem treinador (ex.: cadastrados por nutri/fisio).
    const { data: students } = await admin
        .from('students')
        .select('id, full_name, email, phone, trainer_id')
        .is('trainer_id', null)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .eq('is_archived', false)
        .order('full_name')
        .limit(10);

    return (students || []).map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        phone: s.phone,
        has_trainer: false,
        already_linked: false,
    }));
}

export async function claimStudentAsTrainer(studentId: string) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') return { error: 'Não autorizado' };

    const trainerId = await getTrainerId();
    if (!trainerId) return { error: 'Perfil de treinador não encontrado.' };

    const admin = createAdminClient();
    // Só assume quem ainda não tem treinador (evita "roubar" aluno de outro).
    const { data: updated, error } = await admin
        .from('students')
        .update({ trainer_id: trainerId })
        .eq('id', studentId)
        .is('trainer_id', null)
        .select('id')
        .maybeSingle();

    if (error) {
        console.error('Error claiming student:', error);
        return { error: 'Não foi possível adicionar o aluno.' };
    }
    if (!updated) {
        return { error: 'Este aluno já possui um treinador.' };
    }

    // Espelha o vínculo na camada multidisciplinar, se o treinador tiver registro profissional.
    const { data: trainerPro } = await admin
        .from('professionals')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('profession_type', 'trainer')
        .maybeSingle();

    if (trainerPro) {
        const { data: link } = await admin
            .from('student_professionals')
            .select('id, status')
            .eq('student_id', studentId)
            .eq('professional_id', trainerPro.id)
            .maybeSingle();
        if (link) {
            if (link.status !== 'active') {
                await admin.from('student_professionals').update({ status: 'active', ended_at: null }).eq('id', link.id);
            }
        } else {
            await admin.from('student_professionals').insert({ student_id: studentId, professional_id: trainerPro.id });
        }
    }

    revalidatePath('/dashboard/trainer/students');
    revalidatePath('/dashboard/manager/students');
    return { success: true };
}
