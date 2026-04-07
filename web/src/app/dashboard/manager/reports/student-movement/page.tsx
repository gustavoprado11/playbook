import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { getStudentMovementReport } from '@/app/actions/reports';
import { StudentMovementView } from './report-view';

export default async function StudentMovementPage({
    searchParams,
}: {
    searchParams: Promise<{ start?: string; end?: string }>;
}) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const params = await searchParams;
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultEnd = now.toISOString().slice(0, 10);

    const start = params.start || defaultStart;
    const end = params.end || defaultEnd;
    const report = await getStudentMovementReport(start, end);

    return <StudentMovementView report={report} startDate={start} endDate={end} />;
}
