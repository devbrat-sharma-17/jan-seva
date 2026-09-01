// ============================================================
// Moderation Service (spec §15-§23, §36)
// ============================================================
//
// Where an AI assessment stops and a human decision starts.
//
// The invariant this file exists to hold: NOTHING punitive happens
// without a named human having made a decision with a stated reason.
// The risk engine opens cases. Only `recordDecision` closes them, only a
// moderator can call it, and only a CONFIRMED spam/invalid outcome
// touches an abuse profile. AI suspicion never accumulates into a strike
// (spec §22).
//
// Storage follows the rest of this codebase: the local store today, with
// the same subscription mechanics, so the portals stay live. The
// production home is the `moderation_cases` / `citizen_abuse_profiles`
// tables in migration 0006, behind an endpoint that re-checks the
// moderator's role server-side — a client-side role check is a usability
// affordance, not authorisation, and the same is true here.

import type {
  AbuseAction,
  CitizenAbuseProfile,
  ImageIntelligenceResult,
  ModerationCase,
  ModerationDecision,
  ModerationOutcome,
  ModerationState,
  RiskAssessment,
} from '../types/screening';
import { ABUSE_OUTCOMES } from '../types/screening';
import { MODERATION_SLA_MS } from './citizenReportRiskService';
import { readJSON, writeJSON, subscribeToKey } from './storage';
import { recordAuditEvent, type AuditActor } from './auditService';

/** Cases are opened by the pipeline, not by a person. */
const SYSTEM_ACTOR: AuditActor = { id: 'system', name: 'Automated screening', role: 'system' };

const CASES_KEY = 'jan_seva_moderation_cases_v1';
const PROFILES_KEY = 'jan_seva_abuse_profiles_v1';

// ------------------------------------------------------------
// Strike policy (spec §21) — configurable, and never permanent
// ------------------------------------------------------------
//
// Spec §21: "Do NOT hard-code permanent bans." So there is no ban here
// at all, at any count. The strongest outcome is that a citizen's future
// submissions need a human to look at them before they reach a
// department — which slows their reports down and never stops them.
//
// Note the escalation is on CONFIRMED incidents only, and that a
// cooldown always has an end. An emergency — a burst main, a live wire —
// must not be unreportable because of an argument about a previous
// complaint (spec §23).

export interface StrikePolicy {
  warnAt: number;
  cooldownAt: number;
  cooldownMs: number;
  manualReviewAt: number;
}

export const DEFAULT_STRIKE_POLICY: StrikePolicy = {
  warnAt: 1,
  cooldownAt: 2,
  cooldownMs: 6 * 60 * 60 * 1000,
  manualReviewAt: 3,
};

const WARNING_COPY = {
  first:
    'JAN-SEVA notice: your recent complaint was found invalid after review. Please submit only genuine civic issues.',
  repeat:
    'JAN-SEVA notice: a further complaint was found invalid after review. Repeated invalid reports may delay your future complaints while they are checked.',
  manual:
    'JAN-SEVA notice: because several of your complaints were found invalid, future reports will be checked by staff before being assigned. You can still report civic issues.',
};

// ------------------------------------------------------------
// Case store
// ------------------------------------------------------------

function readCases(): ModerationCase[] {
  const stored = readJSON<ModerationCase[] | null>(CASES_KEY, null);
  return Array.isArray(stored) ? stored : [];
}

function writeCases(cases: ModerationCase[]): void {
  writeJSON(CASES_KEY, cases);
}

export function subscribeToModeration(onChange: () => void): () => void {
  return subscribeToKey(CASES_KEY, onChange);
}

export function getModerationCases(): ModerationCase[] {
  return readCases();
}

export function getModerationCase(complaintId: string): ModerationCase | null {
  return readCases().find((c) => c.complaintId === complaintId) ?? null;
}

/**
 * Opens a case for a flagged submission.
 *
 * Idempotent by complaint: re-screening a complaint must not produce a
 * second case, and must not reset a review deadline that is already
 * running. A duplicate case would also double-count in the SLA figures.
 */
