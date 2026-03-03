'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn, formatRelativeDate, getActivityUrgency } from '@/lib/utils';
import { Activity } from 'lucide-react';
import type { TrainerActivitySummary } from '@/types/database';

interface TrainerActivityPanelProps {
    data: TrainerActivitySummary[];
}

const urgencyStyles = {
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
} as const;

function ActivityBadge({ date }: { date: string | null }) {
    const urgency = getActivityUrgency(date);
    const text = formatRelativeDate(date);

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                urgencyStyles[urgency]
            )}
        >
            {text}
        </span>
    );
}

export function TrainerActivityPanel({ data }: TrainerActivityPanelProps) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Atividade dos Treinadores
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center py-8 text-zinc-500">
                        Nenhum treinador ativo encontrado.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Atividade dos Treinadores
                </CardTitle>
                <CardDescription>
                    Última ação registrada por tipo
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Treinador</TableHead>
                                <TableHead className="text-center">Último Login</TableHead>
                                <TableHead className="text-center">Última Gestão</TableHead>
                                <TableHead className="text-center">Última Atualização de Status</TableHead>
                                <TableHead className="text-center">Última Indicação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.trainer_id}>
                                    <TableCell className="font-medium text-zinc-900">
                                        {row.trainer_name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityBadge date={row.last_login} />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityBadge date={row.last_result_management} />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityBadge date={row.last_student_status_update} />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityBadge date={row.last_referral_registered} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
