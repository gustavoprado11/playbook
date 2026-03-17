'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WEEKDAY_OPTIONS } from '@/lib/attendance';
import type { ReactNode } from 'react';

export type AttendanceDetail = {
    studentName: string;
    isGuest: boolean;
    trainerName: string;
    weekday: number;
    startTime: string;
};

interface AttendanceStatsPopoverProps {
    title: string;
    count: number;
    details: AttendanceDetail[];
    variant: 'present' | 'absent';
    children: ReactNode;
}

export function AttendanceStatsPopover({ title, count, details, variant, children }: AttendanceStatsPopoverProps) {
    const grouped = new Map<number, AttendanceDetail[]>();
    for (const d of details) {
        if (!grouped.has(d.weekday)) grouped.set(d.weekday, []);
        grouped.get(d.weekday)!.push(d);
    }

    // Sort each group by startTime then studentName
    for (const entries of grouped.values()) {
        entries.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.studentName.localeCompare(b.studentName));
    }

    const sortedDays = Array.from(grouped.keys()).sort((a, b) => a - b);
    const dayLabel = (weekday: number) =>
        WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label || `Dia ${weekday}`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[400px] overflow-y-auto p-4" align="start" sideOffset={8}>
                <p className="text-sm font-semibold text-zinc-900 mb-3">
                    {title} ({count})
                </p>

                {details.length === 0 ? (
                    <p className="text-sm text-zinc-400">Nenhum registro</p>
                ) : (
                    <div className="space-y-3">
                        {sortedDays.map((weekday) => (
                            <div key={weekday}>
                                <p className="text-xs font-medium text-zinc-500 mb-1">{dayLabel(weekday)}</p>
                                <div className="space-y-0.5">
                                    {grouped.get(weekday)!.map((d, i) => (
                                        <p
                                            key={i}
                                            className={`text-sm ${variant === 'absent' ? 'text-red-600' : 'text-zinc-700'}`}
                                        >
                                            <span className="text-zinc-400">{d.startTime.slice(0, 5)}</span>
                                            {' · '}
                                            {d.isGuest ? (
                                                <span className="italic">{d.studentName} (avulso)</span>
                                            ) : (
                                                <span>{d.studentName}</span>
                                            )}
                                            <span className="text-zinc-400"> — {d.trainerName}</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
