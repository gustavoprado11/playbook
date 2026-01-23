'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

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

    redirect('/dashboard');
}

export async function signInWithMagicLink(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'E-mail é obrigatório' };
    }

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        },
    });

    if (error) {
        console.error('Magic link error:', error);
        return { error: 'Não foi possível enviar o link. Verifique o e-mail e tente novamente.' };
    }

    return { success: true, message: 'Link de acesso enviado! Verifique seu e-mail.' };
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

