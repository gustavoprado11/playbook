import { redirect } from 'next/navigation';

export default function TrainersPage() {
    redirect('/dashboard/manager/team?type=trainer');
}
