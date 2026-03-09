import { notFound } from 'next/navigation';
import { AttendanceWorkspace } from '@/app/dashboard/attendance/attendance-workspace';
import { getPublicAttendancePageData } from '@/app/dashboard/attendance/data';

export default async function PublicAttendancePage({
    params,
    searchParams,
}: {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ week?: string }>;
}) {
    const { token } = await params;
    const { week } = await searchParams;
    const data = await getPublicAttendancePageData(token, week);

    if (!data) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-zinc-50 p-4 md:p-6">
            <AttendanceWorkspace
                {...data}
                basePath={`/agenda/${token}`}
                publicMode
                publicToken={token}
                publicLabel={data.publicLabel}
            />
        </div>
    );
}
