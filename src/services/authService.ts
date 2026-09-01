// ============================================================
// Auth Service — portal sign-in
// ============================================================
//
// Citizen OTP verification used to live here. It now lives in
// `otpService`, which chooses between the demo challenge and the real
// server endpoints based on APP_MODE. The two functions below are kept
// as re-exports so the screens that import them — the report wizard's
// identity step and the tracking page's verification card — did not have
// to change: that citizen flow is frozen (spec §1).

export {
  sendMobileOtp as sendOtp,
  verifyMobileOtp as verifyOtp,
  type SendOtpResult,
  type VerifyOtpResult,
} from './otpService';

// ============================================================
// Portal Authentication — Admin & Department
// ============================================================
//
// The shape here is the one a real backend slots into:
//
//     UI  ->  authService.loginAdmin(credentials)
//                        .loginDepartment(credentials)
//         ->  credential verification
//         ->  session issued
//
// Today verification is `demoDirectory.verifyCredential`, which runs in
// the browser and is therefore not a security control (see that file's
// header). Replacing it with `await api.post('/auth/login', creds)` and
// having the server set the session is the whole migration — no screen,
// no guard and no service caller changes.
//
// Passwords are read from the form, passed straight into verification and
// dropped. They are never written to storage, never held in a session,
// never logged and never put in a URL.

import { demoAccountsAllowed } from '../config/appMode';
import type { DepartmentId, DepartmentRole, DepartmentUser } from '../types/department';
import type { AdminUser, AdminPermissions } from '../types/admin';
import { DEPARTMENTS } from '../data/departments';
import {
  findDemoAccount,
  verifyCredential,
  getDemoAdminAccount,
  type DemoDepartmentAccount,
} from '../data/demoDirectory';
import {
  createSession,
  clearSession,
  getSession,
  getSessionStatus,
  type AuthenticationState,
  type PortalSession,
  type SessionStatus,
} from './sessionService';
import {
  getThrottleState,
  recordFailedAttempt,
  clearAttempts,
} from './loginThrottle';

export type AuthFailureReason =
  | 'missing_fields'
  | 'invalid_credentials'
  | 'wrong_portal'
  | 'department_mismatch'
  | 'rate_limited';

export interface AuthSuccess {
  ok: true;
  authenticationState: AuthenticationState;
  session: PortalSession;
}

