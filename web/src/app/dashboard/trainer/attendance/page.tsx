import { redirect } from 'next/navigation';
import { getAttendancePageData } from '@/app/dashboard/attendance/data';
import { AttendanceWorkspace } from '@/app/dashboard/attendance/attendance-workspace';

export default async function TrainerAttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string }>;
}) {
    const { week } = await searchParams;
    const data = await getAttendancePageData(week);

    if (!data || data.role !== 'trainer') {
        redirect('/dashboard');
    }

    return (
        <AttendanceWorkspace
            {...data}
            basePath="/dashboard/trainer/attendance"
        />
    );
}
