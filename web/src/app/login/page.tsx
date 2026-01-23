import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

export default async function LoginPage() {
    const supabase = await createClient();

    // Check if user is already authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // User is authenticated, get their profile to determine redirect
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        // Redirect based on role
        if (profile?.role === 'manager') {
            redirect('/dashboard/manager');
        } else if (profile?.role === 'trainer') {
            redirect('/dashboard/trainer');
        } else {
            redirect('/dashboard');
        }
    }

    // User is not authenticated, show login form
    return <LoginForm />;
}
