// ============================================================
// Storage — Guarded localStorage with change notification
// ============================================================
// Two problems this solves that a bare `localStorage.setItem` does not:
//
//  1. Quota. Photos push the store toward the ~5 MB cap. A silent
//     catch means the citizen sees a ticket number for a complaint
//     that was never written. Writes report failure so callers can
//     surface it.
//  2. Staleness. Filing a report in one tab left an open tracking
//     tab showing yesterday's data. Every write is broadcast, in-tab
//     and cross-tab, so views re-read instead of drifting.

export class StorageQuotaError extends Error {
  constructor() {
    super('Storage is full. Remove a photo or clear old complaints and try again.');
    this.name = 'StorageQuotaError';
  }
}

export class StorageUnavailableError extends Error {
  constructor() {
    super('This browser is blocking local storage. Private browsing may need to be turned off.');
    this.name = 'StorageUnavailableError';
  }
}

/** Fired in the writing tab; the native `storage` event only fires in others. */
const LOCAL_CHANGE_EVENT = 'jan-seva:store-change';

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Safari and Firefox use different names/codes for the same condition.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (err as { code?: number }).code === 22 ||
    (err as { code?: number }).code === 1014
  );
}

export function isStorageAvailable(): boolean {
  try {
    const probe = '__js_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted entry — treat as absent rather than crashing the view.
    return fallback;
  }
}

/**
 * Writes and notifies. Throws `StorageQuotaError` / `StorageUnavailableError`
 * so the caller can tell the citizen rather than losing the write in a log.
 */
export function writeJSON(key: string, value: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('That data could not be saved.');
  }

  try {
    localStorage.setItem(key, serialized);
  } catch (err) {
    if (isQuotaError(err)) throw new StorageQuotaError();
    throw new StorageUnavailableError();
  }

  notifyChange(key);
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
    notifyChange(key);
  } catch {
    // Nothing to recover from — the key is already unreachable.
  }
}

function notifyChange(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: { key } }));
}

/**
 * Subscribes to changes for one key, from this tab or any other.
 * Returns the unsubscribe function.
 */
export function subscribeToKey(key: string, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleLocal = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string }>).detail;
    if (detail?.key === key) onChange();
  };

  const handleCrossTab = (event: StorageEvent) => {
    // `key === null` means the whole store was cleared.
    if (event.key === key || event.key === null) onChange();
  };

  window.addEventListener(LOCAL_CHANGE_EVENT, handleLocal);
  window.addEventListener('storage', handleCrossTab);

  return () => {
    window.removeEventListener(LOCAL_CHANGE_EVENT, handleLocal);
    window.removeEventListener('storage', handleCrossTab);
  };
}

/** Approximate bytes currently held, for the storage-pressure warning. */
export function estimateUsedBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    // UTF-16 code units, roughly 2 bytes each for the ASCII we store.
    return total * 2;
  } catch {
    return 0;
  }
}
