import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { getCrossDisciplineKPIs } from '@/app/actions/kpis';
import { KPIDashboard } from '@/components/kpis/kpi-dashboard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function KPIsPage() {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    const kpis = await getCrossDisciplineKPIs();

    if (!kpis) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                        <ArrowLeft className="h-5 w-5 text-zinc-500" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-zinc-900">KPIs Interdisciplinares</h1>
                        <p className="mt-1 text-zinc-500">Visão cruzada de todas as disciplinas</p>
                    </div>
                </div>
                <div className="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-lg border border-dashed">
                    Não foi possível carregar os KPIs.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/manager/reports" className="p-2 hover:bg-zinc-100 rounded-full">
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-zinc-900">KPIs Interdisciplinares</h1>
                    <p className="mt-1 text-zinc-500">Visão cruzada de todas as disciplinas</p>
                </div>
            </div>
            <KPIDashboard kpis={kpis} />
        </div>
    );
}
