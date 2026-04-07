import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { getStudentEvolutionReport, getStudentsList } from '@/app/actions/reports';
import { StudentEvolutionView } from './report-view';

export default async function StudentEvolutionPage({
    searchParams,
}: {
    searchParams: Promise<{ studentId?: string; start?: string; end?: string }>;
}) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const params = await searchParams;
    const students = await getStudentsList();

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const defaultEnd = now.toISOString().slice(0, 10);

    const studentId = params.studentId || '';
    const start = params.start || threeMonthsAgo;
    const end = params.end || defaultEnd;

    const report = studentId ? await getStudentEvolutionReport(studentId, start, end) : null;

    return (
        <StudentEvolutionView
            report={report}
            students={students}
            selectedStudentId={studentId}
            startDate={start}
            endDate={end}
        />
    );
}
