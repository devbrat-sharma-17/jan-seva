// ============================================================
// SLA Service — Live turnaround computation
// ============================================================
// SLA health was persisted as a fixed `hoursRemaining` number, so a
// complaint read "48 hours remaining" a week after it was filed. The
// stored `dueAt` is the only durable fact; health is derived from it
// against the current clock on every read.

import type { ComplaintStatus } from '../types';
import { formatDuration } from './timeService';

/**
 * The minimum a record needs for SLA maths. Declared structurally so both
 * `Complaint` and the redacted `PublicComplaint` satisfy it — the public
 * view shows the same countdown, and neither needs casting.
 */
export interface SlaSubject {
  createdAt: string;
  updatedAt: string;
  status: ComplaintStatus;
  sla?: { dueAt: string };
  resolution?: { resolvedAt?: string };
}

export type SlaStatus = 'normal' | 'approaching' | 'exceeded' | 'met';

/** Inside this window before `dueAt`, the SLA is "approaching". */
const APPROACHING_WINDOW_MS = 8 * 60 * 60 * 1000;

export interface SlaHealth {
  status: SlaStatus;
  /** Negative once the due time has passed. */
  msRemaining: number;
  hoursRemaining: number;
  /** "1 day 4 hr" — magnitude only; read `status` for the direction. */
  label: string;
  /** Ready-to-render headline, e.g. "SLA exceeded by 2 days 3 hr". */
  headline: string;
  /** 0-1, how much of the SLA window has elapsed. Clamped. */
  progress: number;
  isBreached: boolean;
}

/**
 * Derives current SLA health. A resolved complaint is frozen at the
 * moment it was resolved — its clock stopped, so it must not keep
 * counting down into a breach it never had.
 */
export function computeSlaHealth(complaint: SlaSubject, now: number = Date.now()): SlaHealth | null {
  const dueAtRaw = complaint.sla?.dueAt;
  if (!dueAtRaw) return null;

  const dueAt = new Date(dueAtRaw).getTime();
  if (Number.isNaN(dueAt)) return null;

  const createdAt = new Date(complaint.createdAt).getTime();
  const isResolved = complaint.status === 'resolved';

  // Stop the clock at resolution time for anything already closed.
  const referenceNow = isResolved
    ? new Date(complaint.resolution?.resolvedAt || complaint.updatedAt || complaint.createdAt).getTime()
    : now;

  const msRemaining = dueAt - referenceNow;
  const hoursRemaining = Math.round(msRemaining / (60 * 60 * 1000));

  let status: SlaStatus;
  if (isResolved) {
    status = 'met';
  } else if (msRemaining <= 0) {
    status = 'exceeded';
  } else if (msRemaining <= APPROACHING_WINDOW_MS) {
    status = 'approaching';
  } else {
    status = 'normal';
  }

  const label = formatDuration(msRemaining);

  let headline: string;
  if (status === 'met') {
    headline = msRemaining >= 0 ? `Resolved within the ${label} target` : 'Resolved after the target date';
  } else if (status === 'exceeded') {
    headline = `SLA exceeded by ${label} — escalated`;
  } else if (status === 'approaching') {
    headline = `${label} left to meet the SLA target`;
  } else {
    headline = `Expected resolution in ${label}`;
  }

  const window = dueAt - createdAt;
  const elapsed = referenceNow - createdAt;
  const progress = window > 0 ? Math.min(1, Math.max(0, elapsed / window)) : 1;

  return {
    status,
    msRemaining,
    hoursRemaining,
    label,
    headline,
    progress,
    isBreached: status === 'exceeded',
  };
}

/** Maps SLA health onto the `--sla-*` token family. */
export function slaToneClass(status: SlaStatus): string {
  if (status === 'exceeded') return 'sla-card--exceeded';
  if (status === 'approaching') return 'sla-card--approaching';
  if (status === 'met') return 'sla-card--met';
  return 'sla-card--normal';
}

/** Turnaround targets in hours, by routed department. */
export const SLA_TARGET_HOURS: Record<string, number> = {
  pwd: 72,
  sanitation: 24,
  water_works: 12,
  electrical: 48,
  urban_infra: 96,
};

export function slaTargetFor(department: string | undefined): number {
  return (department && SLA_TARGET_HOURS[department]) || 48;
}
