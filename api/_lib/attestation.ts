// ============================================================
// Identity attestation — proof that the server verified someone
// ============================================================
//
// THE HOLE THIS CLOSES
// --------------------
// /api/complaints/create used to take `identityReference` and
// `identityVerified` straight from the request body. Every OTHER
// authoritative field — department, status, SLA, priority — was already
// server-decided, but these two were not, so a client could post
//
//     { identityVerified: true, identityReference: "<someone else's>" }
//
// and attach a complaint to a stranger's identity, or claim a
// verification it never completed. Nothing downstream could tell.
//
// An attestation is the server's own signed statement that it verified
// this identity, at this time. The browser carries it and cannot read
// into it, forge it, extend it, or alter whose identity it names.
//
//   NOT A SESSION, AND DELIBERATELY NOT.
//   Citizens have no accounts (spec §10). This proves one thing — "the
//   holder completed OTP for this identity reference" — and expires
//   quickly. It grants no access to read anything.
//
//   IT NAMES A REFERENCE, NEVER AN IDENTIFIER.
//   The payload carries the derived `idref_…` digest, never a mobile
//   number and never an Aadhaar number. A leaked token discloses no
//   personal data, because the reference is already a one-way HMAC.
//
// Signed with a key DERIVED from IDENTITY_SECRET rather than the secret
// itself, so a token signature can never be confused with, or used to
// probe, the identity-reference digests built from the same secret.

const encoder = new TextEncoder();

/** Long enough to finish a report unhurried; short enough to limit replay. */
const TTL_SECONDS = 30 * 60;

/**
 * Rejects a token minted for a different purpose or an older format.
 *
 *   NO DOT IN THIS VALUE, EVER.
 *   `.` separates the three segments. A scheme of "att.v1" produced
 *   four-segment tokens that the three-segment split here refused, so
 *   nothing verified at all — and the failure was invisible, because
 *   "rejected" is what the forgery tests expect to see. Every test in
 *   that section passed while the feature was completely broken.
 */
const SCHEME = 'attv1';

export type IdentityMethod = 'mobile' | 'aadhaar';

export interface AttestationClaims {
  /** The opaque `idref_…` digest. Never a raw identifier. */
  ref: string;
  method: IdentityMethod;
  /** Masked form, for display only. Carries no new information. */
  masked: string;
  /** Issued-at and expiry, seconds since epoch. */
  iat: number;
  exp: number;
}

function secret(): string {
  const value = process.env.IDENTITY_SECRET ?? process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('IDENTITY_SECRET is missing or too short (needs 32+ characters)');
  }
  return value;
}

async function sign(message: string): Promise<string> {
  // Purpose-separated key. Signing with the bare IDENTITY_SECRET would
  // mean one key doing two jobs, and a flaw in either would compromise
  // both.
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`attestation-signing:${secret()}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return b64url(new Uint8Array(sig));
}

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeText(text: string): string {
  return b64url(encoder.encode(text));
}

function b64urlDecodeText(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return null;
  }
}

/**
 * Constant-time string comparison.
 *
 * A `===` on two signatures leaks their common prefix through timing.
 * Marginal over the public internet, free to avoid, so there is no
 * reason to leave it — the same reasoning as api/otp/verify.ts.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mints an attestation. Called ONLY by /api/otp/verify, and only after a
 * code has actually been checked.
 */
export async function issueAttestation(
  ref: string,
  method: IdentityMethod,
  masked: string,
  now: number = Date.now()
): Promise<string> {
  const iat = Math.floor(now / 1000);
  const claims: AttestationClaims = { ref, method, masked, iat, exp: iat + TTL_SECONDS };
  const payload = b64urlEncodeText(JSON.stringify(claims));
  const body = `${SCHEME}.${payload}`;
  return `${body}.${await sign(body)}`;
}

/**
 * Verifies an attestation and returns its claims, or null.
 *
 * NULL FOR EVERY FAILURE, ON PURPOSE. Malformed, wrong scheme, bad
 * signature and expired are one answer to the caller: the token is not
 * acceptable. Distinguishing them in a response tells a forger which
 * half of the guess was right, and the caller has nothing different to
 * do in any of those cases.
 */
export async function verifyAttestation(
  token: unknown,
  now: number = Date.now()
): Promise<AttestationClaims | null> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [scheme, payload, signature] = parts as [string, string, string];
  if (scheme !== SCHEME) return null;

  // Recomputed over the received bytes, so any edit to the payload —
  // swapping `ref` for someone else's, pushing `exp` into next year —
  // changes what is signed and fails here.
  const expected = await sign(`${scheme}.${payload}`);
  if (!timingSafeEqual(signature, expected)) return null;

  const json = b64urlDecodeText(payload);
  if (!json) return null;

  let claims: AttestationClaims;
  try {
    claims = JSON.parse(json) as AttestationClaims;
  } catch {
    return null;
  }

  if (typeof claims?.ref !== 'string' || !claims.ref.startsWith('idref_')) return null;
  if (claims.method !== 'mobile' && claims.method !== 'aadhaar') return null;
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return null;

  const nowSeconds = Math.floor(now / 1000);
  if (nowSeconds >= claims.exp) return null;
  // A token whose iat is in the future is a clock problem or a forgery
  // attempt; either way it is not something to honour. Sixty seconds of
  // slack covers ordinary skew between the issuing and checking region.
  if (claims.iat > nowSeconds + 60) return null;

  return claims;
}

export const ATTESTATION_TTL_SECONDS = TTL_SECONDS;
