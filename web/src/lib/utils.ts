import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInDays, format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatMonthYear(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'MMMM yyyy', { locale: ptBR });
}

export function getFirstDayOfMonth(date?: Date): string {
    const d = date || new Date();
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
}

export function getMonthOptions(count: number = 6): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push({
            value: format(date, 'yyyy-MM-dd'),
            label: formatMonthYear(date),
        });
    }

    return options;
}

export function formatRelativeDate(dateStr: string | null): string {
    if (!dateStr) return 'Nunca';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `Há ${Math.max(diffMins, 1)} minutos`;
    if (isToday(date)) return `Hoje, ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return `Ontem, ${format(date, 'HH:mm')}`;

    const days = differenceInDays(now, date);
    if (days < 7) return `Há ${days} dias`;
    if (days < 30) return `Há ${Math.floor(days / 7)} semanas`;
    return format(date, 'dd/MM/yyyy');
}

export type ActivityUrgency = 'green' | 'yellow' | 'red';

export function getActivityUrgency(dateStr: string | null): ActivityUrgency {
    if (!dateStr) return 'red';
    const days = differenceInDays(new Date(), new Date(dateStr));
    if (days <= 7) return 'green';
    if (days <= 14) return 'yellow';
    return 'red';
}
