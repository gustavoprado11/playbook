import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // We need to check if user is authenticated first
    // getProfile checks auth.getUser() internally
    const profile = await getProfile();

    if (!profile) {
        // Check if we have a user session but no profile
        // This requires importing createClient to check session independently if getProfile returns null for both cases.
        // However, getProfile in auth.ts returns null if getUser() returns null OR if profile query returns null.
        // We should verify if we can distinguish these cases.
        // Looking at auth.ts: 
        // const { data: { user } } = await supabase.auth.getUser();
        // if (!user) return null;
        // ... query profile ...
        // return profile;

        // So if profile is null, it could be "not logged in" OR "missing profile".

        // Let's do a specific check here to be safe and avoid loops for unauthenticated users.
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            redirect('/login');
        }

        // If we have a user but getProfile returned null, it means the profile is missing
        redirect('/auth/error?reason=missing_profile');
    }

    return (
        <div className="min-h-screen bg-zinc-50">
            <Sidebar role={profile.role} userName={profile.full_name} />
            <main className="lg:pl-64">
                <div className="p-6 pt-20 lg:pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
