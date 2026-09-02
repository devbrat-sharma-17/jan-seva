// ============================================================
// Citizen Report Risk Service (spec §13, §14)
// ============================================================
//
// The model produces MEASUREMENTS. This file turns them into a decision,
// and it is deliberately the only place that does.
//
// Why the separation is not ceremony: a model can be asked "is this
// fake?" and will answer, fluently, every time. Letting that answer
// become a database state means an unaccountable classifier decides
// whether a citizen may report a broken streetlight. So the model is
// never asked for a verdict — only for observations — and the verdict is
// computed here from rules that can be read, tuned, tested and argued
// with in review.
//
//   Everything here is PURE. No storage, no network, no clock except
//   what the caller passes. That is what makes the 40+ screening tests
//   possible without a model, a database or a browser.
//
// ------------------------------------------------------------
// THE FACE RULE (spec §5) — read before touching the weights
// ------------------------------------------------------------
// A person standing next to a pothole is the single most common shape of
// a genuine civic photograph. Citizens photograph problems with people
// in them: a worker beside a dug-up pipe, a pedestrian stepping around
// standing water, a child next to an open drain. `facePresence` is
// therefore worth ZERO risk on its own and always will be.
//
// What matters is whether the frame is ABOUT the person: face dominance
// and portrait likelihood, and even then only in combination with the
// image having no civic content. Any change that gives bare
// `facePresence` a non-zero weight is a bug, and the test suite fails on
// it deliberately.

import type {
  CivicRelevance,
  ImageIntelligenceResult,
  Likelihood,
  RiskAssessment,
  RiskLevel,
  RiskSignal,
  SubmissionDecision,
} from '../types/screening';

// ------------------------------------------------------------
// Configurable policy (spec §13: "keep the scoring configurable")
// ------------------------------------------------------------

export interface RiskWeights {
  nonCivicImage: number;
  portraitDominant: number;
  screenshot: number;
  descriptionMismatch: number;
  exactImageReuse: number;
  nearImageReuse: number;
  rapidResubmission: number;
  locationMismatch: number;
  priorConfirmedAbuse: number;
  unusableImage: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = {
  // The heaviest AI signal, and still not enough on its own to reach
  // CRITICAL — that needs corroboration, by construction.
  nonCivicImage: 35,
  portraitDominant: 25,
  screenshot: 20,
  descriptionMismatch: 15,

  // Deterministic signals outweigh model opinion. A byte-identical
  // re-upload is a fact; "looks like a selfie" is a judgement.
  //
  // `exactImageReuse` is set to reach the HIGH threshold ON ITS OWN
  // (45 >= thresholds.high). That is deliberate and load-bearing: spec
  // §28 CASE 6 requires a re-used image to reach a moderator, and the
  // same photograph appearing on two complaints is either a duplicate
  // report or recycled evidence — both of which a human should see.
  // It flags; it never blocks. If `thresholds.high` moves, this moves
  // with it, and the CASE 6 test fails if they drift apart.
  exactImageReuse: 45,
  // Near-duplicates stay below the threshold. Recompression and
  // re-cropping happen innocently — a photo shared through WhatsApp and
  // back — so on its own this is watched, not escalated.
  nearImageReuse: 25,

  rapidResubmission: 15,
  locationMismatch: 10,

  // History, and only CONFIRMED history — see `priorConfirmedAbuse` in
  // the input type. AI suspicion never accumulates here (spec §22).
  priorConfirmedAbuse: 30,

  unusableImage: 10,
};

export interface RiskThresholds {
  medium: number;
  high: number;
  critical: number;
}

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  medium: 20,
  high: 45,
  critical: 75,
};

// ------------------------------------------------------------
// Input
// ------------------------------------------------------------

export interface DeterministicSignals {
  /** A byte-identical image already exists on another complaint. */
  exactImageReuse: boolean;
  /** A perceptually near-identical image exists elsewhere (dHash). */
  nearImageReuse: boolean;
  /** Submissions from this identity in the last hour, this one included. */
  recentSubmissionCount: number;
  /** EXIF GPS vs the confirmed location. `unknown` is the common case. */
  gpsConsistency: 'GPS_MATCH' | 'GPS_MISMATCH' | 'GPS_UNAVAILABLE';
  /** Count of moderator-CONFIRMED spam/invalid decisions for this citizen. */
  priorConfirmedAbuseCount: number;
}

export const NO_DETERMINISTIC_SIGNALS: DeterministicSignals = {
  exactImageReuse: false,
  nearImageReuse: false,
  recentSubmissionCount: 1,
  gpsConsistency: 'GPS_UNAVAILABLE',
  priorConfirmedAbuseCount: 0,
};

export interface RiskInput {
  ai: ImageIntelligenceResult;
  deterministic: DeterministicSignals;
  now?: number;
}

// ------------------------------------------------------------
// Ordinal helpers
// ------------------------------------------------------------

