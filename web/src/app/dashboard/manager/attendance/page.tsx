import { redirect } from 'next/navigation';
import { getAttendancePageData } from '@/app/dashboard/attendance/data';
import { AttendanceWorkspace } from '@/app/dashboard/attendance/attendance-workspace';

export default async function ManagerAttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string }>;
}) {
    const { week } = await searchParams;
    const data = await getAttendancePageData(week);

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
