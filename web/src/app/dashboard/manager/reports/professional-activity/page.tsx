import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { getProfessionalActivityReport } from '@/app/actions/reports';
import { ProfessionalActivityView } from './report-view';

export default async function ProfessionalActivityPage({
    searchParams,
}: {
    searchParams: Promise<{ month?: string }>;
}) {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const params = await searchParams;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedMonth = params.month || defaultMonth;
    const report = await getProfessionalActivityReport(selectedMonth);

    return <ProfessionalActivityView report={report} selectedMonth={selectedMonth} />;
}
