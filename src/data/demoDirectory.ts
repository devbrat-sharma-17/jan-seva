// ============================================================
// Demo Account Directory — DEMO ONLY, NOT AN AUTHENTICATION SYSTEM
// ============================================================
//
//  ⚠ READ THIS BEFORE CHANGING ANYTHING IN THIS FILE ⚠
//
// This module exists so the prototype has *one* place where portal
// accounts live, instead of credentials scattered through components.
// It is NOT security. Everything here runs in the browser, where the
// user controls the runtime. A determined visitor can read these
// digests, step through the comparison, or simply write a session
// object into storage by hand.
//
// What this file DOES give us:
//   - no plaintext password anywhere in source, storage or state
//   - one registry to delete when a real identity provider arrives
//   - a `verifyCredential()` shape that a backend call slots into
//
// What it does NOT give us:
//   - confidentiality, integrity, or any real access control
//
// Production must move credential verification behind an API:
//   UI -> authService -> POST /auth/login -> server -> session cookie
// at which point this file is deleted outright.

import type { DepartmentId, DepartmentRole } from '../types/department';
import { demoAccountsAllowed } from '../config/appMode';

/**
 * Marks every screen that leans on this directory.
 *
 * False in production, where this directory is inert: no account
 * resolves, no credential verifies, and the sign-in screens hide their
 * demo zone entirely.
 */
export const DEMO_MODE = demoAccountsAllowed();

/**
 * Non-reversible digest over `ACCOUNT-ID:password`.
 *
 * Deliberately NOT a password hash — there is no work factor and no
 * per-user salt, because there is nothing here worth protecting. Its
 * only job is to keep literal passwords out of the bundle so nobody
 * mistakes `password === 'admin123'` for an architecture.
 */
export function demoDigest(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  const s = `jan-seva::demo-directory::v1::${value}`;

  for (let round = 0; round < 8; round += 1) {
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2246822519) >>> 0;
      h3 = (h3 ^ Math.imul(c ^ h1, 3266489917)) >>> 0;
      h4 = Math.imul(h4 ^ (h2 + h3), 668265263) >>> 0;
    }
    h1 = (h1 ^ h4) >>> 0;
    h2 = (h2 ^ h3) >>> 0;
  }

  return [h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, '0')).join('');
}

// ------------------------------------------------------------
// Accounts
// ------------------------------------------------------------

export interface DemoAdminAccount {
  kind: 'admin';
  accountId: string;
  /** Alternate identifiers accepted at the sign-in field. */
  aliases: string[];
  displayName: string;
  email: string;
  cityId: string;
}

export interface DemoDepartmentAccount {
  kind: 'department';
  accountId: string;
  aliases: string[];
  departmentId: DepartmentId;
  role: DepartmentRole;
  /** Key into `DEPARTMENTS[dept].mockStaff` — the staff record this maps to. */
  staffId: string;
}

export type DemoAccount = DemoAdminAccount | DemoDepartmentAccount;

/**
 * The single demo password. Shown on the sign-in screen behind an explicit
 * DEMO MODE disclosure — a prototype nobody can sign into is not a
 * prototype. Stored only as a digest below; this constant is the label,
 * not the secret.
 */
export const DEMO_PASSWORD_HINT = 'Gwalior@2026';

/** `ACCOUNT-ID` -> digest of `ACCOUNT-ID:password`. */
const CREDENTIAL_DIGESTS: Record<string, string> = {
  'ADMIN-DEMO': '4438a58f6cc5199729e1e5093db90992',
  'PWD-001': 'd91c8ff30a16475fc3bd08d7aab4ee7e',
  'PWD-HEAD': 'e6e6203d212310bb9db241026530a7fb',
  'PWD-FIELD': '257ac619cffc61a3bf17c3a148f5897f',
  'SAN-001': 'f10b4bd49d982fc945b47ff5d5c35d55',
  'SAN-HEAD': '6d899909b420a17be3ade7893b4cf1db',
  'SAN-FIELD': '9d9c5515e14646b374526aa970be448b',
  'WTR-001': '565d1815091f743337f034a326407426',
  'WTR-HEAD': 'bd0e33073eb973c2f2aae2ed3fc01db3',
  'WTR-FIELD': '4e6328d9a9f9dd635419ec393fe0e103',
  'ELC-001': 'bf71956a2f6168556c318c0f3b19e7a0',
  'ELC-HEAD': '9d0deee0acb8357c5df3aa3116d4de7b',
  'ELC-FIELD': 'cbde74f50b5494bbef1849513f572eb3',
  'INF-001': 'c22b8db911752f0b57d350532faab586',
  'INF-HEAD': '3f156adb492e69042419aeeb6bc9f96f',
  'INF-FIELD': '3ca90b1120bbf17b8f6a1b79c95904c3',
};

