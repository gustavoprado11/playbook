'use client';

import { useState, useTransition } from 'react';
import {
    Archive,
    Calendar,
    ClipboardCheck,
    History,
    Loader2,
    LogIn,
    RefreshCw,
    UserPlus,
    Users,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { getTrainerFullHistory } from '@/app/actions/manager';
import type { ActivityDetail } from '@/app/actions/manager';
import { formatRelativeDate } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ReactNode> = {
    login: <LogIn className="h-3.5 w-3.5 text-zinc-400" />,
    student_registered: <UserPlus className="h-3.5 w-3.5 text-emerald-500" />,
    referral_registered: <Users className="h-3.5 w-3.5 text-blue-500" />,
    student_status_update: <RefreshCw className="h-3.5 w-3.5 text-amber-500" />,
    result_management: <ClipboardCheck className="h-3.5 w-3.5 text-purple-500" />,
    schedule_update: <Calendar className="h-3.5 w-3.5 text-cyan-500" />,
    student_archived: <Archive className="h-3.5 w-3.5 text-red-400" />,
};

interface TrainerHistoryPopoverProps {
    trainerId: string;
    trainerName: string;
}

export function TrainerHistoryPopover({ trainerId, trainerName }: TrainerHistoryPopoverProps) {
    const [open, setOpen] = useState(false);
    const [details, setDetails] = useState<(ActivityDetail & { activityType: string })[] | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOpen(isOpen: boolean) {
        setOpen(isOpen);
        if (isOpen && details === null) {
            startTransition(async () => {
                try {
                    const result = await getTrainerFullHistory({ trainerId });
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-700">
                    <History className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
                <div className="border-b border-zinc-200 px-3 py-2.5">
                    <p className="text-xs font-medium text-zinc-500">Histórico completo</p>
                    <p className="text-sm font-semibold text-zinc-900">{trainerName}</p>
                </div>

                <div className="max-h-72 overflow-y-auto">
                    {isPending ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                    ) : details && details.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-zinc-400">Nenhum registro</p>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {details?.map((item) => (
                                <div key={item.id} className="flex items-start gap-2.5 px-3 py-2.5">
                                    <span className="mt-0.5 shrink-0">
                                        {TYPE_ICONS[item.activityType] || <History className="h-3.5 w-3.5 text-zinc-400" />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm text-zinc-700">{item.detail}</p>
                                        <p className="mt-0.5 text-xs text-zinc-400">
                                            {formatRelativeDate(item.occurredAt)}
                                        </p>
                                    </div>
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
