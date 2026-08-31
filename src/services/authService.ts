// ============================================================
// Auth Service — Mock OTP verification
// ============================================================
// The only place the demo OTP exists. Components must never compare against
// a literal code themselves — swapping this file for a real SMS/UIDAI
// integration should not require touching any UI.

import type { IdentityMethod } from '../types';
import {
  deriveIdentityReference,
  maskIdentity,
  isValidMobile,
  isValidAadhaar,
} from './identityService';

/** Frontend simulation only. Never rendered as instructional UI copy. */
const DEMO_OTP = '123456';

/** How long a sent code stays acceptable. */
const OTP_TTL_MS = 5 * 60 * 1000;

const MAX_ATTEMPTS = 5;

export interface AuthUser {
  id: string;
  name: string;
  role: 'admin' | 'department' | 'citizen';
  department?: string;
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  /** Masked destination, safe to display: "+91 XXXXX 43210". */
  targetMasked: string;
  /** Seconds before a resend is permitted. */
  resendAfterSeconds: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  /** Present only on success — the opaque key complaints are matched on. */
  identityReference?: string;
  identityLabel?: string;
  /** Aadhaar eKYC returns a name; mobile verification does not. */
  verifiedName?: string;
}

interface PendingChallenge {
  reference: string;
  method: IdentityMethod;
  issuedAt: number;
  attempts: number;
}

// In-memory only: a pending challenge must not outlive the page, and must
// never be written to storage.
const pendingChallenges = new Map<string, PendingChallenge>();

function challengeKey(method: IdentityMethod, rawValue: string): string {
  return `${method}:${deriveIdentityReference(method, rawValue)}`;
}

/** Validates the identifier, then issues a simulated verification code. */
export async function sendOtp(
  rawValue: string,
  method: IdentityMethod
): Promise<SendOtpResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const valid = method === 'mobile' ? isValidMobile(rawValue) : isValidAadhaar(rawValue);
  if (!valid) {
    return {
      success: false,
      message:
        method === 'mobile'
          ? 'Enter a valid 10-digit mobile number.'
          : 'Enter a valid 12-digit Aadhaar number.',
      targetMasked: '',
      resendAfterSeconds: 0,
    };
  }

  const key = challengeKey(method, rawValue);
  pendingChallenges.set(key, {
    reference: deriveIdentityReference(method, rawValue),
    method,
    issuedAt: Date.now(),
    attempts: 0,
  });

  const targetMasked = maskIdentity(method, rawValue);

  return {
    success: true,
    message: `Verification code sent to ${targetMasked}`,
    targetMasked,
    resendAfterSeconds: 30,
  };
}

/**
 * Verifies a code against the outstanding challenge. On success the caller
 * receives an identity reference — never the raw identifier back.
 */
export async function verifyOtp(
  rawValue: string,
  otp: string,
  method: IdentityMethod
): Promise<VerifyOtpResult> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const cleanOtp = otp.replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return { success: false, message: 'Enter the 6-digit code.' };
  }

  const key = challengeKey(method, rawValue);
  const challenge = pendingChallenges.get(key);

  if (!challenge) {
    return { success: false, message: 'That code has expired. Please request a new one.' };
  }

  if (Date.now() - challenge.issuedAt > OTP_TTL_MS) {
    pendingChallenges.delete(key);
    return { success: false, message: 'That code has expired. Please request a new one.' };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    pendingChallenges.delete(key);
    return { success: false, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (cleanOtp !== DEMO_OTP) {
    challenge.attempts += 1;
    const left = MAX_ATTEMPTS - challenge.attempts;
    return {
      success: false,
      message: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` : 'Incorrect code.',
    };
  }

  pendingChallenges.delete(key);

  return method === 'aadhaar'
    ? verifyAadhaarMock(rawValue)
    : verifyMobileMock(rawValue);
}

/** Simulated Aadhaar eKYC: returns the registered name alongside the reference. */
export function verifyAadhaarMock(rawValue: string): VerifyOtpResult {
  return {
    success: true,
    message: 'Identity verified with Aadhaar.',
    identityReference: deriveIdentityReference('aadhaar', rawValue),
    identityLabel: maskIdentity('aadhaar', rawValue),
    verifiedName: 'Raj Sharma',
  };
}

/** Simulated mobile verification: no name is returned by this channel. */
export function verifyMobileMock(rawValue: string): VerifyOtpResult {
  return {
    success: true,
    message: 'Mobile number verified.',
    identityReference: deriveIdentityReference('mobile', rawValue),
    identityLabel: maskIdentity('mobile', rawValue),
  };
}


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

  const staff =
    dept.mockStaff.find((s) => s.id === session.accountId) ??
    dept.mockStaff.find((s) => s.role === session.departmentRole) ??
    dept.mockStaff[0];

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

  const account = getDemoAdminAccount();

  return {
    id: session.userId,
    name: account.displayName,
    email: account.email,
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
