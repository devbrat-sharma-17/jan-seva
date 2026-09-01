// ============================================================
// Identity — server-side references and masking
// ============================================================
// The browser derives an identity reference today with FNV-1a
// (src/services/identityService.ts). That is fine for matching inside a
// prototype and useless as a privacy control: FNV is unsalted, fast, and
// the input space is ten digits, so the whole mapping can be enumerated
// in under a second.
//
// The server reference is HMAC-SHA-256 under a secret that never leaves
// the deployment. Without the secret, a stolen database of references
// cannot be reversed into phone numbers by brute force, which is the
// entire threat.
//
//   The two schemes produce different values, deliberately.
//   Legacy client-derived references stay valid for records that already
//   carry them; new records get the server form. `IDENTITY_SCHEME` marks
//   which is which so a migration can tell them apart rather than
//   guessing from the string.

const encoder = new TextEncoder();

export const IDENTITY_SCHEME = 'v2';

export type IdentityMethod = 'mobile' | 'aadhaar';

function secret(): string {
  const value = process.env.IDENTITY_SECRET ?? process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    // Failing loudly beats silently hashing under an empty key, which
    // would produce references that look right and protect nothing.
    throw new Error('IDENTITY_SECRET is missing or too short (needs 32+ characters)');
  }
  return value;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The opaque key a complaint is matched on.
 *
 * Method-scoped, so the same person verified by mobile and by Aadhaar
 * does not collide into one reference — those are different assurances
 * and conflating them would let the weaker one inherit the stronger
 * one's access.
 */
export async function deriveIdentityReference(
  method: IdentityMethod,
  rawValue: string
): Promise<string> {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) throw new Error('empty identifier');
  const digest = await hmacHex(secret(), `${IDENTITY_SCHEME}:${method}:${digits}`);
  return `idref_${IDENTITY_SCHEME}_${digest.slice(0, 32)}`;
}

/**
 * Salted digest of a client IP, for rate-limit keys and audit rows.
 *
 * The address itself is personal data under DPDP and is not needed —
 * only the ability to recognise the same source again. A per-deployment
 * salt means the same address produces different keys in different
 * environments, so a leaked table cannot be correlated across them.
 */
export async function hashSubject(value: string): Promise<string> {
  return (await hmacHex(secret(), `subject:${value}`)).slice(0, 32);
}

/** "+91 XXXXX 43210" — the only phone form ever persisted or displayed. */
export function maskMobile(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(-10);
  if (digits.length < 5) return '+91 XXXXX XXXXX';
  return `+91 XXXXX ${digits.slice(-5)}`;
}

/** "XXXX XXXX 3841" — never the full twelve digits. */
export function maskAadhaar(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskIdentity(method: IdentityMethod, rawValue: string): string {
  return method === 'aadhaar' ? maskAadhaar(rawValue) : maskMobile(rawValue);
}

/** Indian mobile numbers are ten digits and never start below 6. */
export function isValidMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/\D/g, ''));
}

/**
 * Verhoeff checksum, which is what UIDAI actually specifies for Aadhaar.
 *
 * A twelve-digit regex accepts 999999999999. This rejects it, which
 * matters because a typo that passes validation becomes an OTP sent to
 * nobody and a support call.
 *
 * NOTE: passing this check means the number is well-formed. It says
 * NOTHING about whether the number exists or belongs to the person —
 * that requires a UIDAI integration, which is explicitly out of scope
 * (spec §10). Nothing in this codebase may present it as verification.
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) return false; // never starts 0 or 1

  let checksum = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return checksum === 0;
}
