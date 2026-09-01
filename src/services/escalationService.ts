// ============================================================
// Escalation Service — a ladder of posts, not a string
// ============================================================
//
// `escalatedTo: 'Municipal Commissioner & Department Head'` was text.
// Nobody's queue grew. Nobody became accountable for the escalation
// itself, and no clock started on it. An escalation that costs its
// recipient nothing is a label, not a state.
//
// Here a level is a POST — not a person, because posts outlive postings
// — with its own response window and its own visible backlog.
//
//   ON PUBLISHING BACKLOGS.
//   Naming a serving officer's open-escalation count in public is
//   politically fraught enough to block adoption of the whole platform.
//   So `publiclyVisible` is a per-post configuration decision that
//   defaults to false above Level 1, and the Command Centre sees every
//   level regardless. Build the ladder and the timers; let the city
//   decide what to expose.

import type { EscalationPost, EscalationQueueState } from '../types/field';
import type { Complaint } from '../types';
import { computeSlaHealth } from './slaService';

const HOUR_MS = 60 * 60 * 1000;

/**
 * The Gwalior ladder.
 *
 * Response windows shorten as the ladder rises: a complaint that has
 * already burned a department's 72 hours does not get another 72 from
 * the Additional Commissioner.
 */
export const ESCALATION_LADDER: EscalationPost[] = [
  {
    level: 1,
    postTitle: 'Departmental Nodal Officer',
    shortTitle: 'Nodal Officer',
    responseHours: 24,
    publiclyVisible: true,
  },
  {
    level: 2,
    postTitle: 'Additional Municipal Commissioner',
    shortTitle: 'Addl. Commissioner',
    responseHours: 48,
    publiclyVisible: false,
  },
  {
    level: 3,
    postTitle: 'Municipal Commissioner',
    shortTitle: 'Commissioner',
    responseHours: 72,
    publiclyVisible: false,
  },
];

export function postForLevel(level: number): EscalationPost {
  return ESCALATION_LADDER.find((p) => p.level === level) ?? ESCALATION_LADDER[0];
}

/**
 * Which level a complaint currently sits at.
 *
 * Derived from how long it has been breached rather than from a stored
 * field, for the same reason SLA health is derived: a snapshot written
 * at escalation time is wrong an hour later.
 */
export function currentLevel(complaint: Complaint, now: number = Date.now()): number {
  if (complaint.status === 'resolved') return 0;

  const health = computeSlaHealth(complaint, now);
  if (!health || health.status !== 'exceeded') {
    // A manual escalation counts even before the SLA lapses — an admin
    // escalating early is making a judgement the clock has not reached.
    return complaint.sla.escalatedAt ? 1 : 0;
  }

  const breachedHours = Math.abs(health.msRemaining) / HOUR_MS;

  // Each level's window must elapse before the next one engages.
  let level = 1;
  let consumed = 0;
  for (const post of ESCALATION_LADDER) {
    consumed += post.responseHours;
    if (breachedHours > consumed) level = Math.min(ESCALATION_LADDER.length, post.level + 1);
  }
  return level;
}

/** Hours this complaint has been sitting in its current level's queue. */
export function hoursAtLevel(complaint: Complaint, now: number = Date.now()): number {
  const anchor = complaint.sla.escalatedAt
    ? new Date(complaint.sla.escalatedAt).getTime()
    : new Date(complaint.sla.dueAt).getTime();
  return Math.max(0, (now - anchor) / HOUR_MS);
}

/**
 * The state of every rung, so the ladder can be rendered as queues with
 * clocks rather than as a badge on a card.
 */
export function getLadderState(
  complaints: Complaint[],
  now: number = Date.now()
): EscalationQueueState[] {
  return ESCALATION_LADDER.map((post) => {
    const inQueue = complaints.filter(
      (c) => c.status !== 'resolved' && currentLevel(c, now) === post.level
    );

    const ages = inQueue.map((c) => hoursAtLevel(c, now));

    return {
      post,
      openCount: inQueue.length,
      oldestHours: ages.length > 0 ? Math.round(Math.max(...ages)) : null,
      overdueCount: ages.filter((h) => h > post.responseHours).length,
      complaintIds: inQueue.map((c) => c.id),
    };
  });
}

/** "Level 2 — Addl. Commissioner: 14 open escalations, oldest 9 days." */
export function describeQueue(state: EscalationQueueState): string {
  if (state.openCount === 0) {
    return `Level ${state.post.level} — ${state.post.shortTitle}: queue clear`;
  }

  const oldest = state.oldestHours ?? 0;
  const age = oldest >= 48 ? `${Math.round(oldest / 24)} days` : `${Math.round(oldest)} h`;

  return `Level ${state.post.level} — ${state.post.shortTitle}: ${state.openCount} open escalation${
    state.openCount === 1 ? '' : 's'
  }, oldest ${age}`;
}
