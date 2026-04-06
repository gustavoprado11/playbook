import { listMyPatients } from '@/app/actions/nutrition';
import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import Link from 'next/link';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';

const statusLabels: Record<string, string> = {
    active: 'Ativo',
    cancelled: 'Cancelado',
    paused: 'Pausado',
};

const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    paused: 'bg-amber-100 text-amber-700',
};

export default async function NutritionistPatientsPage() {
    const profile = await getProfile();
    if (!profile || profile.profession_type !== 'nutritionist') {
        redirect('/dashboard');
    }

    const { data: patients, error } = await listMyPatients();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/nutritionist"
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-zinc-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Meus Pacientes</h1>
                    <p className="text-zinc-500 text-sm">Lista de pacientes vinculados</p>
                </div>
            </div>

            {error || !patients || patients.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                    <Users className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-zinc-500 font-medium">Nenhum paciente encontrado.</p>
                    <p className="text-sm text-zinc-400 mt-1">Peça ao gestor para vincular pacientes ao seu perfil.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {patients.map((sp) => {
                                const student = sp.student;
                                if (!student) return null;
                                return (
                                    <TableRow key={sp.id}>
                                        <TableCell className="font-medium text-zinc-900">
                                            {student.full_name}
                                        </TableCell>
                                        <TableCell className="text-zinc-500">
                                            {student.phone || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[student.status] || 'bg-zinc-100 text-zinc-600'}`}>
                                                {statusLabels[student.status] || student.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/dashboard/nutritionist/patients/${student.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    Ver prontuário
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