export function openCase(input: {
  complaintId: string;
  risk: RiskAssessment;
  aiAssessment: ImageIntelligenceResult;
  now?: number;
}): ModerationCase {
  const cases = readCases();
  const existing = cases.find((c) => c.complaintId === input.complaintId);
  if (existing) return existing;

  const now = input.now ?? Date.now();
  const moderationCase: ModerationCase = {
    complaintId: input.complaintId,
    state: 'PENDING_REVIEW',
    risk: input.risk,
    aiAssessment: input.aiAssessment,
    createdAt: new Date(now).toISOString(),
    reviewDueAt: new Date(now + MODERATION_SLA_MS).toISOString(),
  };

  writeCases([...cases, moderationCase]);

  recordAuditEvent({
    actor: SYSTEM_ACTOR,
    action: 'screening_case_opened',
    targetType: 'complaint',
    targetId: input.complaintId,
    description: `Flagged for review at ${input.risk.level} risk (score ${input.risk.score}).`,
    metadata: {
      riskLevel: input.risk.level,
      riskScore: String(input.risk.score),
      signals: input.risk.signals.map((s) => s.code).join(',') || 'none',
    },
  });

  return moderationCase;
}

/** A moderator picking up a case. Recorded so two are not duplicating work. */
export function openForReview(moderator: AuditActor, complaintId: string, now = Date.now()): void {
  const moderatorId = moderator.id;
  const cases = readCases();
  const next = cases.map((c) =>
    c.complaintId === complaintId && c.state === 'PENDING_REVIEW'
      ? {
          ...c,
          state: 'UNDER_REVIEW' as ModerationState,
          openedBy: moderatorId,
          openedAt: new Date(now).toISOString(),
        }
      : c
  );
  writeCases(next);

  recordAuditEvent({
    actor: moderator,
    action: 'screening_case_claimed',
    targetType: 'complaint',
    targetId: complaintId,
    description: `${moderator.name} started reviewing this flagged submission.`,
  });
}

export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationError';
  }
}

export interface DecisionResult {
  moderationCase: ModerationCase;
  /** What the strike policy says should happen. Not yet done. */
  abuseAction: AbuseAction;
  profile: CitizenAbuseProfile | null;
}

/**
 * Records a human decision.
 *
 * The AI assessment on the case is NOT touched (spec §18). A moderator
 * marking a HIGH-risk submission VALID is the system working — it is the
 * feedback that makes model precision measurable — and overwriting the
 * assessment would erase exactly the disagreement worth measuring.
 *
 * `identityReference` is optional because a complaint filed without
 * verification has no citizen to attribute a strike to. That is a real
 * and intentional gap: reporting must not require Aadhaar or a verified
 * mobile (spec §51 of the previous phase), so an unverified spam report
 * is moderated and produces no strike.
 */
export function recordDecision(input: {
  complaintId: string;
  outcome: ModerationOutcome;
  reason: string;
  moderator: AuditActor;
  identityReference?: string;
  policy?: StrikePolicy;
  now?: number;
}): DecisionResult {
  const reason = input.reason.trim();
  if (!reason) {
    // Not a UI nicety. A decision with no stated reason cannot be
    // reviewed, appealed or learned from.
    throw new ModerationError('A reason is required for every moderation decision.');
  }
  if (!input.moderator?.id) {
    throw new ModerationError('A moderator identity is required.');
  }

  const now = input.now ?? Date.now();
  const cases = readCases();
  const target = cases.find((c) => c.complaintId === input.complaintId);
  if (!target) throw new ModerationError('No moderation case for that complaint.');

  if (target.decision) {
    throw new ModerationError('That case has already been decided.');
  }

  const decision: ModerationDecision = {
    outcome: input.outcome,
    reason,
    moderatorId: input.moderator.id,
    moderatedAt: new Date(now).toISOString(),
  };

  const decided: ModerationCase = { ...target, state: input.outcome, decision };
  writeCases(cases.map((c) => (c.complaintId === input.complaintId ? decided : c)));

  recordAuditEvent({
    actor: input.moderator,
    action: 'moderation_decision',
    targetType: 'complaint',
    targetId: input.complaintId,
    description: `Reviewed and marked ${input.outcome.toLowerCase().replace(/_/g, ' ')}. Reason: ${reason}`,
    metadata: {
      outcome: input.outcome,
      // Recorded so AI-vs-human agreement can be measured later
      // (spec §37, §38) without re-deriving it from two stores.
      aiRiskLevel: target.risk.level,
      agreedWithAi: String(
        (ABUSE_OUTCOMES as readonly string[]).includes(input.outcome) ===
          (target.risk.level === 'HIGH' || target.risk.level === 'CRITICAL')
      ),
    },
  });

  const isAbuse = (ABUSE_OUTCOMES as readonly string[]).includes(input.outcome);
  if (!isAbuse || !input.identityReference) {
    return { moderationCase: decided, abuseAction: { kind: 'NONE' }, profile: null };
  }

  const profile = applyStrike(input.identityReference, input.outcome, now);
  const abuseAction = decideAbuseAction(profile, input.policy ?? DEFAULT_STRIKE_POLICY, now);

  return { moderationCase: decided, abuseAction, profile };
}

