import { getProfile, getTrainerId } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { NewStudentForm } from '@/app/dashboard/manager/students/new/form';

export default async function NewTrainerStudentPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const trainerId = await getTrainerId();

    if (!trainerId) {
        redirect('/dashboard/trainer/students');
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <NewStudentForm
                trainers={[]}
                mode="trainer"
                trainerId={trainerId}
            />
        </div>
    );
}
