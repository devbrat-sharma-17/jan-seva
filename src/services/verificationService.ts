// ============================================================
// Verification Service — deferred re-check & audit sampling
// ============================================================
//
// A citizen standing next to a fresh patch will confirm it. Whether the
// patch is still there in November is the question that actually matters,
// and until now nobody asked it — the complaint left public tracking 48
// hours after resolution and the record went quiet.
//
// Two mechanisms, deliberately different in kind:
//
//   1. DEFERRED VERIFICATION asks the citizen again at 30 and 90 days.
//      One tap. Two prompts, ever.
//   2. AUDIT SAMPLING re-inspects a fixed share of closures with an
//      officer who did not do the work. This is the field-validation
//      mechanism — the thing a Washington DC rat-infestation model
//      lacked when it validated on held-out 311 data and then failed
//      against actual field inspections.
//
// Both feed the Resolution Quality Score, which is what converts
// "resolved" from an event into a claim with a durability record.

import type { Complaint, DurabilityCheckpoint } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after a citizen confirmation at which the fix is re-checked. */
export const CHECKPOINT_OFFSETS: Array<30 | 90> = [30, 90];

/**
 * Share of confirmed closures pulled for independent re-inspection.
 *
 * 8% is a working audit rate: high enough that a department cannot
 * assume any given closure will go unchecked, low enough not to consume
 * the field capacity the Work Card exists to protect.
 */
export const AUDIT_SAMPLE_RATE = 0.08;

/**
 * Opens the watch window on a confirmed resolution.
 *
 * Called when the CITIZEN confirms, never when the department submits.
 * A department's own closure is a claim; the window measures how long
 * the citizen's agreement with that claim survives contact with time.
 */
export function openWatchWindow(confirmedAtIso: string): NonNullable<Complaint['verification']> {
  const confirmedAt = new Date(confirmedAtIso).getTime();

  const checkpoints: DurabilityCheckpoint[] = CHECKPOINT_OFFSETS.map((dayOffset) => ({
    dayOffset,
    dueAt: new Date(confirmedAt + dayOffset * DAY_MS).toISOString(),
  }));

  return { watchStartedAt: confirmedAtIso, checkpoints };
}

/** Checkpoints that are due, unasked, and still worth asking about. */
export function dueCheckpoints(
  complaint: Complaint,
  now: number = Date.now()
): DurabilityCheckpoint[] {
  const checkpoints = complaint.verification?.checkpoints ?? [];

  return checkpoints.filter((cp) => {
    if (cp.outcome) return false;
    return new Date(cp.dueAt).getTime() <= now;
  });
}

/**
 * The one checkpoint to put in front of a citizen right now.
 *
 * Notification fatigue is the risk that kills this feature. Only ever
 * one prompt at a time, the earliest outstanding one, and never a third
 * after the 90-day check has been answered or has lapsed.
 */
export function nextPrompt(
  complaint: Complaint,
  now: number = Date.now()
): DurabilityCheckpoint | null {
  const due = dueCheckpoints(complaint, now);
  if (due.length === 0) return null;
  return due.sort((a, b) => a.dayOffset - b.dayOffset)[0];
}

/** Records a citizen's answer to a durability prompt. */
export function answerCheckpoint(
  verification: NonNullable<Complaint['verification']>,
  dayOffset: 30 | 90,
  outcome: 'holding' | 'failed' | 'no-response',
  note?: string
): NonNullable<Complaint['verification']> {
  return {
    ...verification,
    checkpoints: (verification.checkpoints ?? []).map((cp) =>
      cp.dayOffset === dayOffset
        ? { ...cp, outcome, note, respondedAt: new Date().toISOString(), askedAt: cp.askedAt ?? new Date().toISOString() }
        : cp
    ),
  };
}

// ------------------------------------------------------------
// Random audit sampling
// ------------------------------------------------------------

/**
 * Deterministic 0-1 draw from a complaint ID.
 *
 * Deliberately NOT `Math.random()`. A random draw would re-roll on every
 * render, so a complaint would drift in and out of the audit sample as
 * the page refreshed, and nobody could reproduce a sampling decision
 * afterwards. Hashing the ID makes the sample stable, auditable and
 * reproducible from the record alone — which is what an audit sample has
 * to be to mean anything.
 */
function sampleDraw(complaintId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < complaintId.length; i += 1) {
    hash ^= complaintId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 10000) / 10000;
}

/** Whether this complaint falls into the independent re-inspection sample. */
export function isAuditSampled(complaintId: string, rate: number = AUDIT_SAMPLE_RATE): boolean {
  return sampleDraw(complaintId) < rate;
}

/**
 * Closures currently owed an independent re-inspection.
 *
 * Only citizen-confirmed resolutions are eligible: re-inspecting a job
 * the citizen has already disputed tells you nothing you did not know,
 * and the capacity is better spent on the closures everyone believes.
 */
export function getAuditQueue(complaints: Complaint[]): Complaint[] {
  return complaints
    .filter((c) => c.status === 'resolved')
    .filter((c) => c.resolution?.citizenVerifiedResolved)
    .filter((c) => isAuditSampled(c.id))
    .filter((c) => (c.verification?.auditOutcome ?? 'pending') === 'pending')
    .sort(
      (a, b) =>
        new Date(a.resolution?.resolvedAt ?? a.updatedAt).getTime() -
        new Date(b.resolution?.resolvedAt ?? b.updatedAt).getTime()
    );
}

export interface DurabilityStats {
  /** Confirmed closures old enough for at least one checkpoint to be due. */
  watched: number;
  /** Checkpoints answered "still fixed". */
  holding: number;
  /** Checkpoints answered "failed again". */
  failed: number;
  /** Checkpoints that came due and were never answered. */
  noResponse: number;
  /**
   * holding / (holding + failed). Null until at least one checkpoint has
   * been answered — an unmeasured durability rate is reported as
   * unmeasured, never as 100%.
   */
  durabilityRate: number | null;
  auditsCompleted: number;
  auditsUpheld: number;
  /** upheld / completed, or null with nothing completed. */
  auditPassRate: number | null;
}

/** Durability across a set of complaints. Feeds the quality score. */
export function computeDurabilityStats(complaints: Complaint[]): DurabilityStats {
  let watched = 0;
  let holding = 0;
  let failed = 0;
  let noResponse = 0;
  let auditsCompleted = 0;
  let auditsUpheld = 0;

  for (const c of complaints) {
    const checkpoints = c.verification?.checkpoints ?? [];
    if (checkpoints.length > 0) watched += 1;

    for (const cp of checkpoints) {
      if (cp.outcome === 'holding') holding += 1;
      else if (cp.outcome === 'failed') failed += 1;
      else if (cp.outcome === 'no-response') noResponse += 1;
    }

    const outcome = c.verification?.auditOutcome;
    if (outcome === 'upheld' || outcome === 'failed') {
      auditsCompleted += 1;
      if (outcome === 'upheld') auditsUpheld += 1;
    }
  }

  const answered = holding + failed;

  return {
    watched,
    holding,
    failed,
    noResponse,
    durabilityRate: answered > 0 ? Math.round((holding / answered) * 100) : null,
    auditsCompleted,
    auditsUpheld,
    auditPassRate: auditsCompleted > 0 ? Math.round((auditsUpheld / auditsCompleted) * 100) : null,
  };
}
