import { listPhysioSessions } from '@/app/actions/physio';
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
import { Plus, Activity } from 'lucide-react';
import Link from 'next/link';

const typeLabels: Record<string, string> = {
    initial_assessment: 'Avaliação Inicial',
    treatment: 'Tratamento',
    reassessment: 'Reavaliação',
    discharge: 'Alta',
};

const typeColors: Record<string, string> = {
    initial_assessment: 'bg-blue-100 text-blue-800',
    treatment: 'bg-green-100 text-green-800',
    reassessment: 'bg-yellow-100 text-yellow-800',
    discharge: 'bg-zinc-100 text-zinc-800',
};

function getPainColor(v: number | null): string {
    if (v === null) return 'text-zinc-400';
    if (v <= 3) return 'text-green-700';
    if (v <= 6) return 'text-amber-700';
    return 'text-red-700';
}

export default async function PhysioSessionsPage() {
    const { data: sessions, error } = await listPhysioSessions();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Sessões</h1>
                    <p className="mt-1 text-zinc-500">{sessions?.length || 0} sessão(ões) registrada(s)</p>
                </div>
                <Link href="/dashboard/physiotherapist/sessions/new">
                    <Button>
                        <Plus className="mr-1 h-4 w-4" />
                        Nova Sessão
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
                    {!sessions || sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                            <Activity className="mb-2 h-8 w-8" />
                            <p>Nenhuma sessão encontrada</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Dor (Antes → Depois)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session: any) => {
                                    const evo = Array.isArray(session.evolution)
                                        ? session.evolution?.[0]
                                        : session.evolution;
                                    return (
                                        <TableRow key={session.id}>
                                            <TableCell className="font-medium text-zinc-900">
                                                {session.student?.full_name || '-'}
                                            </TableCell>
                                            <TableCell className="text-zinc-600">
                                                {new Date(session.session_date).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColors[session.session_type] || ''}`}
                                                >
                                                    {typeLabels[session.session_type] || session.session_type}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {evo ? (
                                                    <span className="text-sm">
                                                        <span className={getPainColor(evo.pain_before)}>
                                                            {evo.pain_before ?? '-'}
                                                        </span>
                                                        <span className="text-zinc-400"> → </span>
                                                        <span className={getPainColor(evo.pain_after)}>
                                                            {evo.pain_after ?? '-'}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400">-</span>
                                                )}
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
