import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const profile = await getProfile();

    if (!profile) {
        redirect('/login');
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
