// ============================================================
// POST /api/ai/screen  (spec §2, §31, §32, §46)
// ============================================================
// The browser sends an image and a description. It gets back
// MEASUREMENTS — never a decision, never a risk score, never a
// moderation state.
//
//   WHY THE DECISION IS NOT MADE HERE.
//   The risk engine and the decision matrix run in the app layer where
//   they are pure and testable, and — for anything that matters — are
//   re-evaluated server-side at the point of persistence. If this
//   endpoint returned "BLOCK", a client that ignored it would submit
//   anyway, and a client that forged it could block someone else's
//   session. It returns observations; authority lives elsewhere.
//
// The API key never leaves this function. It is read from the
// environment, used in a header, and is not present in any response
// (spec §31).

import { apiError, apiOk, readJsonBody, withErrorHandling } from '../_lib/errors.ts';
import { clientAddress, consume } from '../_lib/rateLimit.ts';
import { analyzeWithGemini, billingTierAcknowledged } from '../_lib/gemini.ts';
import {
  SUSPICIOUS_SIGNALS,
  type ImageIntelligenceResult,
  type SuspiciousSignal,
} from '../../src/types/screening.ts';

const LIKELIHOODS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
const RELEVANCES = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const;
const CONSISTENCIES = ['CONSISTENT', 'PARTIAL', 'INCONSISTENT', 'UNKNOWN'] as const;
const QUALITIES = ['USABLE', 'LOW_QUALITY', 'UNUSABLE'] as const;
const CATEGORIES = ['roads', 'sanitation', 'water', 'electrical', 'infrastructure'];

/** ~1.3 MB of base64, i.e. comfortably above the client's ~900 kB ceiling. */
const MAX_BASE64_LENGTH = 1_800_000;

function unavailable(
  reason: Extract<ImageIntelligenceResult, { available: false }>['reason']
): ImageIntelligenceResult {
  return { available: false, reason, analyzedAt: new Date().toISOString() };
}

// ------------------------------------------------------------
// Normalisation — the trust boundary for model output
// ------------------------------------------------------------
//
// Structured output constrains the model, but "constrained" is not
// "guaranteed": schema adherence is enforced by the provider, and this
// code does not get to assume the provider is correct, un-updated, or
// even the service it thinks it is talking to. Every field is checked
// against its own allow-list here, and anything unrecognised becomes the
// SAFE value — the one that adds no risk — rather than being dropped
// into the risk engine as an unknown string.
//
// Safe defaults matter more than they look. A garbled response that
// defaulted to VERY_LOW relevance and HIGH portrait likelihood would
// block real citizens; defaulting the other way merely means a
// submission goes unscreened.

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeSignals(value: unknown): SuspiciousSignal[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(SUSPICIOUS_SIGNALS);
  return value
    .filter((item): item is SuspiciousSignal => typeof item === 'string' && allowed.has(item))
    .slice(0, SUSPICIOUS_SIGNALS.length);
}

function normalizeCategory(value: unknown): string | null {
  return typeof value === 'string' && CATEGORIES.includes(value) ? value : null;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return apiError('VALIDATION_ERROR', 'Unsupported request.');
  }

  const body = await readJsonBody(request);
  const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  const description = typeof body?.description === 'string' ? body.description : '';
  const localityHint = typeof body?.localityHint === 'string' ? body.localityHint : undefined;

  if (!imageBase64 || !mimeType) {
    return apiError('VALIDATION_ERROR', 'An image is required.');
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return apiError('VALIDATION_ERROR', 'That image is too large to screen.');
  }

  // Screening is a paid model call on every submission, so it is rate
  // limited like any other. Unauthenticated by design — this runs before
  // a complaint exists and before the citizen has verified — which makes
  // the address the only subject available.
  const limited = await consume('complaint:create:ip', clientAddress(request));
  if (!limited.allowed) {
    // Not an error the citizen should see as a refusal: screening is
    // optional, so a rate-limited caller is told the check is
    // unavailable and their submission continues unscreened.
    return apiOk(unavailable('RATE_LIMITED'));
  }

  if (!billingTierAcknowledged() && process.env.GEMINI_API_KEY) {
    // Configured but not cleared for citizen data. Surfaced distinctly
    // in the log because it is a deployment mistake with a privacy
    // consequence, not a transient failure.
    console.error('[ai/screen] GEMINI_API_KEY set without GEMINI_BILLING_TIER=paid');
  }

  const result = await analyzeWithGemini({ imageBase64, mimeType, description, localityHint });

  if (!result.ok) {
    // `UNPAID_TIER_REFUSED` is deliberately reported to the client as
    // NOT_CONFIGURED. The distinction is an operator's problem and is in
    // the log; telling a browser about our billing posture serves nobody.
    const reason = result.reason === 'UNPAID_TIER_REFUSED' ? 'NOT_CONFIGURED' : result.reason;
    return apiOk(unavailable(reason));
  }

  const raw = result.assessment;

  const assessment: ImageIntelligenceResult = {
    available: true,
    civicRelevance: oneOf(raw.civicRelevance, RELEVANCES, 'MEDIUM'),
    issueCategory: normalizeCategory(raw.issueCategory),
    issueConfidence: oneOf(raw.issueConfidence, LIKELIHOODS, 'NONE'),
    facePresence: raw.facePresence === true,
    faceDominance: oneOf(raw.faceDominance, LIKELIHOODS, 'NONE'),
    portraitLikelihood: oneOf(raw.portraitLikelihood, LIKELIHOODS, 'NONE'),
    screenshotLikelihood: oneOf(raw.screenshotLikelihood, LIKELIHOODS, 'NONE'),
    imageDescriptionConsistency: oneOf(raw.imageDescriptionConsistency, CONSISTENCIES, 'UNKNOWN'),
    imageQuality: oneOf(raw.imageQuality, QUALITIES, 'USABLE'),
    suspiciousSignals: normalizeSignals(raw.suspiciousSignals),
    // A malformed confidence becomes NONE, which the decision matrix
    // treats as "never block". Failing toward the citizen.
    aiConfidence: oneOf(raw.aiConfidence, LIKELIHOODS, 'NONE'),
    modelProvider: 'google-gemini',
    modelVersion: result.model,
    analyzedAt: new Date().toISOString(),
  };

  return apiOk(assessment);
}

export default withErrorHandling(handler);