const RELEVANCE_ORDER: Record<CivicRelevance, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const LIKELIHOOD_ORDER: Record<Likelihood, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

const atLeast = (value: Likelihood, floor: Likelihood): boolean =>
  LIKELIHOOD_ORDER[value] >= LIKELIHOOD_ORDER[floor];

// ------------------------------------------------------------
// Scoring
// ------------------------------------------------------------

export function assessRisk(
  input: RiskInput,
  weights: RiskWeights = DEFAULT_WEIGHTS,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS
): RiskAssessment {
  const { ai, deterministic } = input;
  const signals: RiskSignal[] = [];

  const add = (code: string, label: string, weight: number, source: RiskSignal['source']) => {
    if (weight > 0) signals.push({ code, label, weight, source });
  };

  // ---- AI signals -------------------------------------------------
  //
  // Skipped entirely when the model did not run. An unscreened
  // submission scores as though the AI said nothing, which is exactly
  // what happened — it must not score as though the AI said "fine"
  // (that would be a false clearance) or "suspicious" (that would
  // punish a citizen for our outage). See spec §33.
  if (ai.available) {
    if (ai.civicRelevance === 'VERY_LOW') {
      add('NON_CIVIC_IMAGE', 'Image does not appear to show a civic issue', weights.nonCivicImage, 'ai');
    } else if (ai.civicRelevance === 'LOW') {
      add('WEAK_CIVIC_RELEVANCE', 'Civic content unclear in image', Math.round(weights.nonCivicImage / 2), 'ai');
    }

    // NOTE: `ai.facePresence` is intentionally not consulted. See the
    // face rule at the top of this file.
    if (atLeast(ai.faceDominance, 'HIGH') && atLeast(ai.portraitLikelihood, 'HIGH')) {
      add('PORTRAIT_DOMINANT', 'Image is dominated by a portrait or selfie', weights.portraitDominant, 'ai');
    }

    if (atLeast(ai.screenshotLikelihood, 'HIGH')) {
      add('SCREENSHOT', 'Image appears to be a screenshot or a photo of a screen', weights.screenshot, 'ai');
    }

    if (ai.imageDescriptionConsistency === 'INCONSISTENT') {
      add('DESCRIPTION_MISMATCH', 'Photo and description do not appear to match', weights.descriptionMismatch, 'ai');
    }

    // Low quality is NOT fraud (spec §9). It carries a token weight so a
    // moderator can see it, never enough to reach a threshold alone.
    if (ai.imageQuality === 'UNUSABLE') {
      add('UNUSABLE_IMAGE', 'Image cannot be assessed', weights.unusableImage, 'ai');
    }
  }

  // ---- Deterministic signals -------------------------------------
  if (deterministic.exactImageReuse) {
    add('EXACT_IMAGE_REUSE', 'This exact image was submitted before', weights.exactImageReuse, 'deterministic');
  } else if (deterministic.nearImageReuse) {
    add('NEAR_IMAGE_REUSE', 'A near-identical image was submitted before', weights.nearImageReuse, 'deterministic');
  }

  if (deterministic.recentSubmissionCount > 3) {
    add('RAPID_RESUBMISSION', `${deterministic.recentSubmissionCount} submissions in the last hour`, weights.rapidResubmission, 'deterministic');
  }

  // Only a MISMATCH counts. Missing EXIF is the norm — most phones and
  // every messaging app strip it — and treating absence as suspicion
  // would penalise the majority of honest reports (spec §12).
  if (deterministic.gpsConsistency === 'GPS_MISMATCH') {
    add('GPS_MISMATCH', 'Photo location differs from the reported location', weights.locationMismatch, 'deterministic');
  }

  if (deterministic.priorConfirmedAbuseCount > 0) {
    add(
      'PRIOR_CONFIRMED_ABUSE',
      `${deterministic.priorConfirmedAbuseCount} previously confirmed invalid or spam report(s)`,
      weights.priorConfirmedAbuse,
      'history'
    );
  }

  const score = signals.reduce((total, signal) => total + signal.weight, 0);

  let level: RiskLevel = 'LOW';
  if (score >= thresholds.critical) level = 'CRITICAL';
  else if (score >= thresholds.high) level = 'HIGH';
  else if (score >= thresholds.medium) level = 'MEDIUM';

  return {
    level,
    score,
    signals,
    assessedAt: new Date(input.now ?? Date.now()).toISOString(),
  };
}

// ------------------------------------------------------------
// The pre-submit gate (spec §6, §14)
// ------------------------------------------------------------

const BLOCK_MESSAGE_EN =
  'This photo does not clearly show a civic issue. Please upload a clear photo of the road, streetlight, water, sanitation or other civic problem you are reporting.';

// Hindi copy from the spec, kept verbatim. Most reports in Gwalior are
// written this way, and a refusal a citizen cannot read is a refusal
// they cannot act on.
const BLOCK_MESSAGE_HI =
  'Is photo mein civic issue clearly visible nahi hai. Kripya road, streetlight, water, sanitation ya kisi aur civic problem ki clear photo upload karein.';

