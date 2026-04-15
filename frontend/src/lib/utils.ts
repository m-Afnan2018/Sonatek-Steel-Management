import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy HH:mm');
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'var(--danger)';
    case 'high': return 'var(--warning)';
    case 'medium': return 'var(--primary)';
    case 'low': return 'var(--success)';
    default: return 'var(--text-secondary)';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'done':
    case 'completed':
    case 'present':
      return 'var(--success)';
    case 'in_progress':
    case 'active':
    case 'remote':
      return 'var(--primary)';
    case 'in_review':
    case 'on_hold':
    case 'half_day':
      return 'var(--warning)';
    case 'backlog':
    case 'planning':
      return 'var(--text-secondary)';
    case 'absent':
    case 'leave':
      return 'var(--danger)';
    default:
      return 'var(--text-secondary)';
  }
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
