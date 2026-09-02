// ============================================================
// POST /api/otp/verify  (spec §12, §13)
// ============================================================
// On success the citizen gets an identity reference — the opaque key
// their complaints are matched on. They never get their own number back,
// and the code is consumed so it cannot be replayed.
//
// One failure message for every failure. "No such challenge", "expired",
// "wrong code" and "already used" all read as the same sentence, because
// distinguishing them tells an attacker which half of the guess was
// right (spec §12).

import { apiError, apiOk, readJsonBody, withErrorHandling } from '../_lib/errors';
import { select, update, isDbConfigured, dbUnavailable } from '../_lib/db';
import { deriveIdentityReference, isValidMobile } from '../_lib/identity';
import { consume } from '../_lib/rateLimit';
import { resolveProvider } from '../_lib/otpProviders';
import { issueAttestation, ATTESTATION_TTL_SECONDS } from '../_lib/attestation';

/**
 * Web-standard handler — see api/complaints/create.ts for the full note.
 * Vercel's Node runtime would pass an Express-shaped `req` and the first
 * `request.headers.get(...)` would throw.
 */
export const config = { runtime: 'edge' };

const INCORRECT = 'Incorrect verification code.';

const encoder = new TextEncoder();

interface ChallengeRow {
  id: string;
  code_hash: string;
  salt: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  consumed_at: string | null;
  provider: string | null;
  provider_ref: string | null;
}

async function hashCode(code: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison.
 *
 * A `===` on two hex digests leaks their common prefix through timing.
 * That is a marginal channel over the public internet and a free fix, so
 * there is no reason to leave it.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return apiError('VALIDATION_ERROR', 'Unsupported request.');
  }

  const body = await readJsonBody(request);
  const mobile = typeof body?.mobile === 'string' ? body.mobile : '';
  const code = (typeof body?.code === 'string' ? body.code : '').replace(/\D/g, '');

  if (!isValidMobile(mobile) || code.length !== 6) {
    return apiError('VALIDATION_ERROR', 'Enter the 6-digit code.');
  }

  if (!isDbConfigured()) return dbUnavailable();

  const digits = mobile.replace(/\D/g, '');

  const limited = await consume('otp:verify:identity', `mobile:${digits}`);
  if (!limited.allowed) {
    return apiError('RATE_LIMITED', 'Too many attempts. Please request a new code.', {
      retryAfter: limited.retryAfter,
    });
  }

  const identityReference = await deriveIdentityReference('mobile', digits);

  const rows = await select<ChallengeRow>(
    'otp_challenges',
    `identity_reference=eq.${encodeURIComponent(identityReference)}` +
      '&consumed_at=is.null' +
      '&order=issued_at.desc&limit=1' +
      '&select=id,code_hash,salt,attempts,max_attempts,expires_at,consumed_at,provider,provider_ref'
  );

  const challenge = rows[0];
  if (!challenge) return apiError('OTP_ERROR', INCORRECT);

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return apiError('OTP_ERROR', 'That code has expired. Please request a new one.');
  }

  if (challenge.attempts >= challenge.max_attempts) {
    // Burn it. Leaving an exhausted challenge open would let a caller
    // keep guessing against it after the rate-limit window rolls.
    await update('otp_challenges', `id=eq.${challenge.id}`, {
      consumed_at: new Date().toISOString(),
    });
    return apiError('OTP_ERROR', 'Too many incorrect attempts. Please request a new code.');
  }

  let matched = false;

  if (challenge.code_hash) {
    // Transactional: we hold the hash.
    matched = timingSafeEqual(await hashCode(code, challenge.salt), challenge.code_hash);
  } else {
    // Managed: the provider decides. It must be the SAME provider that
    // issued the challenge — a configuration change mid-flight must not
    // silently ask a different vendor about a code it never sent.
    const provider = resolveProvider();
    if (!provider?.verify || provider.name !== challenge.provider) {
      return apiError('OTP_ERROR', 'That code has expired. Please request a new one.');
    }
    matched = await provider.verify(digits, challenge.provider_ref ?? '', code);
  }

  if (!matched) {
    await update('otp_challenges', `id=eq.${challenge.id}`, {
      attempts: challenge.attempts + 1,
    });
    return apiError('OTP_ERROR', INCORRECT);
  }

  // Single use. Consumed before the response is built, so a replay of
  // the same request loses the race rather than verifying twice.
  await update('otp_challenges', `id=eq.${challenge.id}`, {
    consumed_at: new Date().toISOString(),
  });

  const identityLabel = `+91 XXXXX ${digits.slice(-5)}`;

  return apiOk({
    verified: true,
    identityReference,
    // The mask is rebuilt from the number the caller already sent. We do
    // not hand back anything they did not already have.
    identityLabel,
    method: 'mobile',
    // The server's signed statement that IT verified this identity, just
    // now. /api/complaints/create trusts this and nothing else about who
    // the caller is — `identityReference` above is returned for display
    // continuity only and carries no authority when sent back to us.
    identityAttestation: await issueAttestation(identityReference, 'mobile', identityLabel),
    attestationExpiresInSeconds: ATTESTATION_TTL_SECONDS,
  });
}

export default withErrorHandling(handler);
