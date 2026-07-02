import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { listProgramTemplates } from '@/app/actions/prescription';
import { ProgramsList } from './programs-list';

export default async function ProgramsPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const programs = await listProgramTemplates();

    return <ProgramsList programs={programs} />;
}
