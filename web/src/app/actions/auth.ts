'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
    const supabase = await createClient();

    const email = normalizeEmail(formData.get('email') as string);
    const password = formData.get('password') as string;

    if (!isValidEmail(email)) {
        return { error: 'Digite um e-mail válido, por exemplo nome@dominio.com' };
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        if (error.message === 'Invalid login credentials') {
            return { error: 'E-mail ou senha incorretos' };
        }
        return { error: error.message };
    }

    // Log trainer login activity (fire-and-forget, never blocks login)
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const admin = createAdminClient();
            const { data: trainer } = await admin
                .from('trainers')
                .select('id')
                .eq('profile_id', user.id)
                .single();

            if (trainer) {
                const headersList = await headers();
                await admin.from('trainer_activity_log').insert({
                    trainer_id: trainer.id,
                    activity_type: 'login',
                    metadata: {
                        ip: headersList.get('x-forwarded-for') || null,
                        user_agent: headersList.get('user-agent') || null,
                    },
                });
            }
        }
    } catch {
        // Silent failure — never block login
    }

    redirect('/dashboard');
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
}

export async function getSession() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getProfile() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return profile;
}

export async function getTrainerId() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

    return trainer?.id || null;
}
