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

// ------------------------------------------------------------
// Department Portal Authentication & Session
// ------------------------------------------------------------

import type { DepartmentId, DepartmentRole, DepartmentUser } from '../types/department';
import { DEPARTMENTS } from '../data/departments';

const DEPT_USER_STORAGE_KEY = 'jan_seva_dept_session_v1';

export function getCurrentDepartmentUser(): DepartmentUser | null {
  try {
    const raw = sessionStorage.getItem(DEPT_USER_STORAGE_KEY) || localStorage.getItem(DEPT_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DepartmentUser;
  } catch {
    return null;
  }
}

export function saveDepartmentUser(user: DepartmentUser): void {
  try {
    sessionStorage.setItem(DEPT_USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(DEPT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Session write is best-effort
  }
}

export function logoutDepartmentUser(): void {
  try {
    sessionStorage.removeItem(DEPT_USER_STORAGE_KEY);
    localStorage.removeItem(DEPT_USER_STORAGE_KEY);
  } catch {
    // Best-effort cleanup
  }
}

export async function loginDepartmentUser(
  deptId: DepartmentId,
  identifier: string,
  _password?: string
): Promise<DepartmentUser> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const dept = DEPARTMENTS[deptId] || DEPARTMENTS.roads;
  const cleanId = identifier.trim().toUpperCase();

  // Match staff by ID or find closest match in mockStaff
  const staffMember =
    dept.mockStaff.find((s) => s.id.toUpperCase() === cleanId || s.email.toUpperCase() === cleanId) ||
    dept.mockStaff[0];

  const user: DepartmentUser = {
    id: `usr-${dept.id}-${staffMember.id.toLowerCase()}`,
    staffId: staffMember.id,
    name: staffMember.name,
    email: staffMember.email,
    role: staffMember.role,
    roleTitle: staffMember.roleTitle,
    designation: staffMember.designation,
    departmentId: dept.id,
    departmentName: dept.name,
    division: staffMember.division,
    team: staffMember.team,
  };

  saveDepartmentUser(user);
  return user;
}

export function loginWithQuickPersona(deptId: DepartmentId, role: DepartmentRole): DepartmentUser {
  const dept = DEPARTMENTS[deptId] || DEPARTMENTS.roads;
  const staffMember = dept.mockStaff.find((s) => s.role === role) || dept.mockStaff[0];

  const user: DepartmentUser = {
    id: `usr-${dept.id}-${staffMember.id.toLowerCase()}`,
    staffId: staffMember.id,
    name: staffMember.name,
    email: staffMember.email,
    role: staffMember.role,
    roleTitle: staffMember.roleTitle,
    designation: staffMember.designation,
    departmentId: dept.id,
    departmentName: dept.name,
    division: staffMember.division,
    team: staffMember.team,
  };

  saveDepartmentUser(user);
  return user;
}

export async function loginAdmin(_email: string, _password: string): Promise<AuthUser | null> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { id: 'admin-001', name: 'Admin User', role: 'admin' };
}

export async function loginDepartment(_email: string, _password: string): Promise<AuthUser | null> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { id: 'dept-001', name: 'PWD Officer', role: 'department', department: 'Public Works Department' };
}

export async function logout(): Promise<void> {
  logoutDepartmentUser();
  logoutAdminUser();
  await new Promise((resolve) => setTimeout(resolve, 200));
}

// ------------------------------------------------------------
// Admin Portal Authentication & Session — Phase 5
// ------------------------------------------------------------

import type { AdminUser, AdminPermissions } from '../types/admin';

const ADMIN_USER_STORAGE_KEY = 'jan_seva_admin_session_v1';

const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  viewCitizenIdentity: true,   // Masked only, never raw Aadhaar
  reassignDepartment: true,
  manualEscalate: true,
  viewAuditTrail: true,
  viewPerformance: true,
  manageInitiatives: true,
  generateReports: true,
};

export function getCurrentAdminUser(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_USER_STORAGE_KEY) || localStorage.getItem(ADMIN_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function saveAdminUser(user: AdminUser): void {
  try {
    sessionStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Best-effort
  }
}

export function logoutAdminUser(): void {
  try {
    sessionStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
  } catch {
    // Best-effort
  }
}

export function loginAdminQuickDemo(): AdminUser {
  const user: AdminUser = {
    id: 'admin-001',
    name: 'Dr. Rakesh Agrawal',
    email: 'rakesh.agrawal@gwalior.gov.in',
    role: 'city_admin',
    roleTitle: 'City Administrator',
    city: 'Gwalior',
    cityId: 'gwalior',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  };
  saveAdminUser(user);
  return user;
}

export async function loginAdminUser(
  email: string,
  _password?: string
): Promise<AdminUser> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const user: AdminUser = {
    id: 'admin-001',
    name: 'Dr. Rakesh Agrawal',
    email: email || 'rakesh.agrawal@gwalior.gov.in',
    role: 'city_admin',
    roleTitle: 'City Administrator',
    city: 'Gwalior',
    cityId: 'gwalior',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  };
  saveAdminUser(user);
  return user;
}

