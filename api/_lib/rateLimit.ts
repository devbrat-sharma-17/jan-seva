// ============================================================
// Rate limiting — server side (spec §51, §52)
// ============================================================
// The prototype's `loginThrottle` is in sessionStorage and says in its
// own header that it stops nobody. This is the one that counts: the
// counter lives in Postgres, so it survives a function cold start, is
// shared across regions, and cannot be cleared by the client that is
// being limited.
//
// A fixed window, not a token bucket. The abuse this faces is a script
// hammering OTP send or login; a fixed window stops that. The known
// weakness — up to 2x the limit across a window boundary — is acceptable
// here and would not be for a payment API, so it is written down rather
// than papered over.

import { rpc } from './db';
import { hashSubject } from './identity';

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  windowSeconds: number;
}

/**
 * The limits, in one place so they can be read as a policy rather than
 * hunted through handlers.
 *
 * OTP send is the tightest: each one costs money and lands on somebody's
 * phone, so 3 per 15 minutes per number is generous for a real citizen
 * and useless for a spammer. Verification is looser because an honest
 * person mistypes a code, but it is still bounded — see also the
 * per-challenge attempt cap, which is the one that actually stops a
 * brute force on a single code.
 */
export const RULES = {
  'otp:send:identity': { limit: 3, windowSeconds: 15 * 60 },
  'otp:send:ip': { limit: 10, windowSeconds: 15 * 60 },
  'otp:verify:identity': { limit: 10, windowSeconds: 15 * 60 },
  'auth:login:ip': { limit: 20, windowSeconds: 15 * 60 },
  'auth:login:account': { limit: 8, windowSeconds: 15 * 60 },
  'complaint:create:identity': { limit: 5, windowSeconds: 60 * 60 },
  'complaint:create:ip': { limit: 15, windowSeconds: 60 * 60 },
  'evidence:upload:user': { limit: 60, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RULES;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window rolls. Only meaningful when blocked. */
  retryAfter: number;
}

function windowStart(windowSeconds: number, now: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now / ms) * ms);
}

/**
 * Records one hit and reports whether it is permitted.
 *
 * Counts first, then decides. Counting only permitted requests would let
 * a caller stay under the limit forever by ignoring the 429s, which is
 * exactly what a script does.
 *
 * If the database is unreachable the request is ALLOWED. That is a
 * deliberate choice and the risk is stated: failing closed would turn a
 * database blip into a total outage of complaint filing for a city.
 * Rate limiting is abuse control, not an authorisation check — the
 * checks that must never fail open are elsewhere and do not use this.
 */
export async function consume(
  bucket: RateLimitBucket,
  rawSubject: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const rule = RULES[bucket];
  const start = windowStart(rule.windowSeconds, now);
  const resetAt = start.getTime() + rule.windowSeconds * 1000;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  try {
    const subject = await hashSubject(rawSubject);

    // ONE statement, and it must stay one.
    //
    // This was a select, an increment in JavaScript, and an upsert. Three
    // round trips with no lock between them: concurrent callers all read
    // the same count and all wrote the same value, so a burst of 25
    // requests spent one unit of a 15-unit budget and none was refused.
    // HTTP testing caught it; reading the code did not, because the
    // sequential path it was written and reviewed against is correct.
    //
    // `consume_rate_limit` (0010) does the read-increment-write as a
    // single `on conflict do update`, which takes a row lock and
    // serialises the racers.
    const next = await rpc<number>('consume_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
      p_window_start: start.toISOString(),
    });

    return {
      allowed: next <= rule.limit,
      remaining: Math.max(0, rule.limit - next),
      retryAfter,
    };
  } catch (err) {
    console.error('[ratelimit] unavailable, allowing request', {
      bucket,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return { allowed: true, remaining: rule.limit, retryAfter: 0 };
  }
}

/**
 * The caller's address, as far as it can be trusted.
 *
 * `x-forwarded-for` is client-settable in general; behind Vercel's proxy
 * the LEFTMOST entry is the real client and the rest are hops. Vercel
 * also sets `x-real-ip`, which it controls, so that is preferred.
 *
 * Whatever comes back is only ever used as a rate-limit subject and is
 * hashed before storage. Nothing is authorised on the strength of it.
 */
export function clientAddress(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();

  return 'unknown';
}