export interface AuthFailure {
  ok: false;
  reason: AuthFailureReason;
  /** Ready to render. Deliberately vague about which half was wrong. */
  message: string;
  secondsRemaining?: number;
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface PortalCredentials {
  identifier: string;
  password: string;
}

/**
 * One message for "no such account" and for "wrong password". Telling a
 * caller which of the two they got confirms whether an account exists.
 */
/** Role labels for a session-composed user, when no staff record exists. */
const DEPARTMENT_ROLE_TITLES: Record<DepartmentRole, string> = {
  head: 'Department Head',
  nodal: 'Nodal Officer',
  field: 'Field Officer',
};

const INVALID_CREDENTIALS_MESSAGE =
  'That ID or password was not recognised. Check both and try again.';

/** Latency so the UI's pending state is exercised, matching a network call. */
const SIMULATED_LATENCY_MS = 550;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttleFailure(identifier: string): AuthFailure | null {
  const state = getThrottleState(identifier);
  if (!state.locked) return null;
  return {
    ok: false,
    reason: 'rate_limited',
    message: `Too many attempts. Please wait ${state.secondsRemaining} second${
      state.secondsRemaining === 1 ? '' : 's'
    } and try again.`,
    secondsRemaining: state.secondsRemaining,
  };
}

// ------------------------------------------------------------
// Department portal
// ------------------------------------------------------------

/**
 * Signs a member of department staff in.
 *
 * `expectedDepartmentId` is the department the sign-in form had selected.
 * If the credentials belong to a different department the attempt is
 * refused rather than quietly switching scope — picking "Water" and
 * signing in with a Roads ID should not open Water's queue.
 */
export async function loginDepartment(
  credentials: PortalCredentials,
  expectedDepartmentId?: DepartmentId
): Promise<AuthResult> {
  const identifier = credentials.identifier.trim();

  const throttled = throttleFailure(identifier);
  if (throttled) return throttled;

  if (!identifier || !credentials.password) {
    return {
      ok: false,
      reason: 'missing_fields',
      message: 'Enter both your department ID and password.',
    };
  }

  await delay(SIMULATED_LATENCY_MS);

  const account = findDemoAccount(identifier);

  if (!account || account.kind !== 'department' || !verifyCredential(account, credentials.password)) {
    const state = recordFailedAttempt(identifier);
    if (state.locked) {
      return {
        ok: false,
        reason: 'rate_limited',
        message: `Too many attempts. Please wait ${state.secondsRemaining} seconds and try again.`,
        secondsRemaining: state.secondsRemaining,
      };
    }
    return { ok: false, reason: 'invalid_credentials', message: INVALID_CREDENTIALS_MESSAGE };
  }

  if (expectedDepartmentId && account.departmentId !== expectedDepartmentId) {
    recordFailedAttempt(identifier);
    return {
      ok: false,
      reason: 'department_mismatch',
      message: 'Those credentials belong to a different department.',
    };
  }

  clearAttempts(identifier);
  return { ok: true, authenticationState: 'authenticated', session: issueDepartmentSession(account) };
}

function issueDepartmentSession(account: DemoDepartmentAccount): PortalSession {
  return createSession({
    userId: `usr-${account.departmentId}-${account.accountId.toLowerCase()}`,
    accountId: account.accountId,
    role: 'department',
    departmentId: account.departmentId,
    departmentRole: account.role,
    cityId: 'gwalior',
    // A second factor would set 'password_verified' here and only move to
    // 'authenticated' once the OTP step completed.
    authenticationState: 'authenticated',
  });
}

/**
 * DEMO ONLY. Opens a department session with no credential check, for the
 * explicitly labelled Quick Demo control on the sign-in screen. It exists
 * nowhere else, and must not be called from a guard, a layout or a route.
 */
export function startDepartmentDemoSession(
  departmentId: DepartmentId,
  role: DepartmentRole
): PortalSession {
  if (!demoAccountsAllowed()) {
    throw new Error('Demo sign-in is not available in this environment.');
  }

  const dept = DEPARTMENTS[departmentId] ?? DEPARTMENTS.roads;
  const staff = dept.mockStaff.find((s) => s.role === role) ?? dept.mockStaff[0];

  return createSession({
    userId: `usr-${dept.id}-${staff.id.toLowerCase()}`,
    accountId: staff.id,
    role: 'department',
    departmentId: dept.id,
    departmentRole: staff.role,
    cityId: 'gwalior',
    authenticationState: 'authenticated',
  });
}

/**
 * The signed-in department user, composed from the session's identifiers
 * and the department config. Returns null for an admin session — an admin
 * is not department staff and must not be handed a department scope.
 */
export function getCurrentDepartmentUser(): DepartmentUser | null {
  const session = getSession();
  if (!session || session.role !== 'department' || !session.departmentId) return null;

  const dept = DEPARTMENTS[session.departmentId];
  if (!dept) return null;

  // `mockStaff` is demo personnel. Attaching one of those names and
  // email addresses to a real officer's session would present a
  // fabricated identity as genuine, so production composes the user from
  // the session alone until staff records come from the server.
  const staff = demoAccountsAllowed()
    ? dept.mockStaff.find((s) => s.id === session.accountId) ??
      dept.mockStaff.find((s) => s.role === session.departmentRole) ??
      dept.mockStaff[0]
    : {
        id: session.accountId,
        name: session.accountId,
        email: '',
        role: session.departmentRole ?? 'nodal',
        roleTitle: DEPARTMENT_ROLE_TITLES[session.departmentRole ?? 'nodal'],
        designation: DEPARTMENT_ROLE_TITLES[session.departmentRole ?? 'nodal'],
        division: '',
        team: '',
      };

  return {
    id: session.userId,
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    roleTitle: staff.roleTitle,
    designation: staff.designation,
    departmentId: dept.id,
    departmentName: dept.name,
    division: staff.division,
    team: staff.team,
  };
}

export function logoutDepartmentUser(): void {
  clearSession();
}

// ------------------------------------------------------------
// Admin portal
// ------------------------------------------------------------

const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  viewCitizenIdentity: true, // Masked only. Raw Aadhaar is never held or shown.
  reassignDepartment: true,
  manualEscalate: true,
  viewAuditTrail: true,
  viewPerformance: true,
  manageInitiatives: true,
  generateReports: true,
};

