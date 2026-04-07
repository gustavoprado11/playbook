import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Users, Activity, TrendingUp, ArrowRight, LineChart } from 'lucide-react';
import Link from 'next/link';

const reports = [
    {
        title: 'Performance Mensal',
        description: 'KPIs de retenção, indicações e gestão de resultados por treinador',
        icon: BarChart3,
        href: '/dashboard/manager/reports/performance',
        color: 'bg-emerald-100 text-emerald-600',
    },
    {
        title: 'Movimentação de Alunos',
        description: 'Novos, cancelados, pausados, reativados e transferidos no período',
        icon: Users,
        href: '/dashboard/manager/reports/student-movement',
        color: 'bg-blue-100 text-blue-600',
    },
    {
        title: 'Atividade Profissional',
        description: 'Consultas, sessões e planos por nutricionista e fisioterapeuta',
        icon: Activity,
        href: '/dashboard/manager/reports/professional-activity',
        color: 'bg-amber-100 text-amber-600',
    },
    {
        title: 'Evolução do Aluno',
        description: 'Timeline integrada de um aluno: treino, nutrição e fisioterapia',
        icon: TrendingUp,
        href: '/dashboard/manager/reports/student-evolution',
        color: 'bg-purple-100 text-purple-600',
    },
    {
        title: 'KPIs Interdisciplinares',
        description: 'Visão cruzada de cobertura, engajamento e retenção entre disciplinas',
        icon: LineChart,
        href: '/dashboard/manager/kpis',
        color: 'bg-zinc-100 text-zinc-600',
    },
];

export default async function ReportsPage() {
    const profile = await getProfile();
    if (!profile || profile.role !== 'manager') redirect('/dashboard');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Relatórios</h1>
                <p className="mt-1 text-zinc-500">Relatórios consolidados do estúdio</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {reports.map((report) => {
                    const Icon = report.icon;
                    return (
                        <Link key={report.href} href={report.href}>
                            <Card className="h-full hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className={`rounded-lg p-3 ${report.color}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-zinc-900">{report.title}</h3>
                                                <ArrowRight className="h-4 w-4 text-zinc-400" />
                                            </div>
                                            <p className="mt-1 text-sm text-zinc-500">{report.description}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
