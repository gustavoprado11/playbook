import { redirect } from 'next/navigation';
import { getAttendancePageData } from '@/app/dashboard/attendance/data';
import { AttendanceWorkspace } from '@/app/dashboard/attendance/attendance-workspace';
import type { AgendaKind } from '@/types/database';

export default async function ManagerAttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string; agenda?: string }>;
}) {
    const { week, agenda } = await searchParams;
    const resolvedAgenda: AgendaKind = agenda === 'physiotherapy' ? 'physiotherapy' : 'training';
    const data = await getAttendancePageData(resolvedAgenda, week);

    if (!data || data.role !== 'manager') {
        redirect('/dashboard');
    }

    return (
        <AttendanceWorkspace
            {...data}
            basePath="/dashboard/manager/attendance"
        />
    );
}
