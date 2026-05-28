'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowRightLeft, CheckCircle, MessageSquare, ShieldAlert, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { timeAgo } from '@/components/referrals/referral-ui';
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications';
import type { AppNotification, NotificationType } from '@/types/database';

const typeIcon: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
    referral_received: ArrowRightLeft,
    referral_status_changed: CheckCircle,
    referral_replied: MessageSquare,
    clearance_issued: ShieldAlert,
    shared_note_added: StickyNote,
};

interface Props {
    initialNotifications: AppNotification[];
    initialUnread: number;
}

export function NotificationBell({ initialNotifications, initialUnread }: Props) {
    const router = useRouter();
    const [items, setItems] = useState(initialNotifications);
    const [unread, setUnread] = useState(initialUnread);

    async function openItem(n: AppNotification) {
        if (!n.is_read) {
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
            setUnread((u) => Math.max(0, u - 1));
            await markNotificationRead(n.id);
        }
        if (n.link) router.push(n.link);
    }

    async function markAll() {
        setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
        setUnread(0);
        await markAllNotificationsRead();
        router.refresh();
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100" aria-label="Notificações">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
                    <span className="text-sm font-semibold text-zinc-900">Notificações</span>
                    {unread > 0 && (
                        <button onClick={markAll} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                            Marcar todas como lidas
                        </button>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-zinc-400">Nenhuma notificação.</p>
                    ) : (
                        items.map((n) => {
                            const Icon = typeIcon[n.type] ?? Bell;
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => openItem(n)}
                                    className={cn(
                                        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50',
                                        !n.is_read && 'bg-emerald-50/50'
                                    )}
                                >
                                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                                        {n.body && <p className="truncate text-xs text-zinc-500">{n.body}</p>}
                                        <p className="mt-0.5 text-[11px] text-zinc-400">{timeAgo(n.created_at)}</p>
                                    </div>
                                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
