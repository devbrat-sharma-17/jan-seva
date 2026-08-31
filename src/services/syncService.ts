// ============================================================
// Sync Service — pending operation queue
// ============================================================
//
// An officer standing in a service lane with one bar of signal must not
// lose a progress note. Every portal mutation writes to the local store
// immediately and, when the device is offline, also lands here. The queue
// survives a reload, drains when the connection returns, and retries with
// backoff instead of giving up.
//
// In this build the "server" is simulated: draining an operation means
// acknowledging it after a short delay. The queue, the retry policy and
// the states the UI renders are all real, so swapping the drain step for
// a real API call is the only change a backend needs.
//
//     syncService.enqueue(op)  ->  local store already written
//                              ->  drain when online
//                              ->  POST /complaints/:id/... (future)

import { readJSON, writeJSON } from './storage';
import {
  reportPendingCount,
  reportSyncFailed,
  reportSyncStarted,
  reportSyncSucceeded,
  getNetworkSnapshot,
  subscribeToNetwork,
} from './networkService';

const QUEUE_STORAGE_KEY = 'jan_seva_sync_queue_v1';

export type SyncOperationType =
  | 'ASSIGN_COMPLAINT'
  | 'START_WORK'
  | 'ADD_PROGRESS_UPDATE'
  | 'SUBMIT_RESOLUTION'
  | 'ACCEPT_REINSPECTION'
  | 'REASSIGN_DEPARTMENT'
  | 'MANUAL_ESCALATION';

export type SyncOperationStatus = 'pending' | 'in-flight' | 'failed';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  /** The complaint this operation targets. */
  entityId: string;
  /** Human-readable summary for the pending-changes list. */
  summary: string;
  /**
   * Minimal descriptor of what changed. Never carries citizen identity,
   * photos or free text beyond what the summary already shows — a queue
   * that outlives a session should not be a copy of the record.
   */
  payload: Record<string, string | number | boolean>;
  createdAt: string;
  status: SyncOperationStatus;
  retryCount: number;
  lastError?: string;
}

type Listener = (operations: SyncOperation[]) => void;

const listeners = new Set<Listener>();

/** Backoff between drain attempts, capped so a long outage still retries. */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
const MAX_RETRIES = 8;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let draining = false;

function readQueue(): SyncOperation[] {
  const stored = readJSON<SyncOperation[] | null>(QUEUE_STORAGE_KEY, null);
  return Array.isArray(stored) ? stored : [];
}

function writeQueue(queue: SyncOperation[]): void {
  try {
    writeJSON(QUEUE_STORAGE_KEY, queue);
  } catch {
    // The queue is a durability nicety; the mutation itself already
    // reached the store. Losing the queue must never lose the change.
  }
  reportPendingCount(queue.length);
  const snapshot = queue.slice();
  listeners.forEach((listener) => listener(snapshot));
}

export function getPendingOperations(): SyncOperation[] {
  return readQueue();
}

export function subscribeToSyncQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function newOperationId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface EnqueueInput {
  type: SyncOperationType;
  entityId: string;
  summary: string;
  payload?: Record<string, string | number | boolean>;
}

/**
 * Records an operation that still needs to reach the server.
 *
 * Called after the local write has already succeeded, so a full queue or
 * a blocked store can never cost the user their change.
 */
export function enqueue(input: EnqueueInput): SyncOperation {
  const operation: SyncOperation = {
    id: newOperationId(),
    type: input.type,
    entityId: input.entityId,
    summary: input.summary,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  writeQueue([...readQueue(), operation]);

  if (getNetworkSnapshot().isOnline) {
    void drainQueue();
  }

  return operation;
}

/**
 * Simulated server acknowledgement.
 *
 * Replace this one function with the real API call and the rest of the
 * queue — ordering, retries, backoff, the states the UI shows — works
 * unchanged.
 */
async function transmit(_operation: SyncOperation): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (!getNetworkSnapshot().isOnline) {
    throw new Error('offline');
  }
}

function scheduleRetry(attempt: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drainQueue();
  }, delay);
}

/**
 * Sends everything outstanding, oldest first. Ordering matters: a
 * resolution must not be acknowledged before the assignment that preceded
 * it, so a failure stops the pass rather than skipping ahead.
 */
export async function syncPendingOperations(): Promise<void> {
  return drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;

  let queue = readQueue();
  if (queue.length === 0) return;

  if (!getNetworkSnapshot().isOnline) return;

  draining = true;
  reportSyncStarted();

  try {
    while (queue.length > 0) {
      const [next] = queue;

      try {
        await transmit(next);
        queue = readQueue().filter((op) => op.id !== next.id);
        writeQueue(queue);
      } catch (err) {
        const retryCount = next.retryCount + 1;
        const message = err instanceof Error ? err.message : 'unknown';

        queue = readQueue().map((op) =>
          op.id === next.id
            ? { ...op, status: 'failed' as const, retryCount, lastError: message }
            : op
        );
        writeQueue(queue);

        reportSyncFailed();
        if (retryCount < MAX_RETRIES) scheduleRetry(retryCount);
        return;
      }
    }

    reportSyncSucceeded();
  } finally {
    draining = false;
  }
}

/** Discards the queue. Only for a deliberate "start over" in the demo. */
export function clearSyncQueue(): void {
  writeQueue([]);
}

/**
 * Wires the queue to connectivity. Called once from the portal shells:
 * regaining a connection is what should start a drain, not a poll.
 */
let wired = false;

export function startSyncEngine(): void {
  if (wired) return;
  wired = true;

  reportPendingCount(readQueue().length);

  subscribeToNetwork((snapshot) => {
    if (snapshot.isOnline && snapshot.pendingCount > 0 && !draining) {
      void drainQueue();
    }
  });

  // A reload with a queue already on disk should resume, not wait for the
  // next connectivity flap.
  if (getNetworkSnapshot().isOnline) void drainQueue();
}