// ------------------------------------------------------------
// Abuse profiles (spec §21)
// ------------------------------------------------------------

function readProfiles(): CitizenAbuseProfile[] {
  const stored = readJSON<CitizenAbuseProfile[] | null>(PROFILES_KEY, null);
  return Array.isArray(stored) ? stored : [];
}

function writeProfiles(profiles: CitizenAbuseProfile[]): void {
  writeJSON(PROFILES_KEY, profiles);
}

export function getAbuseProfile(identityReference: string): CitizenAbuseProfile | null {
  return readProfiles().find((p) => p.identityReference === identityReference) ?? null;
}

function emptyProfile(identityReference: string): CitizenAbuseProfile {
  return {
    identityReference,
    confirmedInvalidCount: 0,
    confirmedSpamCount: 0,
    warningCount: 0,
    restrictionCount: 0,
    requiresManualReview: false,
  };
}

function applyStrike(
  identityReference: string,
  outcome: ModerationOutcome,
  now: number
): CitizenAbuseProfile {
  const profiles = readProfiles();
  const current = profiles.find((p) => p.identityReference === identityReference)
    ?? emptyProfile(identityReference);

  const next: CitizenAbuseProfile = {
    ...current,
    confirmedInvalidCount:
      current.confirmedInvalidCount + (outcome === 'INVALID' ? 1 : 0),
    confirmedSpamCount: current.confirmedSpamCount + (outcome === 'SPAM' ? 1 : 0),
    lastConfirmedAbuseAt: new Date(now).toISOString(),
  };

  writeProfiles([
    ...profiles.filter((p) => p.identityReference !== identityReference),
    next,
  ]);

  return next;
}

export function totalStrikes(profile: CitizenAbuseProfile): number {
  return profile.confirmedInvalidCount + profile.confirmedSpamCount;
}

/**
 * What the policy says should happen at this strike count.
 *
 * Pure: it decides nothing and writes nothing. `applyAbuseAction` is
 * what acts, and only when the feature flag permits — so the escalation
 * ladder can be reasoned about and tested with the flag off.
 */
export function decideAbuseAction(
  profile: CitizenAbuseProfile,
  policy: StrikePolicy = DEFAULT_STRIKE_POLICY,
  _now: number = Date.now()
): AbuseAction {
  const strikes = totalStrikes(profile);

  if (strikes >= policy.manualReviewAt) {
    return { kind: 'MANUAL_REVIEW_REQUIRED', message: WARNING_COPY.manual };
  }
  if (strikes >= policy.cooldownAt) {
    return {
      kind: 'WARNING_AND_COOLDOWN',
      message: WARNING_COPY.repeat,
      cooldownMs: policy.cooldownMs,
    };
  }
  if (strikes >= policy.warnAt) {
    return { kind: 'WARNING', message: WARNING_COPY.first };
  }
  return { kind: 'NONE' };
}

