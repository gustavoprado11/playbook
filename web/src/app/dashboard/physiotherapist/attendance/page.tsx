import { redirect } from 'next/navigation';
import { getAttendancePageData } from '@/app/dashboard/attendance/data';
import { AttendanceWorkspace } from '@/app/dashboard/attendance/attendance-workspace';

export default async function PhysiotherapistAttendancePage({
    searchParams,
}: {
    searchParams: Promise<{ week?: string }>;
}) {
    const { week } = await searchParams;
    const data = await getAttendancePageData('physiotherapy', week);

    if (!data) {
        redirect('/dashboard');
    }

    return (
        <AttendanceWorkspace
            {...data}
            basePath="/dashboard/physiotherapist/attendance"
        />
    );
}
