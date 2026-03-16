'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { markAttendance, markPublicAttendance } from '@/app/actions/attendance';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/types/database';

interface AttendanceCheckboxProps {
    entryId: string;
    status: AttendanceStatus;
    name: string;
    isGuest?: boolean;
    publicMode?: boolean;
    publicToken?: string;
    highlighted?: boolean;
}

const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
    pending: 'present',
    present: 'absent',
    absent: 'pending',
};

export function AttendanceCheckbox({
    entryId,
    status,
    name,
    isGuest = false,
    publicMode = false,
    publicToken,
    highlighted = false,
}: AttendanceCheckboxProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

    function handleClick(e: React.MouseEvent) {
        e.stopPropagation();

        const nextStatus = NEXT_STATUS[optimisticStatus];

        startTransition(async () => {
            setOptimisticStatus(nextStatus);

            try {
                if (publicMode && publicToken) {
                    await markPublicAttendance({ entryId, status: nextStatus, token: publicToken });
                } else {
                    await markAttendance({ entryId, status: nextStatus });
                }

                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao marcar presença');
            }
        });
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 transition',
                isPending && 'opacity-60',
                optimisticStatus === 'present' && 'bg-emerald-50 ring-emerald-200',
                optimisticStatus === 'absent' && 'bg-red-50/60 ring-red-200',
                optimisticStatus === 'pending' && 'bg-white ring-zinc-200',
                highlighted && 'ring-2 ring-emerald-400',
            )}
        >
            <span
                className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                    optimisticStatus === 'present' && 'border-emerald-500 bg-emerald-500 text-white',
                    optimisticStatus === 'absent' && 'border-red-400 bg-red-400 text-white',
                    optimisticStatus === 'pending' && 'border-zinc-300 bg-white',
                )}
            >
                {optimisticStatus === 'present' && <Check className="h-3 w-3" />}
                {optimisticStatus === 'absent' && <X className="h-3 w-3" />}
                {optimisticStatus === 'pending' && <Minus className="h-3 w-3 text-zinc-300" />}
            </span>
            <span
                className={cn(
                    'truncate text-sm font-medium',
                    isGuest && 'italic',
                    highlighted && 'text-emerald-700 font-semibold',
                    !highlighted && optimisticStatus === 'present' && 'text-zinc-900',
                    !highlighted && optimisticStatus === 'absent' && 'text-zinc-400 line-through',
                    !highlighted && optimisticStatus === 'pending' && 'text-zinc-500',
                )}
            >
                {name}
            </span>
        </button>
    );
}
