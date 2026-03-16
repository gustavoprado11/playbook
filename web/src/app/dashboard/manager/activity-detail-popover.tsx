'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTrainerActivityDetails } from '@/app/actions/manager';
import type { ActivityDetail } from '@/app/actions/manager';
import { cn, formatRelativeDate, getActivityUrgency } from '@/lib/utils';

type ActivityType =
    | 'login'
    | 'result_management'
    | 'student_status_update'
    | 'referral_registered'
    | 'student_registered'
    | 'schedule_update'
    | 'student_archived';

const TYPE_LABELS: Record<ActivityType, string> = {
    login: 'Logins',
    referral_registered: 'Indicações',
    student_status_update: 'Atualizações de status',
    result_management: 'Gestão de resultados',
    student_registered: 'Cadastros de alunos',
    schedule_update: 'Alterações de agenda',
    student_archived: 'Arquivamentos',
};

const urgencyStyles = {
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
} as const;

interface ActivityDetailPopoverProps {
    trainerId: string;
    trainerName: string;
    activityType: ActivityType;
    date: string | null;
}

export function ActivityDetailPopover({
    trainerId,
    trainerName,
    activityType,
    date,
}: ActivityDetailPopoverProps) {
    const [open, setOpen] = useState(false);
    const [details, setDetails] = useState<ActivityDetail[] | null>(null);
    const [isPending, startTransition] = useTransition();

    const urgency = getActivityUrgency(date);
    const badgeText = formatRelativeDate(date);

    function handleOpen(isOpen: boolean) {
        setOpen(isOpen);
        if (isOpen && details === null) {
            startTransition(async () => {
                try {
                    const result = await getTrainerActivityDetails({
                        trainerId,
                        activityType,
                    });
                    setDetails(result);
                } catch {
                    setDetails([]);
                }
            });
        }
    }

    return (
        <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium transition hover:opacity-80',
                        urgencyStyles[urgency],
                    )}
                >
                    {badgeText}
                </button>
            </PopoverTrigger>
            <PopoverContent align="center" sideOffset={6} className="w-80 p-0">
                <div className="border-b border-zinc-200 px-3 py-2.5">
                    <p className="text-xs font-medium text-zinc-500">{TYPE_LABELS[activityType]}</p>
                    <p className="text-sm font-semibold text-zinc-900">{trainerName}</p>
                </div>

                <div className="max-h-64 overflow-y-auto">
                    {isPending ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                    ) : details && details.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-zinc-400">Nenhum registro</p>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {details?.map((item) => (
                                <div key={item.id} className="px-3 py-2.5">
                                    <p className="text-sm text-zinc-700">{item.detail}</p>
                                    <p className="mt-0.5 text-xs text-zinc-400">
                                        {formatRelativeDate(item.occurredAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {details && details.length > 0 && (
                    <div className="border-t border-zinc-200 px-3 py-2">
                        <p className="text-center text-xs text-zinc-400">
                            Mostrando últimos {details.length}
                        </p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