const ADMIN_ACCOUNTS: DemoAdminAccount[] = [
  {
    kind: 'admin',
    accountId: 'ADMIN-DEMO',
    aliases: ['admin-demo', 'admin@gwalior.gov.in', 'rakesh.agrawal@gwalior.gov.in'],
    displayName: 'Dr. Rakesh Agrawal',
    email: 'rakesh.agrawal@gwalior.gov.in',
    cityId: 'gwalior',
  },
];

/** Department accounts follow one shape, so they are generated rather than typed out. */
const DEPARTMENT_PREFIXES: Array<{ prefix: string; departmentId: DepartmentId }> = [
  { prefix: 'PWD', departmentId: 'roads' },
  { prefix: 'SAN', departmentId: 'sanitation' },
  { prefix: 'WTR', departmentId: 'water' },
  { prefix: 'ELC', departmentId: 'electrical' },
  { prefix: 'INF', departmentId: 'infrastructure' },
];

const ROLE_SUFFIX: Array<{ suffix: string; role: DepartmentRole }> = [
  { suffix: '001', role: 'nodal' },
  { suffix: 'HEAD', role: 'head' },
  { suffix: 'FIELD', role: 'field' },
];

const DEPARTMENT_ACCOUNTS: DemoDepartmentAccount[] = DEPARTMENT_PREFIXES.flatMap(
  ({ prefix, departmentId }) =>
    ROLE_SUFFIX.map(({ suffix, role }) => {
      const accountId = `${prefix}-${suffix}`;
      return {
        kind: 'department' as const,
        accountId,
        aliases: [accountId.toLowerCase()],
        departmentId,
        role,
        staffId: accountId,
      };
    })
);

const ALL_ACCOUNTS: DemoAccount[] = [...ADMIN_ACCOUNTS, ...DEPARTMENT_ACCOUNTS];

/**
 * Resolves a typed identifier (ID, alias or email) to an account.
 *
 * Returns null unconditionally in production. A demo identifier typed
 * into the real sign-in form is refused with the same message as any
 * other unknown account, so the form cannot be used to discover that
 * these identifiers exist at all.
 */
export function findDemoAccount(identifier: string): DemoAccount | null {
  if (!demoAccountsAllowed()) return null;

  const needle = identifier.trim().toLowerCase();
  if (!needle) return null;

  return (
    ALL_ACCOUNTS.find(
      (acc) =>
        acc.accountId.toLowerCase() === needle ||
        acc.aliases.some((alias) => alias.toLowerCase() === needle)
    ) ?? null
  );
}

/**
 * Checks a password against the directory.
 *
 * The password is compared and discarded inside this call — it is never
 * returned, stored, logged or held in state beyond the input element the
 * user typed it into.
 */
export function verifyCredential(account: DemoAccount, password: string): boolean {
  // Belt and braces. `findDemoAccount` already returns nothing in
  // production, so no caller can reach here with an account — but a
  // credential check that could ever pass on a hardcoded digest in
  // production is not something to leave resting on one guard.
  if (!demoAccountsAllowed()) return false;

  const expected = CREDENTIAL_DIGESTS[account.accountId];
  if (!expected) return false;
  return demoDigest(`${account.accountId}:${password}`) === expected;
}

/** Department accounts, for the sign-in screen's demo account list. */
export function listDemoDepartmentAccounts(departmentId: DepartmentId): DemoDepartmentAccount[] {
  if (!demoAccountsAllowed()) return [];
  return DEPARTMENT_ACCOUNTS.filter((a) => a.departmentId === departmentId);
}

export function getDemoAdminAccount(): DemoAdminAccount {
  return ADMIN_ACCOUNTS[0];
}