export async function loginAdmin(credentials: PortalCredentials): Promise<AuthResult> {
  const identifier = credentials.identifier.trim();

  const throttled = throttleFailure(identifier);
  if (throttled) return throttled;

  if (!identifier || !credentials.password) {
    return {
      ok: false,
      reason: 'missing_fields',
      message: 'Enter both your admin ID and password.',
    };
  }

  await delay(SIMULATED_LATENCY_MS);

  const account = findDemoAccount(identifier);

  // A department ID typed into the admin form is refused with the same
  // message as a bad password, so the form cannot be used to enumerate
  // which identifiers exist in which portal.
  if (!account || account.kind !== 'admin' || !verifyCredential(account, credentials.password)) {
    const state = recordFailedAttempt(identifier);
    if (state.locked) {
      return {
        ok: false,
        reason: 'rate_limited',
        message: `Too many attempts. Please wait ${state.secondsRemaining} seconds and try again.`,
        secondsRemaining: state.secondsRemaining,
      };
    }
    return { ok: false, reason: 'invalid_credentials', message: INVALID_CREDENTIALS_MESSAGE };
  }

  clearAttempts(identifier);

  const session = createSession({
    userId: 'admin-001',
    accountId: account.accountId,
    role: 'admin',
    cityId: account.cityId,
    authenticationState: 'authenticated',
  });

  return { ok: true, authenticationState: 'authenticated', session };
}

/** DEMO ONLY. See `startDepartmentDemoSession`. */
export function startAdminDemoSession(): PortalSession {
  if (!demoAccountsAllowed()) {
    throw new Error('Demo sign-in is not available in this environment.');
  }

  const account = getDemoAdminAccount();
  return createSession({
    userId: 'admin-001',
    accountId: account.accountId,
    role: 'admin',
    cityId: account.cityId,
    authenticationState: 'authenticated',
  });
}

export function getCurrentAdminUser(): AdminUser | null {
  const session = getSession();
  if (!session || session.role !== 'admin') return null;

  // In production the demo directory is inert, so the profile is composed
  // from the session's own identifiers. A real deployment fetches the
  // administrator's name and permissions from the server alongside the
  // session; until it does, showing the account ID is honest and showing
  // "Dr. Rakesh Agrawal" to a real administrator would not be.
  const account = demoAccountsAllowed() ? getDemoAdminAccount() : null;

  return {
    id: session.userId,
    name: account?.displayName ?? session.accountId,
    email: account?.email ?? '',
    role: 'city_admin',
    roleTitle: 'City Administrator',
    city: 'Gwalior',
    cityId: session.cityId,
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  };
}

export function logoutAdminUser(): void {
  clearSession();
}

// ------------------------------------------------------------
// Shared
// ------------------------------------------------------------

/** Ends whichever portal session is open. */
export function logoutPortal(): void {
  clearSession();
}

/** Re-exported so guards import their session state from one place. */
export function getPortalSessionStatus(): SessionStatus {
  return getSessionStatus();
}
