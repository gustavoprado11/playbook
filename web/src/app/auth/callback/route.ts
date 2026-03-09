import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const token_hash = requestUrl.searchParams.get('token_hash');
    const type = requestUrl.searchParams.get('type');
    const cookiesToApply: Array<{
        name: string;
        value: string;
        options?: Parameters<NextResponse['cookies']['set']>[2];
    }> = [];

    // Default redirect destination
    let redirectTo = new URL('/login', requestUrl.origin);

    // Create a response we can attach cookies to
    // This is critical — using cookies() from next/headers + NextResponse.redirect()
    // can lose the session cookies set during exchangeCodeForSession/verifyOtp
    let response = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookiesToApply.push({ name, value, options });
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // Handle code exchange (PKCE flow — from magic link or OAuth)
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Error exchanging code for session:', error);
            response = NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
            return response;
        }
    }

    // Handle token hash verification (legacy magic link flow)
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as 'magiclink' | 'email',
        });

        if (error) {
            console.error('Error verifying OTP:', error);
            response = NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
            return response;
        }
    }

    // Get the current user after authentication
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error('Auth callback: no user found after exchange');
        response = NextResponse.redirect(new URL('/login', requestUrl.origin));
        return response;
    }

    // Get user profile to determine role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // Log trainer login activity (fire-and-forget)
    if (profile?.role === 'trainer') {
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('profile_id', user.id)
            .single();

        if (trainer) {
            void supabase.from('trainer_activity_log').insert({
                trainer_id: trainer.id,
                activity_type: 'login',
            });
        }
    }

    // Redirect based on role
    if (profile?.role === 'manager') {
        redirectTo = new URL('/dashboard/manager', requestUrl.origin);
    } else if (profile?.role === 'trainer') {
        redirectTo = new URL('/dashboard/trainer', requestUrl.origin);
    } else {
        redirectTo = new URL('/dashboard', requestUrl.origin);
    }

    // Create final redirect with all cookies preserved
    const finalResponse = NextResponse.redirect(redirectTo);
    cookiesToApply.forEach(({ name, value, options }) => {
        finalResponse.cookies.set(name, value, options);
    });

    return finalResponse;
}
