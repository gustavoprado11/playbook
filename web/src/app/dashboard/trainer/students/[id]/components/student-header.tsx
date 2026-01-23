import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { Student } from '@/types/database';

interface StudentHeaderProps {
    student: Student;
    lastAssessmentDate?: string;
    managementStatus: 'on_track' | 'warning' | 'late' | 'pending';
    protocolsCount: number;
}

export function StudentHeader({ student, lastAssessmentDate, managementStatus, protocolsCount }: StudentHeaderProps) {
    const statusConfig = {
        on_track: { label: 'Gestão em Dia', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
        warning: { label: 'Atenção', color: 'bg-amber-100 text-amber-700', icon: Clock },
        late: { label: 'Em Atraso', color: 'bg-red-100 text-red-700', icon: AlertCircle },
        pending: { label: 'Sem Avaliação', color: 'bg-zinc-100 text-zinc-700', icon: Calendar },
    };

    const config = statusConfig[managementStatus];
    const Icon = config.icon;

    return (
        <Card className="bg-white border-zinc-200">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900">{student.full_name}</h2>
                        <div className="flex items-center gap-2 mt-1 text-zinc-500 text-sm">
                            <span>Início: {formatDate(student.start_date)}</span>
                            <span>•</span>
                            <span>{protocolsCount} protocolos monitorados</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-xs text-zinc-500 uppercase font-medium">Última Avaliação</p>
                            <p className="font-medium text-zinc-900">
                                {lastAssessmentDate ? formatDate(lastAssessmentDate) : '-'}
                            </p>
                        </div>

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color}`}>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{config.label}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
