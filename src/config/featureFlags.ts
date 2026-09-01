// ============================================================
// Feature flags — screening and moderation (spec §41)
// ============================================================
//
//   THE DEFAULTS ARE THE POINT.
//
// Spec §41: "Do not accidentally activate punitive behavior simply
// because an environment variable is missing." So every flag that can
// act AGAINST a citizen defaults to OFF and must be switched on by name.
// Every flag that only observes defaults to ON.
//
// The asymmetry is deliberate. A missing variable on a fresh deploy
// should cost us some screening coverage; it must never cost a citizen a
// blocked complaint, a warning SMS or a submission cooldown.
//
// These are read from `import.meta.env` and are therefore build-time and
// public. That is fine: a flag is not a secret, and knowing that
// blocking is off tells an abuser nothing they could not learn by trying.
// The flags that gate a punitive ACTION are re-checked server-side by the
// endpoint that performs it — the client flag only decides whether to ask.

function readFlag(name: string, fallback: boolean): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const raw = env?.[name];
    if (typeof raw !== 'string') return fallback;
    const value = raw.trim().toLowerCase();
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    // An unparseable value is a misconfiguration. Fall back to the safe
    // default rather than guessing at intent.
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Run the model at all.
 *
 * ON by default: screening on its own is observation. It produces an
 * assessment and nothing else acts on it unless another flag is set.
 * With no provider configured this resolves to UNAVAILABLE, which is
 * handled everywhere as "not screened" rather than as "passed".
 */
export const AI_SCREENING_ENABLED = readFlag('VITE_AI_SCREENING_ENABLED', true);

/**
 * Let the gate refuse a submission before a complaint exists.
 *
 * OFF by default. This is the only path in the product where software
 * alone stops a citizen from filing, and it is switched on deliberately
 * after the false-positive suite has been run against real photographs
 * from the city — not inherited from a default.
 */
export const PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED = readFlag(
  'VITE_PRE_SUBMIT_BLOCK_ENABLED',
  false
);

/** Score submissions and open moderation cases. Observation; ON. */
export const POST_SUBMIT_RISK_SCORING_ENABLED = readFlag('VITE_RISK_SCORING_ENABLED', true);

/** The admin moderation queue. Reviewing is never punitive; ON. */
export const MODERATION_ENABLED = readFlag('VITE_MODERATION_ENABLED', true);

/**
 * Send a citizen an SMS saying their complaint was found invalid.
 *
 * OFF by default. Reaches a real person's phone, and there is no SMS
 * provider configured yet anyway (see the previous phase). Turning this
 * on with a mis-tuned risk engine means texting accusations to people
 * who reported real potholes.
 */
export const CITIZEN_WARNING_ENABLED = readFlag('VITE_CITIZEN_WARNING_ENABLED', false);

/**
 * Apply cooldowns and manual-review requirements after repeated
 * CONFIRMED abuse.
 *
 * OFF by default, and note what it is gated on: confirmed human
 * decisions, never AI suspicion (spec §22).
 */
export const REPEAT_ABUSE_RESTRICTION_ENABLED = readFlag(
  'VITE_ABUSE_RESTRICTION_ENABLED',
  false
);

/** Everything, for the moderation screen's own status panel. */
export function screeningFlagSnapshot(): Record<string, boolean> {
  return {
    AI_SCREENING_ENABLED,
    PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED,
    POST_SUBMIT_RISK_SCORING_ENABLED,
    MODERATION_ENABLED,
    CITIZEN_WARNING_ENABLED,
    REPEAT_ABUSE_RESTRICTION_ENABLED,
  };
}
