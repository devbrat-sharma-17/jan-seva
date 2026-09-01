// ============================================================
// OTP Service — the only thing the UI knows about verification
// ============================================================
//
// Two implementations behind one interface (spec §11):
//
//   demo / development  an in-memory challenge with a fixed code. No
//                       network, no provider, no cost. This is what the
//                       prototype has always done; it moved here so the
//                       UI stops importing it directly.
//
//   production          POST /api/otp/send and /api/otp/verify. The
//                       code is generated and checked server-side, the
//                       provider is chosen by server configuration, and
//                       nothing about it reaches this file.
//
// The screens call `sendMobileOtp` / `verifyMobileOtp` and cannot tell
// which is running. Swapping MSG91 for Twilio changes one environment
// variable and no component.
//
//   THE DEMO PATH IS NOT A FALLBACK.
//   If the production path fails, it fails. A "try the server, else
//   accept 123456" branch would mean an outage silently downgraded the
//   product to accepting a known code, which is the exact failure this
//   whole layer exists to prevent.

import type { IdentityMethod } from '../types';
import { demoOtpAllowed } from '../config/appMode';
import {
  deriveIdentityReference,
  maskIdentity,
  isValidMobile,
  isValidAadhaar,
} from './identityService';

export interface SendOtpResult {
  success: boolean;
  message: string;
  /** Masked destination, safe to display: "+91 XXXXX 43210". */
  targetMasked: string;
  /** Seconds before a resend is permitted. */
  resendAfterSeconds: number;
  /** Seconds the code stays valid, for the countdown. */
  expiresInSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  /** Present only on success — the opaque key complaints are matched on. */
  identityReference?: string;
  identityLabel?: string;
  /** Aadhaar eKYC would return a name; mobile verification does not. */
  verifiedName?: string;
}

// ------------------------------------------------------------
// Demo implementation
// ------------------------------------------------------------

/** Demo builds only. `demoOtpAllowed()` gates every path that reads it. */
const DEMO_OTP = '123456';
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface PendingChallenge {
  reference: string;
  method: IdentityMethod;
  issuedAt: number;
  attempts: number;
}

// In-memory only: a pending challenge must not outlive the page, and
// must never be written to storage (spec §12).
const pendingChallenges = new Map<string, PendingChallenge>();

function challengeKey(method: IdentityMethod, rawValue: string): string {
  return `${method}:${deriveIdentityReference(method, rawValue)}`;
}

async function sendDemo(rawValue: string, method: IdentityMethod): Promise<SendOtpResult> {
  await delay(700);

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

  pendingChallenges.set(challengeKey(method, rawValue), {
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
    expiresInSeconds: OTP_TTL_MS / 1000,
  };
}

async function verifyDemo(
  rawValue: string,
  otp: string,
  method: IdentityMethod
): Promise<VerifyOtpResult> {
  await delay(800);

  const cleanOtp = otp.replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return { success: false, message: 'Enter the 6-digit code.' };
  }

  const key = challengeKey(method, rawValue);
  const challenge = pendingChallenges.get(key);

  if (!challenge || Date.now() - challenge.issuedAt > OTP_TTL_MS) {
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
      message:
        left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Incorrect code.',
    };
  }

  pendingChallenges.delete(key);

  return {
    success: true,
    message: method === 'aadhaar' ? 'Identity verified with Aadhaar.' : 'Mobile number verified.',
    identityReference: deriveIdentityReference(method, rawValue),
    identityLabel: maskIdentity(method, rawValue),
    // The demo Aadhaar path returns a name because a real eKYC would.
    // Nothing in production may do this without an actual UIDAI
    // integration (spec §10).
    verifiedName: method === 'aadhaar' ? 'Raj Sharma' : undefined,
  };
}

// ------------------------------------------------------------
// Server implementation
// ------------------------------------------------------------

interface ApiErrorShape {
  error?: { code?: string; message?: string };
}

/**
 * A message safe to show, from a response we did not write.
 *
 * The endpoints already return citizen-ready copy, but a proxy, a WAF or
 * a cold-start failure can return something else entirely — HTML, or a
 * platform error page. Anything unrecognised becomes a generic sentence
 * rather than being rendered.
 */
async function messageFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorShape;
    const message = body.error?.message;
    return typeof message === 'string' && message.length > 0 && message.length < 300
      ? message
      : fallback;
  } catch {
    return fallback;
  }
}

async function sendServer(rawValue: string, method: IdentityMethod): Promise<SendOtpResult> {
  const failed = (message: string): SendOtpResult => ({
    success: false,
    message,
    targetMasked: '',
    resendAfterSeconds: 0,
  });

  try {
    const response = await fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mobile: rawValue, method }),
    });

    if (!response.ok) {
      return failed(await messageFrom(response, 'We could not send a code just now.'));
    }

    const body = (await response.json()) as {
      targetMasked?: string;
      resendAfterSeconds?: number;
      expiresInSeconds?: number;
    };

    return {
      success: true,
      message: `Verification code sent to ${body.targetMasked ?? ''}`.trim(),
      targetMasked: body.targetMasked ?? '',
      resendAfterSeconds: body.resendAfterSeconds ?? 30,
      expiresInSeconds: body.expiresInSeconds,
    };
  } catch {
    // Network failure, not a rejection. Distinguishing them matters:
    // "check your connection" is actionable, "incorrect code" is not.
    return failed('We could not reach the service. Check your connection and try again.');
  }
}

async function verifyServer(
  rawValue: string,
  otp: string,
  method: IdentityMethod
): Promise<VerifyOtpResult> {
  try {
    const response = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mobile: rawValue, code: otp, method }),
    });

    if (!response.ok) {
      return { success: false, message: await messageFrom(response, 'Incorrect verification code.') };
    }

    const body = (await response.json()) as {
      identityReference?: string;
      identityLabel?: string;
    };

    if (!body.identityReference) {
      return { success: false, message: 'Incorrect verification code.' };
    }

    return {
      success: true,
      message: 'Mobile number verified.',
      identityReference: body.identityReference,
      identityLabel: body.identityLabel,
    };
  } catch {
    return {
      success: false,
      message: 'We could not reach the service. Check your connection and try again.',
    };
  }
}

// ------------------------------------------------------------
// Public interface
// ------------------------------------------------------------

export function sendMobileOtp(rawValue: string, method: IdentityMethod = 'mobile') {
  return demoOtpAllowed() ? sendDemo(rawValue, method) : sendServer(rawValue, method);
}

export function verifyMobileOtp(
  rawValue: string,
  otp: string,
  method: IdentityMethod = 'mobile'
) {
  return demoOtpAllowed() ? verifyDemo(rawValue, otp, method) : verifyServer(rawValue, otp, method);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
