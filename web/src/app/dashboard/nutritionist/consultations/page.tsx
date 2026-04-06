import { getProfile } from '@/app/actions/auth';
import { listNutritionConsultations } from '@/app/actions/nutrition';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { NutritionConsultationType, NutritionConsultation } from '@/types/database';

const typeLabels: Record<NutritionConsultationType, string> = {
    initial_assessment: 'Avaliação Inicial',
    follow_up: 'Retorno',
    reassessment: 'Reavaliação',
};

const typeColors: Record<NutritionConsultationType, string> = {
    initial_assessment: 'bg-emerald-100 text-emerald-700',
    follow_up: 'bg-blue-100 text-blue-700',
    reassessment: 'bg-amber-100 text-amber-700',
};

export default async function NutritionistConsultationsPage() {
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'nutritionist') {
        redirect('/dashboard');
    }

    const result = await listNutritionConsultations();
    const consultations = (result.data || []) as NutritionConsultation[];
    const error = result.error;

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
                        <h1 className="text-2xl font-bold text-zinc-900">Consultas</h1>
                        <p className="text-zinc-500 text-sm">Todas as consultas realizadas</p>
                    </div>
                </div>
                <Link href="/dashboard/nutritionist/consultations/new">
                    <Button size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Nova consulta
                    </Button>
                </Link>
            </div>

            {error || !consultations || consultations.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <ClipboardList className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-zinc-500 font-medium">Nenhuma consulta registrada.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Paciente</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Queixa Principal</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {consultations.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium text-zinc-900">
                                        {(c.student as { full_name: string })?.full_name || '—'}
                                    </TableCell>
                                    <TableCell className="text-zinc-500">
                                        {formatDate(c.consultation_date)}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[c.consultation_type]}`}>
                                            {typeLabels[c.consultation_type]}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-zinc-500 max-w-xs truncate">
                                        {c.chief_complaint || '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/dashboard/nutritionist/patients/${c.student_id}`}>
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
