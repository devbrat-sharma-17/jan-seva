// ============================================================
// App Mode — the one switch that separates demo from real
// ============================================================
//
// Until now there was no such thing as "production" in this codebase.
// The demo account directory, the Quick Demo buttons and the seeded
// complaint history were unconditional, which is fine for a prototype
// and unacceptable for a public beta: "Demo Admin — skip sign-in" must
// not open a real city's command centre, and synthetic complaints must
// not be counted as real civic data.
//
//   development   local work. Demo accounts, demo OTP, seeded data.
//   demo          a shareable build for judges and stakeholders.
//                 Same as development; named separately so a deployed
//                 demo is never mistaken for the real deployment.
//   production    the real Gwalior beta. No demo credentials, no Quick
//                 Demo, no seeded complaints, no fixed OTP.
//
// Set with VITE_APP_MODE. Absent, it is derived from the build: a
// production build with no explicit mode is treated as production, which
// is the safe direction to fail in — an unconfigured deploy loses its
// demo shortcuts rather than exposing them.
//
//   THIS IS NOT A SECURITY BOUNDARY.
//   Everything here runs in the browser. It stops a demo shortcut from
//   being *offered* and stops synthetic data from being *seeded*; it
//   stops nobody who edits the bundle. The real refusal has to come from
//   the server, which must simply not have demo accounts in production.
//   This gate exists so the client never invites the attempt, and so a
//   mode mismatch is visible rather than silent.

export type AppMode = 'development' | 'demo' | 'production';

const VALID_MODES: readonly AppMode[] = ['development', 'demo', 'production'];

/**
 * Reads Vite's env without assuming it exists. The self-test bundle and
 * any future server-side execution do not necessarily have it.
 */
function readEnv(): { mode?: string; isProdBuild: boolean } {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    if (!env) return { isProdBuild: false };
    return {
      mode: typeof env.VITE_APP_MODE === 'string' ? env.VITE_APP_MODE : undefined,
      isProdBuild: env.PROD === true,
    };
  } catch {
    return { isProdBuild: false };
  }
}

function resolveAppMode(): AppMode {
  const { mode, isProdBuild } = readEnv();

  const normalized = mode?.trim().toLowerCase();
  if (normalized && (VALID_MODES as readonly string[]).includes(normalized)) {
    return normalized as AppMode;
  }

  // An unrecognised value is a misconfiguration, not a licence to open
  // the demo doors. Fail toward the stricter mode.
  if (normalized) return 'production';

  return isProdBuild ? 'production' : 'development';
}

export const APP_MODE: AppMode = resolveAppMode();

// ------------------------------------------------------------
// Policy
// ------------------------------------------------------------
//
// Pure functions of the mode rather than reads of the constant, so the
// self-test can assert what production does without a runtime override —
// an exported "set the mode" hook would be exactly the backdoor this
// module exists to close.

/** Demo credentials and the Quick Demo shortcut. Never in production. */
export function demoAccountsAllowed(mode: AppMode = APP_MODE): boolean {
  return mode !== 'production';
}

/** The synthetic Gwalior complaint history. Never seeded into real data. */
export function demoSeedDataAllowed(mode: AppMode = APP_MODE): boolean {
  return mode !== 'production';
}

/**
 * The fixed 123456 verification code. Production must send a real SMS or
 * refuse the verification outright; it must never accept a known code.
 */
export function demoOtpAllowed(mode: AppMode = APP_MODE): boolean {
  return mode !== 'production';
}

/**
 * Whether figures shown to the public may come from seeded records.
 * Mirrors the seed gate today, kept separate because the two can diverge:
 * a production deployment could legitimately carry a labelled
 * illustrative dataset without seeding it into the live store.
 */
export function syntheticStatsAllowed(mode: AppMode = APP_MODE): boolean {
  return mode !== 'production';
}

export const isProduction = (mode: AppMode = APP_MODE): boolean => mode === 'production';
