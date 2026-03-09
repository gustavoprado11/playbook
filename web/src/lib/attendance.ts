import { addDays, format, startOfWeek } from 'date-fns';

export const WEEKDAY_OPTIONS = [
  { value: 1, short: 'Seg', label: 'Segunda' },
  { value: 2, short: 'Ter', label: 'Terca' },
  { value: 3, short: 'Qua', label: 'Quarta' },
  { value: 4, short: 'Qui', label: 'Quinta' },
  { value: 5, short: 'Sex', label: 'Sexta' },
] as const;

export function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function buildWorkWeek(date: Date) {
  const start = getWeekStart(date);

  return WEEKDAY_OPTIONS.map((day, index) => ({
    ...day,
    date: addDays(start, index),
    isoDate: format(addDays(start, index), 'yyyy-MM-dd'),
  }));
}

export function formatTimeLabel(time: string) {
  return time.slice(0, 5);
}

export function normalizeTimeInput(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}
