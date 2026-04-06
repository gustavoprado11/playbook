import { getProfile } from '@/app/actions/auth';
import { listMealPlans } from '@/app/actions/nutrition';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default async function NutritionistMealPlansPage() {
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'nutritionist') {
        redirect('/dashboard');
    }

    const { data: plans, error } = await listMealPlans();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/nutritionist"
                        className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-zinc-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Planos Alimentares</h1>
                        <p className="text-zinc-500 text-sm">Todos os planos alimentares</p>
                    </div>
                </div>
                <Link href="/dashboard/nutritionist/meal-plans/new">
                    <Button size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Novo plano
                    </Button>
                </Link>
            </div>

            {error || !plans || plans.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <UtensilsCrossed className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-zinc-500 font-medium">Nenhum plano alimentar registrado.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Paciente</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead>Calorias</TableHead>
                                <TableHead>Início</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map((plan) => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium text-zinc-900">
                                        {(plan.student as { full_name: string })?.full_name || '—'}
                                    </TableCell>
                                    <TableCell className="text-zinc-700">{plan.title}</TableCell>
                                    <TableCell className="text-zinc-500">
                                        {plan.total_calories ? `${plan.total_calories} kcal` : '—'}
                                    </TableCell>
                                    <TableCell className="text-zinc-500">{formatDate(plan.start_date)}</TableCell>
                                    <TableCell>
                                        {plan.is_active ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ativo</Badge>
                                        ) : (
                                            <Badge className="bg-zinc-100 text-zinc-600 border-zinc-200">Inativo</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/dashboard/nutritionist/patients/${plan.student_id}`}>
                                            <Button variant="ghost" size="sm">
                                                Ver paciente
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
