import { listMyPhysioPatients } from '@/app/actions/physio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Users } from 'lucide-react';
import Link from 'next/link';

export default async function PhysioPatientsPage() {
    const { data: patients, error } = await listMyPhysioPatients();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Meus Pacientes</h1>
                    <p className="mt-1 text-zinc-500">
                        {patients?.length || 0} paciente(s) ativo(s)
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    {!patients || patients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                            <Users className="mb-2 h-8 w-8" />
                            <p>Nenhum paciente encontrado</p>
                        </div>
                    ) : (
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
                                {patients.map((sp: any) => {
                                    const student = sp.student;
                                    if (!student) return null;
                                    return (
                                        <TableRow key={sp.id}>
                                            <TableCell className="font-medium text-zinc-900">
                                                {student.full_name}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {student.phone || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                                    Ativo
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/dashboard/physiotherapist/patients/${student.id}`}>
                                                    <Button variant="outline" size="sm">
                                                        Ver prontuário
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
