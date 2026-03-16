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
import { Activity } from 'lucide-react';
import type { TrainerActivitySummary } from '@/types/database';
import { ActivityDetailPopover } from './activity-detail-popover';
import { TrainerHistoryPopover } from './trainer-history-popover';

interface TrainerActivityPanelProps {
    data: TrainerActivitySummary[];
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
                    Clique em uma célula para ver o histórico detalhado
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Treinador</TableHead>
                                <TableHead className="text-center">Último Login</TableHead>
                                <TableHead className="text-center">Último Cadastro</TableHead>
                                <TableHead className="text-center">Última Gestão</TableHead>
                                <TableHead className="text-center">Última Atualização</TableHead>
                                <TableHead className="text-center">Última Indicação</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.trainer_id}>
                                    <TableCell className="font-medium text-zinc-900">
                                        {row.trainer_name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityDetailPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                            activityType="login"
                                            date={row.last_login}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityDetailPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                            activityType="student_registered"
                                            date={row.last_student_registered}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityDetailPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                            activityType="result_management"
                                            date={row.last_result_management}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityDetailPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                            activityType="student_status_update"
                                            date={row.last_student_status_update}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <ActivityDetailPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                            activityType="referral_registered"
                                            date={row.last_referral_registered}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TrainerHistoryPopover
                                            trainerId={row.trainer_id}
                                            trainerName={row.trainer_name}
                                        />
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
