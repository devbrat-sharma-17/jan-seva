// ============================================================
// Login Throttle — client-side attempt pacing
// ============================================================
//
//   This is a USABILITY guardrail, not a security control.
//
// It slows a person mashing the sign-in button with a wrong password and
// makes the lockout visible in the UI. It stops nobody who opens devtools,
// clears storage, or scripts the service call directly.
//
// Real rate limiting has to live on the server, keyed on account and
// source address, with backoff that a client cannot reset. When the auth
// API lands, this module keeps the countdown UI honest while the server
// does the actual enforcement.

const THROTTLE_STORAGE_KEY = 'jan_seva_login_attempts_v1';

export const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
export const LOCKOUT_MS = 30 * 1000;

/** Attempts older than this stop counting toward a lockout. */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

interface AttemptRecord {
  failures: number[];
  lockedUntil?: number;
}

type AttemptStore = Record<string, AttemptRecord>;

function readStore(): AttemptStore {
  try {
    const raw = sessionStorage.getItem(THROTTLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttemptStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: AttemptStore): void {
  try {
    sessionStorage.setItem(THROTTLE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Throttling is advisory; a blocked store just means no pacing.
  }
}

/** Identifiers are the key, so the counter is not shared across accounts. */
function keyFor(identifier: string): string {
  return identifier.trim().toLowerCase() || 'anonymous';
}

export interface ThrottleState {
  locked: boolean;
  /** Whole seconds left on the lockout. Zero when not locked. */
  secondsRemaining: number;
  /** Attempts left before the next lockout. */
  attemptsRemaining: number;
}

export function getThrottleState(identifier: string, now: number = Date.now()): ThrottleState {
  const store = readStore();
  const record = store[keyFor(identifier)];

  if (!record) {
    return { locked: false, secondsRemaining: 0, attemptsRemaining: MAX_ATTEMPTS_BEFORE_LOCKOUT };
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      locked: true,
      secondsRemaining: Math.ceil((record.lockedUntil - now) / 1000),
      attemptsRemaining: 0,
    };
  }

  const recent = record.failures.filter((t) => now - t < ATTEMPT_WINDOW_MS);
  return {
    locked: false,
    secondsRemaining: 0,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS_BEFORE_LOCKOUT - recent.length),
  };
}

/** Records a failure and returns the state the caller should render. */
export function recordFailedAttempt(identifier: string, now: number = Date.now()): ThrottleState {
  const store = readStore();
  const key = keyFor(identifier);
  const record = store[key] ?? { failures: [] };

  const recent = record.failures.filter((t) => now - t < ATTEMPT_WINDOW_MS);
  recent.push(now);

  const next: AttemptRecord = { failures: recent };
  if (recent.length >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
    next.lockedUntil = now + LOCKOUT_MS;
    next.failures = [];
  }

  store[key] = next;
  writeStore(store);

  return getThrottleState(identifier, now);
}

/** A successful sign-in clears the counter for that identifier. */
export function clearAttempts(identifier: string): void {
  const store = readStore();
  delete store[keyFor(identifier)];
  writeStore(store);
}
