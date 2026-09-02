// ============================================================
// Screening types — AI assessment, risk, moderation
// ============================================================
// Three things live here that must never collapse into each other:
//
//   AI ASSESSMENT      what a model said about an image. A measurement.
//   RISK ASSESSMENT    what our own rules make of that measurement plus
//                      the deterministic signals (hash reuse, history).
//   MODERATION         what a human decided. The only authority.
//
// Spec §18 requires the three be stored separately, and the type system
// is where that is cheapest to enforce: a moderation decision has no
// field to write an AI verdict into, and vice versa.

// ------------------------------------------------------------
// AI assessment (spec §2)
// ------------------------------------------------------------

/** Deliberately ordinal, not a 0-1 score. A model's "0.73" is not a probability. */
export type CivicRelevance = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type Likelihood = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type ConsistencyStatus = 'CONSISTENT' | 'PARTIAL' | 'INCONSISTENT' | 'UNKNOWN';

export type ImageQuality = 'USABLE' | 'LOW_QUALITY' | 'UNUSABLE';

/**
 * Named signals a model may raise. A closed set, not free text: the model
 * returns strings, and letting arbitrary model output become a stored
 * enum is how prompt injection reaches the database (spec §2, §46).
 * Anything unrecognised is dropped at the boundary.
 */
export const SUSPICIOUS_SIGNALS = [
  'PORTRAIT_OR_SELFIE',
  'SCREENSHOT',
  'PHOTO_OF_SCREEN',
  'MEME_OR_POSTER',
  'DOCUMENT',
  'INDOOR_PERSONAL_SCENE',
  'NO_IDENTIFIABLE_SCENE',
  'DESCRIPTION_MISMATCH',
  'STOCK_OR_PROMOTIONAL',
  /**
   * The image looks generated or heavily synthesised rather than
   * photographed.
   *
   * Treated as a SIGNAL, never as proof. No detector — this one
   * included — can establish that an image is synthetic, and the
   * failure mode is ugly: an ordinary phone photo degraded by
   * compression or low light reads as "generated" to many of them.
   * It contributes to blocking only when the image also has no civic
   * content at all (see `meetsBlockThreshold`).
   */
  'AI_GENERATED',
] as const;

export type SuspiciousSignal = (typeof SUSPICIOUS_SIGNALS)[number];

/**
 * The result of one model call.
 *
 * `available: false` is a first-class outcome, not an error to swallow.
 * The AI being down must never block complaint intake (spec §33), and a
 * complaint screened by nothing must never be described as screened.
 */
export type ImageIntelligenceResult =
  | {
      available: false;
      reason: 'DISABLED' | 'NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'RATE_LIMITED';
      analyzedAt: string;
    }
  | {
      available: true;
      civicRelevance: CivicRelevance;
      /** The model's category guess. Advisory — the citizen still confirms. */
      issueCategory: string | null;
      issueConfidence: Likelihood;
      /** Is a face in frame at all? On its own this means nothing (spec §5). */
      facePresence: boolean;
      /** How much of the frame the face occupies. This is the meaningful one. */
      faceDominance: Likelihood;
      portraitLikelihood: Likelihood;
      screenshotLikelihood: Likelihood;
      imageDescriptionConsistency: ConsistencyStatus;
      imageQuality: ImageQuality;
      suspiciousSignals: SuspiciousSignal[];
      /** The model's own confidence in this assessment. */
      aiConfidence: Likelihood;
      modelProvider: string;
      modelVersion: string;
      analyzedAt: string;
    };

// ------------------------------------------------------------
// Risk assessment (spec §13)
// ------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Every risk signal, with the weight it contributed.
 *
 * Weights are carried on the signal rather than looked up later so an
 * assessment stays explainable after the weights are retuned — an
 * archived HIGH that can no longer be re-derived is not auditable.
 */
export interface RiskSignal {
  code: string;
  /** Shown to moderators. Never accusatory (spec §26). */
  label: string;
  weight: number;
  /** Where it came from, so a moderator can weigh AI against fact. */
  source: 'ai' | 'deterministic' | 'history';
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  assessedAt: string;
}

/** What the pre-submit gate decided (spec §14). */
export type SubmissionDecision =
  | { action: 'ALLOW' }
  | { action: 'ALLOW_AND_MONITOR' }
  | { action: 'ALLOW_AND_FLAG'; reviewDueAt: string }
  | { action: 'BLOCK'; citizenMessage: string; citizenMessageHindi: string };

// ------------------------------------------------------------
// Moderation (spec §16, §17)
// ------------------------------------------------------------

export type ModerationState =
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'VALIDATED'
  | 'DUPLICATE'
  | 'SPAM'
  | 'INVALID'
  | 'NEEDS_CLARIFICATION'
  | 'ESCALATED';

/** The subset a human may choose. `PENDING_REVIEW` is a state, not a verdict. */
export type ModerationOutcome =
  | 'VALIDATED'
  | 'DUPLICATE'
  | 'SPAM'
  | 'INVALID'
  | 'NEEDS_CLARIFICATION';

/** Outcomes that count as confirmed abuse for the strike policy (spec §21). */
export const ABUSE_OUTCOMES: readonly ModerationOutcome[] = ['SPAM', 'INVALID'];

export interface ModerationCase {
  complaintId: string;
  state: ModerationState;
  /** Frozen at flag time. The AI result is historical and never overwritten. */
  risk: RiskAssessment;
  aiAssessment: ImageIntelligenceResult;
  createdAt: string;
  /** createdAt + 24h (spec §15). */
  reviewDueAt: string;
  openedBy?: string;
  openedAt?: string;
  decision?: ModerationDecision;
}

export interface ModerationDecision {
  outcome: ModerationOutcome;
  /** Required. A decision without a stated reason is not auditable. */
  reason: string;
  moderatorId: string;
  moderatedAt: string;
}

// ------------------------------------------------------------
// Abuse profile (spec §21)
// ------------------------------------------------------------
//
// Keyed on identity reference, never on a phone number, and NEVER
// surfaced to the citizen as a score. This is an internal record of
// confirmed human decisions — not of AI suspicion.

export interface CitizenAbuseProfile {
  identityReference: string;
  confirmedInvalidCount: number;
  confirmedSpamCount: number;
  warningCount: number;
  restrictionCount: number;
  lastConfirmedAbuseAt?: string;
  /** Set by policy when a cooldown applies. Always has an end. */
  cooldownUntil?: string;
  /** Future submissions need a human look before they reach a department. */
  requiresManualReview: boolean;
}

export type AbuseAction =
  | { kind: 'NONE' }
  | { kind: 'WARNING'; message: string }
  | { kind: 'WARNING_AND_COOLDOWN'; message: string; cooldownMs: number }
  | { kind: 'MANUAL_REVIEW_REQUIRED'; message: string };