/**
 * Whether the evidence for "this image is not a civic issue" is strong
 * enough to refuse a submission.
 *
 * Every branch requires MULTIPLE independent signals (spec §6), and all
 * of them require the model to be confident. One weak signal never
 * blocks, and neither does a hesitant model.
 */
function meetsBlockThreshold(ai: ImageIntelligenceResult): boolean {
  if (!ai.available) return false;

  // Spec §7: low confidence must not auto-reject. A model that is
  // guessing is worth less than a citizen's word.
  if (!atLeast(ai.aiConfidence, 'HIGH')) return false;

  // An unusable image cannot support a confident claim about its
  // contents. "Too dark to tell" is not "not a civic issue" (spec §9).
  if (ai.imageQuality === 'UNUSABLE') return false;

  const noCivicContent = RELEVANCE_ORDER[ai.civicRelevance] === RELEVANCE_ORDER.VERY_LOW;
  if (!noCivicContent) return false;

  const isPortrait = atLeast(ai.faceDominance, 'HIGH') && atLeast(ai.portraitLikelihood, 'HIGH');
  const isScreenshot = atLeast(ai.screenshotLikelihood, 'HIGH');

  /* Synthetic imagery, held to the same guard as the other two: it only
     reaches this line when civic relevance is already VERY_LOW.

     That ordering is the safeguard. AI detectors false-positive on
     ordinary photographs — compression, motion blur and low light all
     read as "generated" to some of them — and a citizen whose real
     pothole is called fake has no way to argue. Requiring "no civic
     content in the image" first means a genuine road photo survives a
     wrong AI verdict, and only an image that is BOTH not-civic AND
     confidently synthetic is refused. A generated picture that does
     show a convincing pothole still gets through here and is caught by
     risk scoring and moderation instead — which is the right place for
     a judgement this uncertain (spec §14, §47). */
  const isSynthetic = ai.suspiciousSignals.includes('AI_GENERATED');

  return isPortrait || isScreenshot || isSynthetic;
}

export interface DecisionOptions {
  /** The PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED flag, passed in for testability. */
  blockingEnabled: boolean;
  now?: number;
}

/** 24 hours, per the moderation SLA (spec §15). */
export const MODERATION_SLA_MS = 24 * 60 * 60 * 1000;

/**
 * The decision matrix.
 *
 *   LOW       allow
 *   MEDIUM    allow, record the assessment
 *   HIGH      allow, open a moderation case
 *   CRITICAL  allow and flag — UNLESS the non-civic evidence is strong
 *             enough on its own terms to justify refusing.
 *
 * Note what CRITICAL does NOT do: a high score assembled from history
 * and hash reuse never blocks, however large. Blocking is reserved for
 * "this specific image is not a civic issue", which is a claim about the
 * submission in hand rather than about the person making it. A citizen
 * with two confirmed spam reports who photographs a real pothole gets
 * their complaint filed, and a moderator looks at it.
 */
export function decideSubmission(
  risk: RiskAssessment,
  ai: ImageIntelligenceResult,
  options: DecisionOptions
): SubmissionDecision {
  const now = options.now ?? Date.now();

  if (options.blockingEnabled && meetsBlockThreshold(ai)) {
    return {
      action: 'BLOCK',
      citizenMessage: BLOCK_MESSAGE_EN,
      citizenMessageHindi: BLOCK_MESSAGE_HI,
    };
  }

  if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
    return {
      action: 'ALLOW_AND_FLAG',
      reviewDueAt: new Date(now + MODERATION_SLA_MS).toISOString(),
    };
  }

  if (risk.level === 'MEDIUM') return { action: 'ALLOW_AND_MONITOR' };

  return { action: 'ALLOW' };
}

/**
 * Moderator-facing summary of the AI assessment (spec §26).
 *
 * Describes signals, never intent. "Submission shows multiple signals
 * requiring review" is the register; "citizen is lying" is not something
 * this system is in a position to know.
 */
export function describeAssessment(ai: ImageIntelligenceResult, risk: RiskAssessment): string[] {
  if (!ai.available) {
    return [
      `Automated screening did not run (${ai.reason.toLowerCase().replace(/_/g, ' ')}).`,
      'This submission has not been assessed by any model. Review on its own merits.',
    ];
  }

  const lines = [
    `Civic relevance: ${title(ai.civicRelevance)}`,
    `Face dominance: ${title(ai.faceDominance)}`,
    `Description consistency: ${title(ai.imageDescriptionConsistency)}`,
    `Image quality: ${title(ai.imageQuality)}`,
    `Model confidence: ${title(ai.aiConfidence)}`,
  ];

  if (risk.signals.some((s) => s.code.includes('REUSE'))) {
    lines.push('Image reuse: found');
  }

  lines.push(`Overall: ${risk.level} risk — ${risk.signals.length} signal(s) recorded.`);
  return lines;
}

function title(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
