// ============================================================
// Time Service — Formatting & relative stamps
// ============================================================
// Timeline events store ISO strings. Display strings are derived at
// render time so a complaint filed "2 hours ago" keeps ageing instead
// of freezing at whatever the clock said when it was written.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "28 Aug, 9:30 AM" — the absolute stamp used on timeline nodes. */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "28 Aug 2026" — for SLA due dates and receipts. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "28 Aug 2026, 9:30 AM" — for detailed complaint headers. */
export function formatDateLong(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}


/** "just now" / "12 min ago" / "3 hours ago" / "2 days ago". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const delta = now - then;
  if (delta < 0) return 'just now';
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) {
    const mins = Math.floor(delta / MINUTE);
    return `${mins} min ago`;
  }
  if (delta < DAY) {
    const hours = Math.floor(delta / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(delta / DAY);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

/** "2 days 4 hrs" — a countdown, for time left against an SLA. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) {
    const mins = Math.max(1, Math.floor(abs / MINUTE));
    return `${mins} min`;
  }
  if (abs < DAY) {
    const hours = Math.floor(abs / HOUR);
    const mins = Math.floor((abs % HOUR) / MINUTE);
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }
  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  return hours > 0 ? `${days} day${days === 1 ? '' : 's'} ${hours} hr` : `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Accepts either an ISO string or a legacy pre-formatted display string
 * (the demo seed data stored "28 Aug, 9:30 AM"). Legacy values pass
 * through untouched so old entries keep rendering.
 */
export function displayStamp(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatStamp(value);
}

export function displayRelative(value: string, now: number = Date.now()): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatRelative(value, now);
}
