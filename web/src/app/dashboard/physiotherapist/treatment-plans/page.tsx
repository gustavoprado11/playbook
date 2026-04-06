import { listTreatmentPlans } from '@/app/actions/physio';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Plus, FileText } from 'lucide-react';
import Link from 'next/link';

const statusLabels: Record<string, string> = {
    active: 'Ativo',
    completed: 'Concluído',
    paused: 'Pausado',
    cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
};

export default async function TreatmentPlansPage() {
    const { data: plans, error } = await listTreatmentPlans();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Protocolos de Tratamento</h1>
                    <p className="mt-1 text-zinc-500">{plans?.length || 0} protocolo(s)</p>
                </div>
                <Link href="/dashboard/physiotherapist/treatment-plans/new">
                    <Button>
                        <Plus className="mr-1 h-4 w-4" />
                        Novo Protocolo
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    {!plans || plans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                            <FileText className="mb-2 h-8 w-8" />
                            <p>Nenhum protocolo encontrado</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Diagnóstico</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Sessões Est.</TableHead>
                                    <TableHead>Início</TableHead>
                                    <TableHead>Fim</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plans.map((plan: any) => (
                                    <TableRow key={plan.id}>
                                        <TableCell className="font-medium text-zinc-900">
                                            {plan.student?.full_name || '-'}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-zinc-600">
                                            {plan.diagnosis}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[plan.status] || ''}`}
                                            >
                                                {statusLabels[plan.status] || plan.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-zinc-600">
                                            {plan.estimated_sessions || '-'}
                                        </TableCell>
                                        <TableCell className="text-zinc-600">
                                            {new Date(plan.start_date).toLocaleDateString('pt-BR')}
                                        </TableCell>
                                        <TableCell className="text-zinc-600">
                                            {plan.end_date
                                                ? new Date(plan.end_date).toLocaleDateString('pt-BR')
                                                : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
