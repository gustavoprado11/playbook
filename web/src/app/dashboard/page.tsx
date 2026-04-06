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
    } else if (profile.role === 'trainer') {
        redirect('/dashboard/trainer');
    } else if (profile.role === 'professional') {
        switch (profile.profession_type) {
            case 'nutritionist':
                redirect('/dashboard/nutritionist');
                break;
            case 'physiotherapist':
                redirect('/dashboard/physiotherapist');
                break;
            default:
                redirect('/dashboard/trainer');
        }
    } else {
        redirect('/dashboard/trainer');
    }
}
