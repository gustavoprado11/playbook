import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, ClipboardList, ChevronRight } from 'lucide-react';

export default async function LibraryHomePage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Biblioteca</h1>
                <p className="mt-1 text-zinc-500">
                    Os recursos reutilizáveis do estúdio. Para prescrever a um aluno, abra o aluno em <span className="font-medium text-zinc-700">Meus Alunos</span>.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Link href="/dashboard/trainer/prescricao/exercicios" className="group">
                    <Card className="transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ClipboardList className="h-5 w-5 text-emerald-600" />
                                Exercícios
                                <ChevronRight className="ml-auto h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-zinc-500">
                                Cadastre, edite e organize os exercícios por padrão de movimento e categoria.
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/dashboard/trainer/prescricao/programas" className="group">
                    <Card className="transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Dumbbell className="h-5 w-5 text-emerald-600" />
                                Programas
                                <ChevronRight className="ml-auto h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-zinc-500">
                                Monte sessões por fases (Exos) como templates reutilizáveis para atribuir aos alunos.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
