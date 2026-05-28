'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AppNotification } from '@/types/database';

export async function getNotifications(limit = 20): Promise<AppNotification[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    return (data || []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
    return count ?? 0;
}

export async function markNotificationRead(id: string) {
    const supabase = await createClient();
    await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function markAllNotificationsRead() {
    const supabase = await createClient();
    await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false);
    revalidatePath('/dashboard');
    return { success: true };
}
