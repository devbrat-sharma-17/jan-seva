// ============================================================
// Network Service — one connectivity state for the portals
// ============================================================
//
// `navigator.onLine` answers "is there a network interface", not "did the
// write land". Both portals need the second question, so connectivity and
// sync progress are folded into one state machine that every indicator,
// banner and mutation button reads from.
//
//   offline      no connection; writes are being queued
//   reconnecting connection returned, queue not yet drained
//   syncing      queued operations are being sent
//   error        the last drain attempt failed; a retry is pending
//   synced       queue empty, everything acknowledged (settles to online)
//   online       connected, nothing outstanding

export type NetworkState =
  | 'online'
  | 'offline'
  | 'reconnecting'
  | 'syncing'
  | 'synced'
  | 'error';

export interface NetworkSnapshot {
  state: NetworkState;
  /** Raw connectivity, independent of sync progress. */
  isOnline: boolean;
  /** Operations waiting to be acknowledged. */
  pendingCount: number;
  /** ISO timestamp of the last successful drain, if there has been one. */
  lastSyncedAt?: string;
}

type Listener = (snapshot: NetworkSnapshot) => void;

const listeners = new Set<Listener>();

let snapshot: NetworkSnapshot = {
  state: typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  pendingCount: 0,
};

/** `synced` is a moment, not a resting state; it relaxes back to `online`. */
const SYNCED_SETTLE_MS = 2500;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  const current = snapshot;
  listeners.forEach((listener) => listener(current));
}

function update(patch: Partial<NetworkSnapshot>): void {
  const next = { ...snapshot, ...patch };
  if (
    next.state === snapshot.state &&
    next.isOnline === snapshot.isOnline &&
    next.pendingCount === snapshot.pendingCount &&
    next.lastSyncedAt === snapshot.lastSyncedAt
  ) {
    return;
  }
  snapshot = next;
  emit();
}

export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

export function subscribeToNetwork(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the sync queue as operations are added and drained. */
export function reportPendingCount(count: number): void {
  update({ pendingCount: count });
}

export function reportSyncStarted(): void {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
  update({ state: 'syncing' });
}

export function reportSyncSucceeded(): void {
  update({ state: 'synced', lastSyncedAt: new Date().toISOString() });

  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    update({ state: snapshot.isOnline ? 'online' : 'offline' });
  }, SYNCED_SETTLE_MS);
}

export function reportSyncFailed(): void {
  update({ state: 'error' });
}

function handleOnline(): void {
  update({
    isOnline: true,
    state: snapshot.pendingCount > 0 ? 'reconnecting' : 'online',
  });
}

function handleOffline(): void {
  update({ isOnline: false, state: 'offline' });
}

/**
 * Starts listening for connectivity changes. Idempotent — the portal
 * shells both call it and only the first attaches listeners.
 */
let started = false;

export function startNetworkMonitor(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // The events can fire between module load and this call.
  update({
    isOnline: navigator.onLine,
    state: navigator.onLine ? snapshot.state : 'offline',
  });
}

/**
 * Human-readable copy for the current state. Kept here so the banner, the
 * indicator and any toast say the same thing, and so no screen ever
 * renders a raw browser error string at a citizen or an officer.
 */
export function describeNetworkState(snap: NetworkSnapshot): {
  label: string;
  detail: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
} {
  switch (snap.state) {
    case 'offline':
      return {
        label: 'Offline',
        detail:
          snap.pendingCount > 0
            ? `${snap.pendingCount} change${snap.pendingCount === 1 ? '' : 's'} saved on this device. They will sync when you are back online.`
            : 'Changes will be saved on this device and synced when you are back online.',
        tone: 'warning',
      };
    case 'reconnecting':
      return { label: 'Reconnecting', detail: 'Preparing to sync your saved changes.', tone: 'warning' };
    case 'syncing':
      return { label: 'Syncing changes', detail: 'Sending your saved changes.', tone: 'neutral' };
    case 'synced':
      return { label: 'All changes synced', detail: 'Everything is up to date.', tone: 'good' };
    case 'error':
      return {
        label: "Couldn't sync yet",
        detail: 'Your changes are safe on this device. We will retry shortly.',
        tone: 'danger',
      };
    case 'online':
    default:
      return { label: 'Online', detail: 'Connected.', tone: 'good' };
  }
}
