// ============================================================
// Citizen Warning Service (spec §19, §29, §47)
// ============================================================
//
// A queue, deliberately — not a send.
//
// Spec §47: a failed SMS must never roll back the moderation decision it
// followed. So the decision commits first and a warning is enqueued
// here; draining is a separate concern that may fail, retry or be
// suppressed without touching the case. Nothing in this file can undo a
// moderation outcome, because it has no way to reach one.
//
//   NOTHING IS ACTUALLY SENT YET.
//   There is no SMS provider configured (see the previous phase — Indian
//   A2P delivery needs TRAI DLT registration first). Entries queue and
//   stay PENDING. That is the honest state, and `drain` says so rather
//   than marking them SENT to make a dashboard look finished.
//
// Two gates before anything is queued at all:
//   1. CITIZEN_WARNING_ENABLED, which is OFF by default.
//   2. A verified identity reference. An unverified reporter has no
//      channel and gets no warning (spec §20) — and Aadhaar is never
//      that channel, because there is no UIDAI integration and a masked
//      reference is not a phone number.

import type { AbuseAction } from '../types/screening';
import { CITIZEN_WARNING_ENABLED } from '../config/featureFlags';
import { readJSON, writeJSON, subscribeToKey } from './storage';

const QUEUE_KEY = 'jan_seva_citizen_warnings_v1';

export type WarningStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';

export type WarningEvent =
  | 'MODERATION_INVALID'
  | 'MODERATION_SPAM'
  | 'CITIZEN_WARNING'
  | 'REPEAT_ABUSE_WARNING'
  | 'TEMPORARY_RESTRICTION';

export interface QueuedWarning {
  id: string;
  event: WarningEvent;
  /** Opaque. Resolved to a number by the provider adapter at send time. */
  identityReference: string;
  complaintId: string;
  message: string;
  status: WarningStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

function readQueue(): QueuedWarning[] {
  const stored = readJSON<QueuedWarning[] | null>(QUEUE_KEY, null);
  return Array.isArray(stored) ? stored : [];
}

function writeQueue(queue: QueuedWarning[]): void {
  try {
    writeJSON(QUEUE_KEY, queue);
  } catch {
    // A full store must not take a moderation decision down with it.
  }
}

export function getWarningQueue(): QueuedWarning[] {
  return readQueue();
}

export function subscribeToWarnings(onChange: () => void): () => void {
  return subscribeToKey(QUEUE_KEY, onChange);
}

function eventFor(action: AbuseAction): WarningEvent {
  switch (action.kind) {
    case 'WARNING':
      return 'CITIZEN_WARNING';
    case 'WARNING_AND_COOLDOWN':
      return 'REPEAT_ABUSE_WARNING';
    case 'MANUAL_REVIEW_REQUIRED':
      return 'TEMPORARY_RESTRICTION';
    default:
      return 'CITIZEN_WARNING';
  }
}

export interface QueueResult {
  queued: boolean;
  /** Why not, when it was not. Shown to the moderator, never the citizen. */
  reason?: 'DISABLED' | 'NO_VERIFIED_CHANNEL' | 'NO_ACTION';
}

/**
 * Queues the notice that follows a CONFIRMED moderation outcome.
 *
 * Never throws. The caller has already committed a decision, and this is
 * the step that must not be able to disturb it.
 */
export function queueWarning(input: {
  action: AbuseAction;
  identityReference?: string;
  complaintId: string;
  now?: number;
}): QueueResult {
  if (input.action.kind === 'NONE') return { queued: false, reason: 'NO_ACTION' };
  if (!CITIZEN_WARNING_ENABLED) return { queued: false, reason: 'DISABLED' };
  if (!input.identityReference) return { queued: false, reason: 'NO_VERIFIED_CHANNEL' };

  const now = input.now ?? Date.now();

  try {
    writeQueue([
      ...readQueue(),
      {
        id: `warn-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        event: eventFor(input.action),
        identityReference: input.identityReference,
        complaintId: input.complaintId,
        message: input.action.message,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date(now).toISOString(),
      },
    ]);
    return { queued: true };
  } catch {
    return { queued: false, reason: 'DISABLED' };
  }
}

/**
 * Would drain the queue through the SMS provider.
 *
 * Returns what it did, which is currently nothing: with no provider
 * configured there is no channel, and marking entries SENT would put a
 * false delivery record next to a citizen's name. Wiring this to the
 * `notificationService` abstraction from the previous phase is a
 * one-function change, exactly as the sync queue's `transmit` is.
 */
export function drainWarnings(): { sent: number; pending: number; providerConfigured: boolean } {
  const queue = readQueue();
  return {
    sent: 0,
    pending: queue.filter((w) => w.status === 'PENDING' || w.status === 'RETRYING').length,
    providerConfigured: false,
  };
}

/** Self-test support. Never called from the app. */
export function resetWarningQueueForTest(): void {
  writeQueue([]);
}
