import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const token_hash = requestUrl.searchParams.get('token_hash');
    const type = requestUrl.searchParams.get('type');

    const supabase = await createClient();

    // Handle code exchange (from OAuth or email confirmation)
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Error exchanging code for session:', error);
            return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
        }
    }

    // Handle token hash verification (from magic link)
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as 'magiclink' | 'email',
        });

        if (error) {
            console.error('Error verifying OTP:', error);
            return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
        }
    }

    // Get the current user after authentication
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // No session found, redirect to login
        return NextResponse.redirect(new URL('/login', requestUrl.origin));
    }

    // Get user profile to determine role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // Redirect based on role
    if (profile?.role === 'manager') {
        return NextResponse.redirect(new URL('/dashboard/manager', requestUrl.origin));
    } else if (profile?.role === 'trainer') {
        return NextResponse.redirect(new URL('/dashboard/trainer', requestUrl.origin));
    }

    // Default fallback to generic dashboard
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
}
