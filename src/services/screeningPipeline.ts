// ============================================================
// Screening Pipeline (spec §4, §11, §43)
// ============================================================
//
// One call the wizard makes, in one place, at one moment: after the
// citizen presses submit and before a complaint record exists.
//
// It exists so the wizard hook stays a state machine rather than
// becoming a fraud engine. The hook asks "may this be filed?", gets an
// answer, and either continues its existing path or shows a message —
// which is what keeps the frozen citizen flow (spec §1, §44) actually
// frozen. No new step, no new field, no new screen.
//
//   Fails OPEN, everywhere.
//   Every catch in this file resolves to "allow". A screening pipeline
//   that throws would convert a bad minute at a model provider into a
//   citizen who cannot report a burst water main.

import type { ReportDraft } from '../types/report';
import type { ImageIntelligenceResult, RiskAssessment, SubmissionDecision } from '../types/screening';
import {
  PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED,
  POST_SUBMIT_RISK_SCORING_ENABLED,
} from '../config/featureFlags';
import { analyzeCitizenSubmission, type IntelligenceProvider } from './imageIntelligenceService';
import {
  assessRisk,
  decideSubmission,
  NO_DETERMINISTIC_SIGNALS,
  type DeterministicSignals,
} from './citizenReportRiskService';
import { perceptualHash, findReuse, hammingDistance, getEvidenceHashIndex } from './proofService';
import { getStoredComplaints } from './complaintService';
import { openCase } from './moderationService';
import { getLocale } from './i18nService';
import { deriveIdentityReference } from './identityService';

export interface ScreeningOutcome {
  decision: SubmissionDecision;
  risk: RiskAssessment;
  ai: ImageIntelligenceResult;
  /** Ready to render, already in the citizen's chosen language. */
  citizenMessage?: string;
}

/**
 * Perceptual distance below which two images are "near-identical".
 *
 * dHash Hamming distance of 8 out of 64 bits. Tighter than the usual
 * 10-12 threshold on purpose: this signal contributes risk to a real
 * citizen's report, and a false near-match on two photographs of the
 * same stretch of road — which genuinely do look alike — is a cost paid
 * by an honest reporter.
 */
const NEAR_DUPLICATE_DISTANCE = 8;

/** Submissions from one identity within this window feed the frequency signal. */
const FREQUENCY_WINDOW_MS = 60 * 60 * 1000;

/**
 * The signals we can establish ourselves, without asking a model
 * anything. These are facts about our own records, and they keep working
 * when the provider is down (spec §33).
 */
async function gatherDeterministicSignals(
  draft: ReportDraft,
  now: number
): Promise<DeterministicSignals> {
  const signals: DeterministicSignals = { ...NO_DETERMINISTIC_SIGNALS };

  const primaryPhoto = draft.photos[0]?.url;
  if (primaryPhoto) {
    try {
      const hash = await perceptualHash(primaryPhoto);

      // Exact: this hash is already recorded against another complaint.
      signals.exactImageReuse = findReuse(hash) !== null;

      if (!signals.exactImageReuse) {
        signals.nearImageReuse = getEvidenceHashIndex().some(
          (record) => hammingDistance(record.hash, hash) <= NEAR_DUPLICATE_DISTANCE
        );
      }
    } catch {
      // Hashing failed (no canvas, a corrupt data URL). Absence of a
      // signal is not a signal — the defaults stay false.
    }
  }

  // Derived the same way `buildReporter` will derive it at submit time,
  // from the in-memory raw value. The draft carries no reference of its
  // own — the raw identifier is deliberately never persisted — so this
  // is the only point at which the two can be matched up.
  const identityReference = draft.identityVerified
    ? deriveIdentityReference(
        draft.identityMethod,
        draft.identityMethod === 'aadhaar' ? draft.aadhaarNumber : draft.mobileNumber
      )
    : '';

  if (identityReference) {
    try {
      const complaints = getStoredComplaints();
      const recent = complaints.filter(
        (c) =>
          c.reporter?.identityReference === identityReference &&
          now - new Date(c.createdAt).getTime() < FREQUENCY_WINDOW_MS
      );
      // This submission is not stored yet, so it is counted here.
      signals.recentSubmissionCount = recent.length + 1;
    } catch {
      // Leave the default of 1.
    }
  }

  // GPS consistency is left GPS_UNAVAILABLE. EXIF is stripped by every
  // messaging app and by the compression pipeline this project already
  // runs, so claiming to compare it would be claiming a check we do not
  // perform (spec §12). The field is here for when capture-time
  // coordinates are bound server-side, as resolution evidence already is.

  return signals;
}

export interface ScreenOptions {
  /** Injected by the self-test. Production uses the server provider. */
  provider?: IntelligenceProvider;
  now?: number;
}

/**
 * Screens a draft. Never throws.
 *
 * Note what this does NOT do: it does not create a complaint, and it
 * does not open a moderation case. It reports. `recordFlaggedSubmission`
 * is called afterwards, once the complaint has an ID to attach a case
 * to — a case pointing at a complaint that failed to save would sit in
 * the queue forever with nothing to review.
 */
export async function screenSubmission(
  draft: ReportDraft,
  options: ScreenOptions = {}
): Promise<ScreeningOutcome> {
  const now = options.now ?? Date.now();

  let ai: ImageIntelligenceResult = {
    available: false,
    reason: 'DISABLED',
    analyzedAt: new Date(now).toISOString(),
  };

  const primaryPhoto = draft.photos[0]?.url;
  if (primaryPhoto) {
    ai = await analyzeCitizenSubmission(
      {
        imageDataUrl: primaryPhoto,
        description: draft.description ?? '',
        // Locality name only. The model does not need the coordinates,
        // and a third party does not need a resident's doorstep.
        localityHint: draft.location?.locality,
      },
      options.provider
    );
  }

  const deterministic = POST_SUBMIT_RISK_SCORING_ENABLED
    ? await gatherDeterministicSignals(draft, now)
    : NO_DETERMINISTIC_SIGNALS;

  const risk = assessRisk({ ai, deterministic, now });

  const decision = decideSubmission(risk, ai, {
    blockingEnabled: PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED,
    now,
  });

  return {
    decision,
    risk,
    ai,
    citizenMessage:
      decision.action === 'BLOCK'
        ? getLocale() === 'hi'
          ? decision.citizenMessageHindi
          : decision.citizenMessage
        : undefined,
  };
}

/**
 * Opens a moderation case for a complaint that was allowed but flagged.
 *
 * Called after the complaint is safely stored. A failure here must not
 * unwind the complaint: the citizen's report is the thing that matters,
 * and losing a moderation case costs a review, not a record.
 */
export function recordFlaggedSubmission(
  complaintId: string,
  outcome: ScreeningOutcome,
  now: number = Date.now()
): void {
  if (outcome.decision.action !== 'ALLOW_AND_FLAG') return;

  try {
    openCase({
      complaintId,
      risk: outcome.risk,
      aiAssessment: outcome.ai,
      now,
    });
  } catch (err) {
    console.error('Could not open moderation case', {
      complaintId,
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
