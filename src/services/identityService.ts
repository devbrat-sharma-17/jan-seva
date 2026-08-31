// ============================================================
// Identity Service — Safe identity references & verified session
// ============================================================
// Two responsibilities, both privacy-critical:
//
//  1. Turning a mobile number or Aadhaar number into an opaque reference
//     that can be persisted and matched against, without the raw value
//     ever reaching the demo store.
//  2. Holding the "this browser has verified as this citizen" session
//     that gates every non-public field in the tracking UI.
//
// The session lives in sessionStorage, not localStorage: closing the tab
// ends it. A shared or public handset should not stay verified.

import type { IdentityMethod } from '../types';

const SESSION_KEY = 'jan_seva_verified_identity_v1';
const IDENTITY_CHANGE_EVENT = 'jan-seva:identity-change';

/** Verified sessions lapse after this long even if the tab stays open. */
const SESSION_TTL_MS = 30 * 60 * 1000;

export interface VerifiedIdentity {
  /** The opaque key complaints are matched on. */
  reference: string;
  method: IdentityMethod;
  /** Masked display form, e.g. "+91 XXXXX 43210" or "XXXX XXXX 3841". */
  label: string;
  /** Name resolved during verification, when the method supplies one. */
  name?: string;
  verifiedAt: number;
}

/**
 * Derives a stable, non-reversible reference from a raw identifier.
 *
 * A real deployment would salt and hash this server-side; here it is a
 * deterministic client-side digest. What matters architecturally is that
 * the raw number is never what gets stored or compared — swapping this for
 * a server call later changes nothing above it.
 */
export function deriveIdentityReference(method: IdentityMethod, rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';

  // FNV-1a over the method-scoped value, so the same number verified by
  // two different methods does not collide.
  const input = `${method}:${digits}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // A second pass over the reversed input widens the digest, which keeps
  // brute-forcing a 10-digit space from being trivially cheap in the demo.
  let hash2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    hash2 ^= input.charCodeAt(i);
    hash2 = Math.imul(hash2, 0x01000193) >>> 0;
  }

  return `idref_${hash.toString(36)}${hash2.toString(36)}`;
}

/** "+91 XXXXX 43210" — the only phone form ever persisted or displayed. */
export function maskMobile(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(-10);
  if (digits.length < 4) return '+91 XXXXX XXXXX';
  return `+91 XXXXX ${digits.slice(-5)}`;
}

/** "XXXX XXXX 3841" — never the full 12 digits. */
export function maskAadhaar(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskIdentity(method: IdentityMethod, rawValue: string): string {
  return method === 'aadhaar' ? maskAadhaar(rawValue) : maskMobile(rawValue);
}

/** Formats Aadhaar entry as "1234 5678 9012" while the citizen types. */
export function formatAadhaarInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Formats mobile entry as "98765 43210". */
export function formatMobileInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function isValidMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  // Indian mobile numbers are 10 digits and never start below 6.
  return /^[6-9]\d{9}$/.test(digits);
}

export function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(value.replace(/\D/g, ''));
}

// ------------------------------------------------------------
// Verified session
// ------------------------------------------------------------

function readSession(): VerifiedIdentity | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as VerifiedIdentity;
    if (!parsed?.reference || !parsed.verifiedAt) return null;

    if (Date.now() - parsed.verifiedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getVerifiedIdentity(): VerifiedIdentity | null {
  return readSession();
}

export function setVerifiedIdentity(identity: Omit<VerifiedIdentity, 'verifiedAt'>): VerifiedIdentity {
  const record: VerifiedIdentity = { ...identity, verifiedAt: Date.now() };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(record));
  } catch {
    // Verification still holds for this render pass even if it cannot be
    // persisted; the citizen simply re-verifies on the next navigation.
  }
  notifyIdentityChange();
  return record;
}

export function clearVerifiedIdentity(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
  notifyIdentityChange();
}

/** True when the session verifies the citizen who filed this complaint. */
export function isIdentityMatch(
  identity: VerifiedIdentity | null,
  complaintReference: string | undefined
): boolean {
  if (!identity || !complaintReference) return false;
  return identity.reference === complaintReference;
}

function notifyIdentityChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IDENTITY_CHANGE_EVENT));
}

export function subscribeToIdentity(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(IDENTITY_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(IDENTITY_CHANGE_EVENT, onChange);
}
