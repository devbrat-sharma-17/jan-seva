// ============================================================
// Session Service — portal session lifecycle
// ============================================================
//
// One session model for both portals. Deliberately small: it holds
// *identifiers*, never a profile. Names, emails, designations and
// permissions are composed on read from the department config and the
// demo directory, so nothing personal sits in browser storage waiting
// to be read by the next person at the terminal.
//
// Storage choice: sessionStorage, not localStorage. A portal session is
// scoped to the tab that authenticated it and dies with that tab.
//
//   NOT server-side session management.
//   A visitor can write this object by hand and the UI would accept it.
//   Every guard here is a usability and correctness boundary, not a
//   security boundary. Real enforcement belongs on the API, which must
//   re-derive role and department scope from a signed token on every
//   request rather than trusting anything the client sends.

import type { DepartmentId, DepartmentRole } from '../types/department';

const SESSION_STORAGE_KEY = 'jan_seva_portal_session_v2';

/** Bump to invalidate every outstanding session after a shape change. */
export const SESSION_VERSION = 2;

/** Sliding inactivity window. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** How long before expiry the "session ending soon" notice appears. */
export const SESSION_WARNING_MS = 3 * 60 * 1000;

export type PortalRole = 'admin' | 'department';

/**
 * Where a sign-in attempt has reached. `mfa_required` is unused by the
 * prototype but is part of the contract so a second factor can be added
 * without reshaping every caller.
 */
export type AuthenticationState = 'password_verified' | 'mfa_required' | 'authenticated';

export interface PortalSession {
  sessionId: string;
  sessionVersion: number;
  userId: string;
  role: PortalRole;
  /** Present only for department sessions. The scope everything is locked to. */
  departmentId?: DepartmentId;
  departmentRole?: DepartmentRole;
  /** Staff/account identifier this session authenticated as. */
  accountId: string;
  cityId: string;
  authenticatedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  authenticationState: AuthenticationState;
}

export type SessionStatus =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'active'; session: PortalSession };

const SESSION_CHANGE_EVENT = 'jan-seva:session-change';

function notify(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

/** Subscribe to sign-in, sign-out and expiry. Returns the unsubscribe fn. */
export function subscribeToSession(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(SESSION_CHANGE_EVENT, onChange);
}

function newSessionId(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRaw(): PortalSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSession;
    // A stored object missing any structural field is treated as absent
    // rather than trusted, so a hand-written or half-migrated session
    // cannot resolve to an authenticated user.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.expiresAt !== 'string' ||
      (parsed.role !== 'admin' && parsed.role !== 'department')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(session: PortalSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A blocked store means the session lives only for this render pass;
    // the guard then bounces the user back to sign in.
  }
}

export interface CreateSessionInput {
  userId: string;
  accountId: string;
  role: PortalRole;
  departmentId?: DepartmentId;
  departmentRole?: DepartmentRole;
  cityId: string;
  authenticationState?: AuthenticationState;
}

export function createSession(input: CreateSessionInput): PortalSession {
  const now = Date.now();
  const session: PortalSession = {
    sessionId: newSessionId(),
    sessionVersion: SESSION_VERSION,
    userId: input.userId,
    accountId: input.accountId,
    role: input.role,
    departmentId: input.departmentId,
    departmentRole: input.departmentRole,
    cityId: input.cityId,
    authenticatedAt: new Date(now).toISOString(),
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_IDLE_MS).toISOString(),
    authenticationState: input.authenticationState ?? 'authenticated',
  };

  writeRaw(session);
  notify();
  return session;
}

/**
 * Reads the session and tells the caller why there isn't one. A guard
 * needs to distinguish "never signed in" (go to sign-in quietly) from
 * "session ran out" (say so).
 */
export function getSessionStatus(now: number = Date.now()): SessionStatus {
  const session = readRaw();
  if (!session) return { kind: 'none' };

  if (session.sessionVersion !== SESSION_VERSION) {
    clearSession({ silent: true });
    return { kind: 'expired' };
  }

  if (new Date(session.expiresAt).getTime() <= now) {
    clearSession({ silent: true });
    return { kind: 'expired' };
  }

  if (session.authenticationState !== 'authenticated') {
    return { kind: 'none' };
  }

  return { kind: 'active', session };
}

/** The session, or null. Use `getSessionStatus` when the reason matters. */
export function getSession(): PortalSession | null {
  const status = getSessionStatus();
  return status.kind === 'active' ? status.session : null;
}

/** Milliseconds until this session lapses. Negative once it has. */
export function msUntilExpiry(now: number = Date.now()): number {
  const session = readRaw();
  if (!session) return -1;
  return new Date(session.expiresAt).getTime() - now;
}

/**
 * Extends the idle window. Called from real user interaction only — a
 * background timer that touched the session would make expiry meaningless.
 */
export function touchSession(now: number = Date.now()): void {
  const session = readRaw();
  if (!session) return;
  if (new Date(session.expiresAt).getTime() <= now) return;

  // Rewriting on every mousemove would thrash storage; a minute of
  // granularity is far finer than a 30-minute window needs.
  const lastActivity = new Date(session.lastActivityAt).getTime();
  if (now - lastActivity < 60_000) return;

  writeRaw({
    ...session,
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_IDLE_MS).toISOString(),
  });
}

/**
 * Slides the window forward unconditionally, for an explicit "stay signed
 * in". `touchSession` damps itself to one write a minute, which is right
 * for incidental activity but would swallow a deliberate click.
 */
export function extendSession(now: number = Date.now()): void {
  const session = readRaw();
  if (!session) return;
  if (new Date(session.expiresAt).getTime() <= now) return;

  writeRaw({
    ...session,
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_IDLE_MS).toISOString(),
  });
  notify();
}

export function clearSession(options: { silent?: boolean } = {}): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to recover — the key is already unreachable.
  }
  if (!options.silent) notify();
}

/**
 * Whether this session may operate on records belonging to `departmentId`.
 * Admins span the city; department staff are locked to the scope their
 * session was issued for, regardless of what a URL or dropdown asks for.
 */
export function sessionCanAccessDepartment(
  session: PortalSession | null,
  departmentId: string | undefined
): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (!departmentId) return false;
  return session.departmentId === departmentId;
}