/**
 * Applies a decided action to the profile.
 *
 * `restrictionsEnabled` is REPEAT_ABUSE_RESTRICTION_ENABLED, passed in
 * rather than imported so the caller has to be explicit and the tests
 * can exercise both. With it off, the warning is still counted — the
 * record of what happened is not the punitive part — but no cooldown and
 * no manual-review requirement is applied.
 */
export function applyAbuseAction(
  identityReference: string,
  action: AbuseAction,
  options: { restrictionsEnabled: boolean; now?: number }
): CitizenAbuseProfile | null {
  if (action.kind === 'NONE') return getAbuseProfile(identityReference);

  const now = options.now ?? Date.now();
  const profiles = readProfiles();
  const current = profiles.find((p) => p.identityReference === identityReference);
  if (!current) return null;

  let next: CitizenAbuseProfile = { ...current, warningCount: current.warningCount + 1 };

  if (options.restrictionsEnabled) {
    if (action.kind === 'WARNING_AND_COOLDOWN') {
      next = {
        ...next,
        restrictionCount: next.restrictionCount + 1,
        cooldownUntil: new Date(now + action.cooldownMs).toISOString(),
      };
    } else if (action.kind === 'MANUAL_REVIEW_REQUIRED') {
      next = { ...next, restrictionCount: next.restrictionCount + 1, requiresManualReview: true };
    }
  }

  writeProfiles([
    ...profiles.filter((p) => p.identityReference !== identityReference),
    next,
  ]);

  recordAuditEvent({
    actor: SYSTEM_ACTOR,
    action: options.restrictionsEnabled
      ? 'abuse_restriction_applied'
      : 'citizen_warning_recorded',
    targetType: 'citizen',
    targetId: identityReference,
    description: options.restrictionsEnabled
      ? `Restriction applied after ${totalStrikes(next)} confirmed incident(s).`
      : `Warning recorded after ${totalStrikes(next)} confirmed incident(s). Restrictions are disabled, so no cooldown was applied.`,
    metadata: { action: action.kind, strikes: String(totalStrikes(next)) },
  });

  return next;
}

/** An admin lifting a restriction early (spec §23). Always audited. */
export function clearRestriction(identityReference: string, admin: AuditActor, reason: string): void {
  const profiles = readProfiles();
  const current = profiles.find((p) => p.identityReference === identityReference);
  if (!current) return;

  writeProfiles([
    ...profiles.filter((p) => p.identityReference !== identityReference),
    { ...current, cooldownUntil: undefined, requiresManualReview: false },
  ]);

  recordAuditEvent({
    actor: admin,
    action: 'abuse_restriction_cleared',
    targetType: 'citizen',
    targetId: identityReference,
    description: `Restriction lifted by ${admin.name}. Reason: ${reason}`,
  });
}

/**
 * Whether this citizen is inside a cooldown.
 *
 * Read at submission time. Note it returns the remaining time rather
 * than a bare boolean: a citizen told "try again later" with no idea how
 * much later will simply keep trying.
 */
export function cooldownRemainingMs(
  identityReference: string | undefined,
  now: number = Date.now()
): number {
  if (!identityReference) return 0;
  const profile = getAbuseProfile(identityReference);
  if (!profile?.cooldownUntil) return 0;
  return Math.max(0, new Date(profile.cooldownUntil).getTime() - now);
}

// ------------------------------------------------------------
// Queue views (spec §16, §24)
// ------------------------------------------------------------

export type ModerationFilter = 'all' | 'due-soon' | 'overdue' | 'high-risk' | 'unreviewed';

export function isOverdue(moderationCase: ModerationCase, now: number = Date.now()): boolean {
  return !moderationCase.decision && new Date(moderationCase.reviewDueAt).getTime() <= now;
}

export function msUntilDue(moderationCase: ModerationCase, now: number = Date.now()): number {
  return new Date(moderationCase.reviewDueAt).getTime() - now;
}

/**
 * The queue, ordered the way a moderator works it (spec §24):
 * overdue first, then by deadline, then by risk. Decided cases sink.
 */
