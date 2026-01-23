import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase Admin client using the Service Role Key.
 * This client bypasses RLS and should ONLY be used in server-side code.
 * 
 * NEVER expose this client or the Service Role Key to the frontend.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Missing Supabase Admin configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
        );
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
