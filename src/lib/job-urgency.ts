import { differenceInCalendarDays, isWeekend, addDays } from 'date-fns';

export type UrgencyLevel = 'none' | 'green' | 'yellow' | 'red' | 'overdue';

/**
 * Count business days remaining between now and a due date.
 */
function getBusinessDaysRemaining(dueDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  if (due <= today) return differenceInCalendarDays(due, today); // negative or 0
  
  let count = 0;
  let current = new Date(today);
  while (current < due) {
    current = addDays(current, 1);
    if (!isWeekend(current)) count++;
  }
  return count;
}

export function getUrgencyLevel(dueDate: string | null | undefined, status?: string): UrgencyLevel {
  if (!dueDate) return 'none';
  if (status === 'completed') return 'none';
  
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return 'none';
  
  const bdays = getBusinessDaysRemaining(due);
  
  if (bdays <= 0) return 'overdue';
  if (bdays <= 2) return 'red';
  if (bdays <= 5) return 'yellow';
  return 'green';
}

export function getUrgencyLabel(dueDate: string | null | undefined, status?: string): string {
  if (!dueDate) return '';
  if (status === 'completed') return '';
  
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return '';
  
  const bdays = getBusinessDaysRemaining(due);
  
  if (bdays <= 0) return `${Math.abs(bdays)} day${Math.abs(bdays) !== 1 ? 's' : ''} overdue`;
  return `${bdays} business day${bdays !== 1 ? 's' : ''} left`;
}

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  none: '',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  overdue: 'bg-zinc-900 dark:bg-zinc-100',
};

export const URGENCY_BORDER_COLORS: Record<UrgencyLevel, string> = {
  none: '',
  green: 'border-l-emerald-500',
  yellow: 'border-l-amber-400',
  red: 'border-l-red-500',
  overdue: 'border-l-zinc-900 dark:border-l-zinc-100',
};

export const URGENCY_TEXT_COLORS: Record<UrgencyLevel, string> = {
  none: 'text-muted-foreground',
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  overdue: 'text-zinc-900 dark:text-zinc-100',
};
