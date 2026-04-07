import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { getPerformanceReport, getAvailableSnapshotMonths } from '@/app/actions/reports';
import { PerformanceReportView } from './report-view';

export default async function PerformanceReportPage({
    searchParams,
}: {
    searchParams: Promise<{ month?: string }>;
}) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const params = await searchParams;
    const months = await getAvailableSnapshotMonths();
    const selectedMonth = params.month || months[0] || '';
    const report = selectedMonth ? await getPerformanceReport(selectedMonth) : null;

    return (
        <PerformanceReportView
            report={report}
            months={months}
            selectedMonth={selectedMonth}
        />
    );
}