export function getModerationQueue(
  filter: ModerationFilter = 'all',
  now: number = Date.now()
): ModerationCase[] {
  const riskRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const fourHours = 4 * 60 * 60 * 1000;

  return readCases()
    .filter((c) => {
      switch (filter) {
        case 'due-soon':
          return !c.decision && msUntilDue(c, now) > 0 && msUntilDue(c, now) <= fourHours;
        case 'overdue':
          return isOverdue(c, now);
        case 'high-risk':
          return !c.decision && (c.risk.level === 'HIGH' || c.risk.level === 'CRITICAL');
        case 'unreviewed':
          return !c.decision;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      if (Boolean(a.decision) !== Boolean(b.decision)) return a.decision ? 1 : -1;

      const aOver = isOverdue(a, now);
      const bOver = isOverdue(b, now);
      if (aOver !== bOver) return aOver ? -1 : 1;

      const byRisk = riskRank[a.risk.level] - riskRank[b.risk.level];
      if (byRisk !== 0) return byRisk;

      return new Date(a.reviewDueAt).getTime() - new Date(b.reviewDueAt).getTime();
    });
}

// ------------------------------------------------------------
// Analytics (spec §37, §38)
// ------------------------------------------------------------

export interface ModerationStats {
  total: number;
  pending: number;
  overdue: number;
  validated: number;
  invalid: number;
  spam: number;
  duplicate: number;
  /** Decided cases the AI flagged HIGH/CRITICAL that a human upheld. */
  aiFlaggedConfirmed: number;
  /** Decided cases the AI flagged that a human overturned to VALID. */
  aiFlaggedOverturned: number;
  /**
   * Of the cases AI flagged and a human decided, the share upheld.
   * Null when nothing has been decided — an unmeasured precision must
   * read as unmeasured, not as 0% or 100% (spec §34).
   */
  aiPrecision: number | null;
  slaCompliance: number | null;
  medianReviewMinutes: number | null;
}

export function getModerationStats(now: number = Date.now()): ModerationStats {
  const cases = readCases();
  const decided = cases.filter((c) => c.decision);

  const flaggedAndDecided = decided.filter(
    (c) => c.risk.level === 'HIGH' || c.risk.level === 'CRITICAL'
  );
  const upheld = flaggedAndDecided.filter((c) =>
    (ABUSE_OUTCOMES as readonly string[]).includes(c.decision!.outcome)
  );
  const overturned = flaggedAndDecided.filter((c) => c.decision!.outcome === 'VALIDATED');

  const withinSla = decided.filter(
    (c) => new Date(c.decision!.moderatedAt).getTime() <= new Date(c.reviewDueAt).getTime()
  );

  const reviewMinutes = decided
    .map(
      (c) =>
        (new Date(c.decision!.moderatedAt).getTime() - new Date(c.createdAt).getTime()) / 60000
    )
    .sort((a, b) => a - b);

  return {
    total: cases.length,
    pending: cases.filter((c) => !c.decision).length,
    overdue: cases.filter((c) => isOverdue(c, now)).length,
    validated: decided.filter((c) => c.decision!.outcome === 'VALIDATED').length,
    invalid: decided.filter((c) => c.decision!.outcome === 'INVALID').length,
    spam: decided.filter((c) => c.decision!.outcome === 'SPAM').length,
    duplicate: decided.filter((c) => c.decision!.outcome === 'DUPLICATE').length,
    aiFlaggedConfirmed: upheld.length,
    aiFlaggedOverturned: overturned.length,
    aiPrecision:
      flaggedAndDecided.length === 0 ? null : upheld.length / flaggedAndDecided.length,
    slaCompliance: decided.length === 0 ? null : withinSla.length / decided.length,
    medianReviewMinutes:
      reviewMinutes.length === 0
        ? null
        : Math.round(reviewMinutes[Math.floor(reviewMinutes.length / 2)]!),
  };
}

/** Self-test support. Never called from the app. */
export function resetModerationStoreForTest(): void {
  writeCases([]);
  writeProfiles([]);
}
