import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';

export default async function DashboardPage() {
    const profile = await getProfile();

    if (!profile) {
        redirect('/login');
    }

    // Redirect based on role
    if (profile.role === 'manager') {
        redirect('/dashboard/manager');
    } else {
        redirect('/dashboard/trainer');
    }
}
