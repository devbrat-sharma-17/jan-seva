// ============================================================
// Screening & moderation suite (spec §27, §28, §45, §46)
// ============================================================
// Appended to the main self-test so `npm run selftest` covers it.
//
// The §28 cases are the acceptance criteria, but the §27 false-positive
// cases are the ones that matter more. Blocking a genuine complaint is
// a worse failure than letting a fake one through: the fake costs a
// moderator five minutes, and the false positive costs a resident their
// only route to getting a burst pipe fixed — and they will not come
// back to try again.
//
// So the fairness rules are asserted directly, not inferred from
// end-to-end behaviour. `facePresence` having zero weight is a test, not
// a comment.

import { check, checkEqual, section } from './harness';
import type {
  ImageIntelligenceResult,
  Likelihood,
  CivicRelevance,
  ConsistencyStatus,
  ImageQuality,
} from '../types/screening';

/** A confident, unremarkable assessment. Cases override only what they test. */
function assessment(
  overrides: Partial<Extract<ImageIntelligenceResult, { available: true }>> = {}
): ImageIntelligenceResult {
  return {
    available: true,
    civicRelevance: 'HIGH' as CivicRelevance,
    issueCategory: 'roads',
    issueConfidence: 'HIGH' as Likelihood,
    facePresence: false,
    faceDominance: 'NONE' as Likelihood,
    portraitLikelihood: 'NONE' as Likelihood,
    screenshotLikelihood: 'NONE' as Likelihood,
    imageDescriptionConsistency: 'CONSISTENT' as ConsistencyStatus,
    imageQuality: 'USABLE' as ImageQuality,
    suspiciousSignals: [],
    aiConfidence: 'HIGH' as Likelihood,
    modelProvider: 'test',
    modelVersion: 'fixture-1',
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

export async function runScreeningSuite(): Promise<void> {
  const risk = await import('../services/citizenReportRiskService');
  const moderation = await import('../services/moderationService');
  const intelligence = await import('../services/imageIntelligenceService');

  const {
    assessRisk,
    decideSubmission,
    NO_DETERMINISTIC_SIGNALS,
    describeAssessment,
  } = risk;

  const score = (
    ai: ImageIntelligenceResult,
    deterministic = NO_DETERMINISTIC_SIGNALS
  ) => assessRisk({ ai, deterministic });

  const gate = (
    ai: ImageIntelligenceResult,
    deterministic = NO_DETERMINISTIC_SIGNALS,
    blockingEnabled = true
  ) => decideSubmission(score(ai, deterministic), ai, { blockingEnabled });

  // ==========================================================
  section('19. Civic screening — the required cases');
  // ==========================================================

  // CASE 1 — pothole photo, matching Hindi description.
  checkEqual('CASE 1: a genuine pothole report is allowed', gate(assessment()).action, 'ALLOW');

  // CASE 2 — selfie with an unrelated road description.
  const selfie = assessment({
    civicRelevance: 'VERY_LOW',
    issueCategory: null,
    facePresence: true,
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
    imageDescriptionConsistency: 'INCONSISTENT',
    suspiciousSignals: ['PORTRAIT_OR_SELFIE'],
  });
  checkEqual('CASE 2: a selfie is blocked before a complaint exists', gate(selfie).action, 'BLOCK');

  // CASE 3 — THE ONE THAT MATTERS. A real pothole with a bystander.
  const potholeWithPerson = assessment({
    civicRelevance: 'HIGH',
    facePresence: true,
    faceDominance: 'MEDIUM',
    portraitLikelihood: 'LOW',
  });
  checkEqual(
    'CASE 3: a pothole with a person in frame is NOT blocked',
    gate(potholeWithPerson).action,
    'ALLOW'
  );

  // CASE 4 — unrelated personal photo, confidently assessed.
  const personalPhoto = assessment({
    civicRelevance: 'VERY_LOW',
    issueCategory: null,
    facePresence: true,
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
    suspiciousSignals: ['INDOOR_PERSONAL_SCENE'],
  });
  checkEqual('CASE 4: a non-civic personal photo is blocked', gate(personalPhoto).action, 'BLOCK');

  // CASE 5 — a real issue, badly photographed.
  const poorQuality = assessment({
    civicRelevance: 'MEDIUM',
    imageQuality: 'LOW_QUALITY',
    aiConfidence: 'MEDIUM',
  });
  const poorQualityDecision = gate(poorQuality);
  check('CASE 5: a low-quality civic photo is not blocked', poorQualityDecision.action !== 'BLOCK');
  checkEqual('CASE 5: and is not treated as risky', score(poorQuality).level, 'LOW');

  // CASE 6 — the same image submitted before.
  const reuse = score(assessment(), {
    ...NO_DETERMINISTIC_SIGNALS,
    exactImageReuse: true,
  });
  check('CASE 6: exact image reuse raises risk', reuse.score > 0);
  checkEqual(
    'CASE 6: and flags for review rather than blocking',
    gate(assessment(), { ...NO_DETERMINISTIC_SIGNALS, exactImageReuse: true }).action,
    'ALLOW_AND_FLAG'
  );

  // CASE 7 — recompressed near-duplicate.
  const nearReuse = score(assessment(), {
    ...NO_DETERMINISTIC_SIGNALS,
    nearImageReuse: true,
  });
  check(
    'CASE 7: a near-duplicate is recorded as a signal',
    nearReuse.signals.some((s) => s.code === 'NEAR_IMAGE_REUSE')
  );
  check('CASE 7: and does not on its own block', gate(assessment(), {
    ...NO_DETERMINISTIC_SIGNALS,
    nearImageReuse: true,
  }).action !== 'BLOCK');

  // CASE 8 — "streetlight not working" attached to a selfie.
  const mismatch = assessment({
    civicRelevance: 'VERY_LOW',
    facePresence: true,
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
    imageDescriptionConsistency: 'INCONSISTENT',
  });
  check('CASE 8: description mismatch is scored', score(mismatch).score >= 45);
  checkEqual('CASE 8: and reaches at least HIGH risk', score(mismatch).level === 'LOW', false);

  // CASE 9 — the model is unsure. This is the false-positive guard.
  const unsure = assessment({
    civicRelevance: 'VERY_LOW',
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
    aiConfidence: 'LOW',
  });
  check('CASE 9: a low-confidence assessment never blocks', gate(unsure).action !== 'BLOCK');

  const mediumConfidence = assessment({
    civicRelevance: 'VERY_LOW',
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
    aiConfidence: 'MEDIUM',
  });
  check(
    'CASE 9: medium confidence is also not enough to block',
    gate(mediumConfidence).action !== 'BLOCK'
  );

  // ==========================================================
  section('20. Face fairness (spec §5, §27)');
  // ==========================================================

  // The rule the whole feature lives or dies on.
  const faceOnly = assessment({ facePresence: true });
  checkEqual('A face alone adds no risk at all', score(faceOnly).score, 0);
  check(
    'A face alone raises no signal',
    score(faceOnly).signals.every((s) => !s.code.includes('PORTRAIT'))
  );

  const workerAtSite = assessment({
    civicRelevance: 'HIGH',
    facePresence: true,
    faceDominance: 'HIGH',
    portraitLikelihood: 'LOW',
  });
  check(
    'A worker filling the frame at a genuine civic site is not blocked',
    gate(workerAtSite).action !== 'BLOCK'
  );

  const crowdedStreet = assessment({
    civicRelevance: 'MEDIUM',
    facePresence: true,
    faceDominance: 'MEDIUM',
    portraitLikelihood: 'MEDIUM',
    imageQuality: 'LOW_QUALITY',
  });
  checkEqual('A crowded, poorly-lit street scene stays LOW risk', score(crowdedStreet).level, 'LOW');

  // Portrait framing WITHOUT the image being non-civic must not block:
  // a close-up of a resident pointing at a broken pipe is still a report.
  const portraitButCivic = assessment({
    civicRelevance: 'MEDIUM',
    facePresence: true,
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
  });
  check(
    'Portrait framing does not block while civic content is present',
    gate(portraitButCivic).action !== 'BLOCK'
  );

  // ==========================================================
  section('21. Blocking is narrow and deliberate');
  // ==========================================================

  const unusableAndBlank = assessment({
    civicRelevance: 'VERY_LOW',
    imageQuality: 'UNUSABLE',
    faceDominance: 'HIGH',
    portraitLikelihood: 'HIGH',
  });
  check(
    'An unusable image is never blocked — "too dark to tell" is not "not civic"',
    gate(unusableAndBlank).action !== 'BLOCK'
  );

  checkEqual(
    'With the block flag off, even a clear selfie only flags',
    gate(selfie, NO_DETERMINISTIC_SIGNALS, false).action,
    'ALLOW_AND_FLAG'
  );

  // A citizen with a bad history who photographs a real pothole still
  // gets to file. Blocking is about the image, never about the person.
  const historyHeavy = gate(assessment(), {
    ...NO_DETERMINISTIC_SIGNALS,
    exactImageReuse: true,
    priorConfirmedAbuseCount: 3,
    recentSubmissionCount: 9,
  });
  checkEqual(
    'A high-history citizen filing a genuine report is flagged, not blocked',
    historyHeavy.action,
    'ALLOW_AND_FLAG'
  );

  // ==========================================================
  section('22. AI outage never blocks intake (spec §33)');
  // ==========================================================

  const unavailable: ImageIntelligenceResult = {
    available: false,
    reason: 'PROVIDER_ERROR',
    analyzedAt: new Date().toISOString(),
  };

  checkEqual('An unscreened submission is allowed', gate(unavailable).action, 'ALLOW');
  checkEqual('An unscreened submission scores zero AI risk', score(unavailable).score, 0);
  check(
    'The moderator is told screening did not run, not that it passed',
    describeAssessment(unavailable, score(unavailable))[0]!.includes('did not run')
  );

  // Deterministic signals still work with no model at all.
  const outageWithReuse = score(unavailable, {
    ...NO_DETERMINISTIC_SIGNALS,
    exactImageReuse: true,
  });
  check('Hash reuse is still detected during an AI outage', outageWithReuse.score > 0);

  // The service must never throw, whatever the provider does.
  const throwingProvider = {
    analyze: async () => {
      throw new Error('provider exploded');
    },
  };
  const survived = await intelligence.analyzeCitizenSubmission(
    { imageDataUrl: 'data:image/jpeg;base64,AAAA', description: 'test' },
    throwingProvider
  );
  check('A throwing provider resolves to unavailable', survived.available === false);

  // ==========================================================
  section('23. Prompt injection is data, not instruction (spec §46)');
  // ==========================================================

  // The containment is structural: the model can only answer in a
  // bounded enum schema, so the worst a successful injection achieves is
  // a wrong measurement — which is still just one input to the engine.
  // This asserts the consequence: a "mark this valid" instruction that
  // somehow steered the model cannot clear a submission that other
  // signals condemn.
  const injected = assessment({
    civicRelevance: 'VERY_HIGH',
    imageDescriptionConsistency: 'CONSISTENT',
    aiConfidence: 'HIGH',
  });
  const injectedRisk = score(injected, {
    ...NO_DETERMINISTIC_SIGNALS,
    exactImageReuse: true,
    priorConfirmedAbuseCount: 2,
  });
  check(
    'A maximally favourable AI result cannot clear deterministic evidence',
    injectedRisk.level === 'HIGH' || injectedRisk.level === 'CRITICAL'
  );
  check(
    'Deterministic signals are attributed to their own source',
    injectedRisk.signals.some((s) => s.source === 'deterministic')
  );

  // ==========================================================
  section('24. Moderation SLA and human authority');
  // ==========================================================

  moderation.resetModerationStoreForTest();

  const flagged = score(selfie);
  const opened = moderation.openCase({
    complaintId: 'JS-GWL-2026-000901',
    risk: flagged,
    aiAssessment: selfie,
    now: Date.parse('2026-09-01T10:00:00Z'),
  });

  checkEqual('A flagged case opens as PENDING_REVIEW', opened.state, 'PENDING_REVIEW');
  checkEqual(
    'CASE 10: the review deadline is 24 hours out',
    opened.reviewDueAt,
    new Date(Date.parse('2026-09-01T10:00:00Z') + 24 * 3600 * 1000).toISOString()
  );

  // Opening the same complaint twice must not restart the clock.
  const reopened = moderation.openCase({
    complaintId: 'JS-GWL-2026-000901',
    risk: flagged,
    aiAssessment: selfie,
    now: Date.parse('2026-09-01T18:00:00Z'),
  });
  checkEqual('Re-screening does not reset the deadline', reopened.reviewDueAt, opened.reviewDueAt);
  checkEqual('Re-screening does not open a second case', moderation.getModerationCases().length, 1);

  check(
    'CASE 10: an unreviewed case becomes overdue after 24 hours',
    moderation.isOverdue(opened, Date.parse('2026-09-02T11:00:00Z'))
  );
  checkEqual(
    'CASE 10: and appears in the overdue queue',
    moderation.getModerationQueue('overdue', Date.parse('2026-09-02T11:00:00Z')).length,
    1
  );

  const moderator = { id: 'admin-001', name: 'City Administrator', role: 'admin' as const };

  // A decision without a reason is refused.
  let reasonEnforced = false;
  try {
    moderation.recordDecision({
      complaintId: 'JS-GWL-2026-000901',
      outcome: 'INVALID',
      reason: '   ',
      moderator,
    });
  } catch {
    reasonEnforced = true;
  }
  check('A moderation decision without a reason is refused', reasonEnforced);

  // CASE 13 — AI says HIGH RISK, human says VALID. The human wins, and
  // the AI assessment survives for measurement.
  const overturn = moderation.recordDecision({
    complaintId: 'JS-GWL-2026-000901',
    outcome: 'VALIDATED',
    reason: 'Reviewed the photo: genuine damaged footpath, resident visible but incidental.',
    moderator,
  });
  checkEqual('CASE 13: the human decision stands', overturn.moderationCase.state, 'VALIDATED');
  check(
    'CASE 13: the AI assessment is preserved, not overwritten',
    overturn.moderationCase.aiAssessment.available &&
      overturn.moderationCase.risk.level !== 'LOW'
  );
  checkEqual('CASE 13: no strike follows a VALIDATED outcome', overturn.abuseAction.kind, 'NONE');

  // A case cannot be decided twice.
  let doubleDecisionRefused = false;
  try {
    moderation.recordDecision({
      complaintId: 'JS-GWL-2026-000901',
      outcome: 'SPAM',
      reason: 'attempt to overwrite',
      moderator,
    });
  } catch {
    doubleDecisionRefused = true;
  }
  check('A decided case cannot be re-decided', doubleDecisionRefused);

  // ==========================================================
  section('25. Strikes follow humans, never the model (spec §21, §22)');
  // ==========================================================

  moderation.resetModerationStoreForTest();

  const citizen = 'idref_test_repeat';
  const openAndDecide = (id: string, outcome: 'INVALID' | 'SPAM') => {
    moderation.openCase({ complaintId: id, risk: flagged, aiAssessment: selfie });
    return moderation.recordDecision({
      complaintId: id,
      outcome,
      reason: 'Reviewed: not a civic issue.',
      moderator,
      identityReference: citizen,
    });
  };

  // CASE 11 — an INVALID decision produces an audit event and a warning.
  const first = openAndDecide('JS-GWL-2026-000902', 'INVALID');
  checkEqual('CASE 11: one confirmed incident warns', first.abuseAction.kind, 'WARNING');
  checkEqual('CASE 11: the strike is recorded', first.profile?.confirmedInvalidCount, 1);

  const audit = await import('../services/auditService');
  const trail = audit.getAuditTrailForComplaint('JS-GWL-2026-000902', { role: 'admin' });
  check(
    'CASE 11: the decision is auditable',
    trail.some((e) => e.action === 'moderation_decision')
  );

  // CASE 12 — repeated confirmed abuse escalates.
  const second = openAndDecide('JS-GWL-2026-000903', 'SPAM');
  checkEqual(
    'CASE 12: two confirmed incidents add a cooldown',
    second.abuseAction.kind,
    'WARNING_AND_COOLDOWN'
  );

  const third = openAndDecide('JS-GWL-2026-000904', 'SPAM');
  checkEqual(
    'CASE 12: three require manual review of future reports',
    third.abuseAction.kind,
    'MANUAL_REVIEW_REQUIRED'
  );

  // Nothing above is a ban, at any count.
  check(
    'No strike count produces a permanent ban',
    !JSON.stringify(third.abuseAction).toLowerCase().includes('ban')
  );

  // With restrictions disabled, the warning is recorded and nothing bites.
  moderation.applyAbuseAction(citizen, third.abuseAction, { restrictionsEnabled: false });
  checkEqual(
    'With the restriction flag off, no cooldown is applied',
    moderation.cooldownRemainingMs(citizen),
    0
  );
  check(
    'With the restriction flag off, no manual-review gate is applied',
    moderation.getAbuseProfile(citizen)?.requiresManualReview === false
  );

  // With it enabled, the cooldown applies and still has an end.
  moderation.applyAbuseAction(citizen, second.abuseAction, {
    restrictionsEnabled: true,
    now: Date.parse('2026-09-01T10:00:00Z'),
  });
  check(
    'With the flag on, a cooldown applies',
    moderation.cooldownRemainingMs(citizen, Date.parse('2026-09-01T11:00:00Z')) > 0
  );
  checkEqual(
    'And it expires — no indefinite restriction',
    moderation.cooldownRemainingMs(citizen, Date.parse('2026-09-02T10:00:00Z')),
    0
  );

  // An admin can lift a restriction, and it is audited.
  moderation.clearRestriction(citizen, moderator, 'Citizen contacted the office; reports were genuine.');
  checkEqual(
    'An admin override clears the cooldown',
    moderation.cooldownRemainingMs(citizen, Date.parse('2026-09-01T11:00:00Z')),
    0
  );

  // An unverified reporter cannot be struck — there is nobody to strike.
  moderation.openCase({ complaintId: 'JS-GWL-2026-000905', risk: flagged, aiAssessment: selfie });
  const anonymous = moderation.recordDecision({
    complaintId: 'JS-GWL-2026-000905',
    outcome: 'SPAM',
    reason: 'Reviewed: not a civic issue.',
    moderator,
  });
  checkEqual('An unverified submission produces no strike', anonymous.abuseAction.kind, 'NONE');

  // ==========================================================
  section('26. Moderation analytics are honest');
  // ==========================================================

  const stats = moderation.getModerationStats();
  check('Decided cases are counted', stats.total > 0);
  check(
    'AI precision is a measured ratio, not an assertion',
    stats.aiPrecision === null || (stats.aiPrecision >= 0 && stats.aiPrecision <= 1)
  );

  moderation.resetModerationStoreForTest();
  const emptyStats = moderation.getModerationStats();
  checkEqual(
    'With nothing decided, AI precision is unmeasured rather than 0% or 100%',
    emptyStats.aiPrecision,
    null
  );
  checkEqual('And SLA compliance is unmeasured too', emptyStats.slaCompliance, null);

  // ==========================================================
  section('27. End to end — draft to department (spec §43)');
  // ==========================================================

  const pipeline = await import('../services/screeningPipeline');
  const complaintService = await import('../services/complaintService');
  const aiService = await import('../services/aiService');
  const flags = await import('../config/featureFlags');

  moderation.resetModerationStoreForTest();
  intelligence.clearAnalysisCache();

  const draftFor = (description: string) => ({
    photos: [{ id: 'p1', url: 'data:image/jpeg;base64,TESTIMAGE', name: 'photo.jpg', timestamp: Date.now() }],
    description,
    identityMethod: 'mobile' as const,
    aadhaarNumber: '',
    mobileNumber: '9876543210',
    otp: '',
    identityVerified: true,
    name: 'Test Citizen',
    location: {
      latitude: 26.2124,
      longitude: 78.1672,
      address: 'Phool Bagh Road, Lashkar',
      locality: 'Lashkar',
      city: 'Gwalior',
      state: 'Madhya Pradesh',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const providerReturning = (result: ImageIntelligenceResult) => ({
    analyze: async () => result,
  });

  // ---- A genuine report reaches a department, unflagged ----------
  const goodDraft = draftFor('Road mein bada pothole hai, Phool Bagh ke paas');
  const goodScreening = await pipeline.screenSubmission(goodDraft, {
    provider: providerReturning(assessment()),
  });
  check('E2E: a genuine report is not blocked', goodScreening.decision.action === 'ALLOW');

  const goodAnalysis = await aiService.analyzeReportMock(goodDraft);
  const goodComplaint = await complaintService.submitReport(goodDraft, goodAnalysis, 'gwalior');
  pipeline.recordFlaggedSubmission(goodComplaint.id, goodScreening);

  check('E2E: the complaint is stored', Boolean(goodComplaint.id));
  // `department.id` is the routing engine's own id, which is not always
  // the DepartmentId a queue is keyed on. `owningDepartmentOf` is the
  // resolver the portals use, so the test asks the same question they do.
  const owningDept = complaintService.owningDepartmentOf(goodComplaint);
  check('E2E: the complaint resolves to an owning department', owningDept !== null);
  check(
    'E2E: it reaches that department queue',
    complaintService
      .getComplaintsByDepartment(owningDept ?? '')
      .some((c) => c.id === goodComplaint.id)
  );
  checkEqual(
    'E2E: and opens no moderation case',
    moderation.getModerationCase(goodComplaint.id),
    null
  );

  // ---- A suspicious report is filed AND flagged -------------------
  intelligence.clearAnalysisCache();
  const suspectDraft = draftFor('Streetlight kharab hai');
  const suspectScreening = await pipeline.screenSubmission(suspectDraft, {
    provider: providerReturning(selfie),
  });

  // With the production default (blocking OFF) this must flag, not block.
  checkEqual(
    'E2E: with blocking off by default, a selfie is flagged rather than blocked',
    flags.PRE_SUBMIT_NON_CIVIC_BLOCK_ENABLED,
    false
  );
  checkEqual(
    'E2E: the suspicious submission is allowed and flagged',
    suspectScreening.decision.action,
    'ALLOW_AND_FLAG'
  );

  const suspectAnalysis = await aiService.analyzeReportMock(suspectDraft);
  const suspectComplaint = await complaintService.submitReport(suspectDraft, suspectAnalysis, 'gwalior');
  pipeline.recordFlaggedSubmission(suspectComplaint.id, suspectScreening);

  const openedCase = moderation.getModerationCase(suspectComplaint.id);
  check('E2E: a moderation case exists for it', openedCase !== null);
  check(
    'E2E: it appears in the admin queue',
    moderation.getModerationQueue('unreviewed').some((c) => c.complaintId === suspectComplaint.id)
  );
  check(
    'E2E: the citizen still received a complaint they can track',
    (await complaintService.getById(suspectComplaint.id)).kind === 'found'
  );

  // A human closes it, and the strike lands on the verified identity.
  const e2eDecision = moderation.recordDecision({
    complaintId: suspectComplaint.id,
    outcome: 'INVALID',
    reason: 'Reviewed: photograph is a selfie, no civic issue visible.',
    moderator,
    identityReference: suspectComplaint.reporter.identityReference,
  });
  checkEqual('E2E: the decision is recorded', e2eDecision.moderationCase.state, 'INVALID');
  checkEqual('E2E: and queues a citizen warning', e2eDecision.abuseAction.kind, 'WARNING');
  check(
    'E2E: the warning copy is neutral, with no threat of legal action',
    e2eDecision.abuseAction.kind !== 'NONE' &&
      !/legal|police|fir|prosecut/i.test(e2eDecision.abuseAction.message)
  );

  // ---- Screening failure must not stop intake --------------------
  intelligence.clearAnalysisCache();
  const outageScreening = await pipeline.screenSubmission(draftFor('Garbage not collected'), {
    provider: { analyze: async () => { throw new Error('provider down'); } },
  });
  checkEqual(
    'E2E: a provider outage still allows the complaint',
    outageScreening.decision.action,
    'ALLOW'
  );
  check('E2E: and records that screening did not run', outageScreening.ai.available === false);

  moderation.resetModerationStoreForTest();

  // ==========================================================
  section('28. Citizen warnings are gated and never punitive alone');
  // ==========================================================

  const warnings = await import('../services/citizenWarningService');
  warnings.resetWarningQueueForTest();

  // The production default is OFF. Nothing reaches a citizen's phone
  // because a risk engine was tuned wrong (spec §41).
  checkEqual('The citizen-warning flag is off by default', flags.CITIZEN_WARNING_ENABLED, false);

  const suppressed = warnings.queueWarning({
    action: { kind: 'WARNING', message: 'test' },
    identityReference: 'idref_test',
    complaintId: 'JS-GWL-2026-000910',
  });
  checkEqual('With the flag off, no warning is queued', suppressed.queued, false);
  checkEqual('And the reason is recorded for the moderator', suppressed.reason, 'DISABLED');

  // No verified channel means no notice, whatever the flag says.
  const noChannel = warnings.queueWarning({
    action: { kind: 'WARNING', message: 'test' },
    complaintId: 'JS-GWL-2026-000911',
  });
  checkEqual('An unverified reporter is never messaged', noChannel.queued, false);

  // A VALIDATED outcome produces no action and therefore no notice.
  const noAction = warnings.queueWarning({
    action: { kind: 'NONE' },
    identityReference: 'idref_test',
    complaintId: 'JS-GWL-2026-000912',
  });
  checkEqual('A valid complaint never queues a warning', noAction.queued, false);

  // Nothing is claimed as delivered while there is no provider.
  const drained = warnings.drainWarnings();
  checkEqual('No warning is reported as sent without a provider', drained.sent, 0);
  checkEqual('And the absence of a provider is stated', drained.providerConfigured, false);

  warnings.resetWarningQueueForTest();
}
