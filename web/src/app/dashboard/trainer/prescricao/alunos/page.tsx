import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { getPrescribableStudents } from '@/app/actions/prescription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Users } from 'lucide-react';

export default async function PrescriptionStudentsPage() {
    const profile = await getProfile();
    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const students = await getPrescribableStudents();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Prescrição por aluno</h1>
                <p className="mt-1 text-zinc-500">
                    Selecione um aluno para atribuir e customizar um programa de treino.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-5 w-5" />
                        {students.length} aluno{students.length === 1 ? '' : 's'} ativo{students.length === 1 ? '' : 's'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {students.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-500">Nenhum aluno ativo.</p>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {students.map((s) => (
                                <Link
                                    key={s.id}
                                    href={`/dashboard/trainer/prescricao/alunos/${s.id}`}
                                    className="flex items-center justify-between py-3 hover:text-emerald-700"
                                >
                                    <span className="font-medium text-zinc-800">{s.full_name}</span>
                                    <ChevronRight className="h-4 w-4 text-zinc-300" />
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
