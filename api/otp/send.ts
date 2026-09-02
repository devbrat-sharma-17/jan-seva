// ============================================================
// POST /api/otp/send  (spec §11, §12, §13)
// ============================================================
// The browser sends a mobile number. It gets back a masked destination
// and a cooldown. It never gets a code, a challenge id it could guess
// with, or any hint about whether that number has ever been seen before.
//
//   RESPONSE UNIFORMITY IS THE POINT.
//   §12 says not to reveal identity existence through OTP responses. A
//   valid, non-rate-limited number always produces the same shaped 200,
//   whether or not it has complaints against it — because the answer to
//   "does this number exist in your system" is worth money to a
//   harvester and nothing to a citizen.

import { apiError, apiOk, readJsonBody, withErrorHandling } from '../_lib/errors';
import { insert, isDbConfigured, dbUnavailable } from '../_lib/db';
import {
  deriveIdentityReference,
  isValidMobile,
  maskIdentity,
} from '../_lib/identity';
import { clientAddress, consume } from '../_lib/rateLimit';
import { resolveProvider, OtpProviderError } from '../_lib/otpProviders';

/**
 * Web-standard handler — see api/complaints/create.ts for the full note.
 * Without this, Vercel's Node runtime passes an Express-shaped `req` and
 * the first `request.headers.get(...)` throws. Everything here (fetch,
 * crypto.subtle, crypto.getRandomValues, btoa) runs on Edge.
 */
export const config = { runtime: 'edge' };

/** Matches the challenge TTL the UI counts down. */
const OTP_TTL_SECONDS = 5 * 60;

/** How long before the resend button re-enables. */
const RESEND_COOLDOWN_SECONDS = 30;

const encoder = new TextEncoder();

/** Salted SHA-256 of the code. The code itself is never persisted. */
async function hashCode(code: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return apiError('VALIDATION_ERROR', 'Unsupported request.');
  }

  const body = await readJsonBody(request);
  const mobile = typeof body?.mobile === 'string' ? body.mobile : '';

  // Aadhaar is deliberately not accepted here. The UI still offers it
  // (spec §10) but there is no UIDAI integration and there will not be
  // one in this phase, so this endpoint refuses rather than sending an
  // SMS OTP and calling the result "Aadhaar verified".
  if (body?.method === 'aadhaar') {
    return apiError(
      'PROVIDER_UNAVAILABLE',
      'Aadhaar verification is not available yet. Please verify with your mobile number.'
    );
  }

  if (!isValidMobile(mobile)) {
    return apiError('VALIDATION_ERROR', 'Enter a valid 10-digit mobile number.');
  }

  const digits = mobile.replace(/\D/g, '');

  if (!isDbConfigured()) return dbUnavailable();

  const provider = resolveProvider();
  if (!provider) {
    return apiError(
      'PROVIDER_UNAVAILABLE',
      'Verification by SMS is not available yet. You can still track your complaint with its ID.'
    );
  }

  // Two limits, because they stop different attacks: per-number stops
  // someone being harassed with codes, per-address stops one script
  // walking a range of numbers.
  const byIdentity = await consume('otp:send:identity', `mobile:${digits}`);
  if (!byIdentity.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many verification codes requested. Please wait before trying again.',
      { retryAfter: byIdentity.retryAfter }
    );
  }

  const byAddress = await consume('otp:send:ip', clientAddress(request));
  if (!byAddress.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many requests from this connection. Please wait before trying again.',
      { retryAfter: byAddress.retryAfter }
    );
  }

  const identityReference = await deriveIdentityReference('mobile', digits);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  try {
    const result = await provider.send(digits);

    if (result.kind === 'managed') {
      // The provider holds the code. We record only that a challenge is
      // outstanding and which handle verifies it.
      await insert('otp_challenges', {
        identity_reference: identityReference,
        method: 'mobile',
        code_hash: '',
        salt: '',
        expires_at: expiresAt,
        dispatched_at: new Date().toISOString(),
        provider: provider.name,
        provider_ref: result.providerRef,
      });
    } else {
      const salt = randomSalt();
      await insert('otp_challenges', {
        identity_reference: identityReference,
        method: 'mobile',
        code_hash: await hashCode(result.code, salt),
        salt,
        expires_at: expiresAt,
        dispatched_at: new Date().toISOString(),
        provider: provider.name,
        provider_ref: result.providerRef ?? null,
      });
      // `result.code` goes out of scope here and is never written,
      // logged or returned.
    }
  } catch (err) {
    // The provider's own message may name the account or the template.
    // It goes to the log, not to the citizen.
    console.error('[otp/send] provider failed', {
      provider: provider.name,
      message: err instanceof OtpProviderError ? err.message : 'unknown',
    });
    return apiError('OTP_ERROR', 'We could not send a code just now. Please try again shortly.');
  }

  return apiOk({
    sent: true,
    targetMasked: maskIdentity('mobile', digits),
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
  });
}

export default withErrorHandling(handler);
