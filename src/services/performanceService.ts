// ============================================================
// Resolution Quality Score — outcomes, not closure speed
// ============================================================
//
// The previous score weighted resolution rate 25, SLA 25, speed 20,
// satisfaction 20, backlog 10, escalations 5. Every one of those is a
// speed or closure proxy. A department that closed everything in four
// hours with fake photos scored 100.
//
// This version measures whether the work HELD and whether anyone
// independent agreed:
//
//   citizen-verified resolutions   22   did the citizen accept it?
//   durability at 30/90 days       18   was it still fixed later?
//   repeat-failure rate            16   did the same asset fail again?
//   evidence integrity             14   was the proof real?
//   SLA compliance                 12   was it on time?
//   workload-normalised backlog    10   is the queue under control?
//   resolution speed                5   capped, deliberately
//   citizen satisfaction            3   capped, deliberately
//
//   WHY SPEED IS CAPPED AT 5.
//   Bevan and Hood documented English NHS trusts "hitting the target and
//   missing the point" — the ambulance response-time target was met only
//   in England, where it fed a star rating, with allegations of depots
//   relocated from rural to urban areas to hit the clock. India's own
//   flagship ranking has been challenged too: two Quality Council of
//   India verifiers were arrested in Phagwara over an alleged bribe to
//   manipulate a city's Swachh Survekshan ranking. Any metric a
//   department can move by closing faster will be moved by closing
//   faster. Speed still counts — a slow department is a real problem —
//   but it cannot compensate for closing badly.
//
//   TWO RULES CARRIED FORWARD FROM THE PREVIOUS VERSION, UNCHANGED:
//   1. Every input is DERIVED from the complaint records.
//   2. Absent data is reported as absent, never as a default. A
//      component with no data is excluded and the remaining weights are
//      rescaled, so the score means "of what we can measure".

import type { DepartmentMetrics, PerformanceScoreBreakdown } from '../types/department';

interface Component {
  score: number;
  max: number;
  label: string;
  value: string;
  hasData: boolean;
}

const WEIGHTS = {
  citizenVerified: 22,
  durability: 18,
  repeatFailure: 16,
  evidenceIntegrity: 14,
  slaCompliance: 12,
  workloadBacklog: 10,
  resolutionSpeed: 5,
  citizenSatisfaction: 3,
} as const;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Linear points for a percentage against a weight. */
function pct(value: number, max: number): number {
  return Math.round((clampPercent(value) / 100) * max);
}

/** Resolution speed, capped. Faster is better but cannot buy the score. */
function speedPoints(avgHours: number, max: number): number {
  if (avgHours <= 24) return max;
  if (avgHours <= 48) return Math.round(max * 0.8);
  if (avgHours <= 72) return Math.round(max * 0.6);
  return Math.max(1, Math.round(max * 0.3));
}

/**
 * Backlog control, normalised by officers rather than by complaints.
 *
 * Dividing open work by total received rewards a department that simply
 * receives less. Dividing by staff asks the only fair question: is this
 * team keeping up with what it has been given?
 */
function workloadPoints(perOfficer: number, max: number): number {
  if (perOfficer <= 4) return max;
  if (perOfficer <= 8) return Math.round(max * 0.8);
  if (perOfficer <= 14) return Math.round(max * 0.55);
  if (perOfficer <= 22) return Math.round(max * 0.3);
  return Math.max(1, Math.round(max * 0.1));
}

/**
 * Weighted 0-100 department score, built on outcomes.
 *
 * Tiers: 90+ star, 75+ performing, 60+ needs attention, below that
 * improvement required. A department with nothing measurable gets no
 * tier at all rather than a flattering one.
 */
export function calculatePerformanceScore(metrics: DepartmentMetrics): PerformanceScoreBreakdown {
  const hasComplaints = metrics.totalReceived > 0;
  const hasResolutions = metrics.resolved > 0;
  const hasRatings = metrics.totalRatingsCount > 0;
  const hasSlaOutcome = metrics.resolved > 0 || metrics.slaBreached > 0;
  /* Each quality component needs BOTH its own figure and the precondition
     that could have produced it. Trusting the figure alone let a
     department with nothing resolved still be scored on durability and
     repeat failures, which the self-test caught: a department with no
     complaints at all came out "critical" at 50 rather than no-data.
     A metric that cannot have been measured is not data. */
  const hasDurability = hasResolutions && metrics.durabilityRatePercent !== null;
  const hasIntegrity = metrics.resolutionsWithEvidence > 0 && metrics.evidenceIntegrityPercent !== null;
  const hasRepeatSignal = hasResolutions && metrics.repeatFailureRatePercent !== null;

  // --- 1. Did the citizen accept it? ------------------------------
  const citizenVerified: Component = {
    score: hasResolutions ? pct(metrics.citizenVerifiedRatePercent, WEIGHTS.citizenVerified) : 0,
    max: WEIGHTS.citizenVerified,
    label: 'Citizen-verified resolutions',
    value: hasResolutions
      ? `${clampPercent(metrics.citizenVerifiedRatePercent)}% of ${metrics.resolved} confirmed by the reporter`
      : 'Nothing resolved yet',
    hasData: hasResolutions,
  };

  // --- 2. Was it still fixed later? -------------------------------
  const durability: Component = {
    score: hasDurability ? pct(metrics.durabilityRatePercent ?? 0, WEIGHTS.durability) : 0,
    max: WEIGHTS.durability,
    label: 'Durability at 30 / 90 days',
    value: hasDurability
      ? `${metrics.durabilityRatePercent}% of re-checked fixes were still holding`
      : 'No durability checks answered yet',
    hasData: hasDurability,
  };

  // --- 3. Did the same asset fail again? --------------------------
  // Inverted: a LOW repeat-failure rate earns the points.
  const repeatFailure: Component = {
    score: hasRepeatSignal
      ? pct(100 - clampPercent(metrics.repeatFailureRatePercent ?? 0), WEIGHTS.repeatFailure)
      : 0,
    max: WEIGHTS.repeatFailure,
    label: 'Repeat-failure rate',
    value: hasRepeatSignal
      ? `${metrics.repeatFailures} asset${metrics.repeatFailures === 1 ? '' : 's'} failed again within 180 days (${metrics.repeatFailureRatePercent}%)`
      : 'No resolutions against known assets yet',
    hasData: hasRepeatSignal,
  };

  // --- 4. Was the proof real? -------------------------------------
  const evidenceIntegrity: Component = {
    score: hasIntegrity ? pct(metrics.evidenceIntegrityPercent ?? 0, WEIGHTS.evidenceIntegrity) : 0,
    max: WEIGHTS.evidenceIntegrity,
    label: 'Evidence integrity',
    value: hasIntegrity
      ? `${metrics.evidenceIntegrityPercent}% capture integrity across ${metrics.resolutionsWithEvidence} resolution${metrics.resolutionsWithEvidence === 1 ? '' : 's'}`
      : 'No graded evidence yet',
    hasData: hasIntegrity,
  };

  // --- 5. Was it on time? -----------------------------------------
  const slaCompliance: Component = {
    score: hasSlaOutcome ? pct(metrics.slaCompliancePercent, WEIGHTS.slaCompliance) : 0,
    max: WEIGHTS.slaCompliance,
    label: 'SLA compliance',
    value: hasSlaOutcome ? `${clampPercent(metrics.slaCompliancePercent)}%` : 'No settled SLAs yet',
    hasData: hasSlaOutcome,
  };

  // --- 6. Is the queue under control, for this team's size? -------
  const workloadBacklog: Component = {
    score: hasComplaints ? workloadPoints(metrics.workloadPerOfficer, WEIGHTS.workloadBacklog) : 0,
    max: WEIGHTS.workloadBacklog,
    label: 'Backlog per officer',
    value: hasComplaints
      ? `${metrics.backlogCount} open, ${metrics.workloadPerOfficer.toFixed(1)} per officer`
      : 'No complaints yet',
    hasData: hasComplaints,
  };

  // --- 7 & 8. Capped speed and satisfaction -----------------------
  const resolutionSpeed: Component = {
    score: hasResolutions ? speedPoints(metrics.averageResolutionHours, WEIGHTS.resolutionSpeed) : 0,
    max: WEIGHTS.resolutionSpeed,
    label: 'Resolution speed (capped)',
    value: hasResolutions ? `${metrics.averageResolutionHours}h average` : 'Nothing resolved yet',
    hasData: hasResolutions,
  };

  const citizenSatisfaction: Component = {
    score: hasRatings
      ? Math.round((metrics.citizenSatisfactionAverage / 5) * WEIGHTS.citizenSatisfaction)
      : 0,
    max: WEIGHTS.citizenSatisfaction,
    label: 'Citizen satisfaction',
    value: hasRatings
      ? `${metrics.citizenSatisfactionAverage.toFixed(1)} / 5 from ${metrics.totalRatingsCount} rating${metrics.totalRatingsCount === 1 ? '' : 's'}`
      : 'No ratings yet',
    hasData: hasRatings,
  };

  const components = {
    citizenVerified,
    durability,
    repeatFailure,
    evidenceIntegrity,
    slaCompliance,
    workloadBacklog,
    resolutionSpeed,
    citizenSatisfaction,
  };

  // Rescale over what is actually measurable. A department awaiting its
  // first durability check is not penalised for the missing 18 points,
  // and is not credited with them either.
  const measurable = Object.values(components).filter((c) => c.hasData);
  const availableMax = measurable.reduce((sum, c) => sum + c.max, 0);
  const earned = measurable.reduce((sum, c) => sum + c.score, 0);

  const totalScore = availableMax > 0 ? Math.round((earned / availableMax) * 100) : 0;

  let tier: PerformanceScoreBreakdown['tier'];
  let tierLabel: string;
  let tierBadge: string;

  if (availableMax === 0) {
    tier = 'no-data';
    tierLabel = 'Not enough data';
    tierBadge = 'No data yet';
  } else if (totalScore >= 90) {
    tier = 'star';
    tierLabel = 'Star department';
    tierBadge = 'Star department';
  } else if (totalScore >= 75) {
    tier = 'performing';
    tierLabel = 'Performing';
    tierBadge = 'Performing';
  } else if (totalScore >= 60) {
    tier = 'needs-attention';
    tierLabel = 'Needs attention';
    tierBadge = 'Needs attention';
  } else {
    tier = 'critical';
    tierLabel = 'Improvement required';
    tierBadge = 'Critical';
  }

  return {
    totalScore,
    tier,
    tierLabel,
    tierBadge,
    dataCoverage: availableMax,
    components,
    reasons: buildReasons(components, metrics, availableMax),
  };
}

/**
 * The sentences published next to the number.
 *
 * Ordered by how far each component fell short of its weight, so the
 * first reason is always the one that cost the most — which is the one
 * a department head can act on.
 */
function buildReasons(
  components: Record<string, Component>,
  metrics: DepartmentMetrics,
  availableMax: number
): string[] {
  if (availableMax === 0) {
    return ['No complaints have been filed against this department, so there is nothing to score.'];
  }

  const reasons: string[] = [];

  const shortfalls = Object.values(components)
    .filter((c) => c.hasData)
    .map((c) => ({ component: c, lost: c.max - c.score }))
    .filter((row) => row.lost > 0)
    .sort((a, b) => b.lost - a.lost);

  for (const { component, lost } of shortfalls.slice(0, 3)) {
    reasons.push(`${component.label}: ${component.value} — ${lost} of ${component.max} points not earned.`);
  }

  const strongest = Object.values(components)
    .filter((c) => c.hasData && c.score === c.max)
    .sort((a, b) => b.max - a.max)[0];
  if (strongest) reasons.push(`Full marks on ${strongest.label.toLowerCase()}: ${strongest.value}.`);

  // Two findings that override the arithmetic and must be said outright.
  if (metrics.disputedEvidenceCount > 0) {
    reasons.push(
      `${metrics.disputedEvidenceCount} resolution${metrics.disputedEvidenceCount === 1 ? '' : 's'} carried evidence that failed a provenance check.`
    );
  }
  if (metrics.durabilityFailures > 0) {
    reasons.push(
      `${metrics.durabilityFailures} confirmed fix${metrics.durabilityFailures === 1 ? '' : 'es'} failed a later durability check.`
    );
  }

  const unmeasured = Object.values(components).filter((c) => !c.hasData);
  if (unmeasured.length > 0) {
    reasons.push(
      `Scored out of ${availableMax} available points. ${unmeasured.map((c) => c.label.toLowerCase()).join(', ')} could not be measured yet and were excluded rather than assumed.`
    );
  }

  return reasons;
}

/**
 * Anti-gaming rules, stated in code so they are not quietly dropped.
 *
 * Rendered on the performance screen. A scoring system whose defences
 * are undocumented is a scoring system whose defences get removed by the
 * next person who finds them inconvenient.
 */
export const ANTI_GAMING_RULES: string[] = [
  'No public inter-department league table. Ranking is internal, and the reasons are published with the number.',
  'Backlog is normalised by officer count, so a department cannot win by handling less work.',
  'Closure speed is capped at 5 of 100 points. Closing fast cannot compensate for closing badly.',
  'Verification cannot be requested by the officer who closed the job.',
  'Departments with nothing measurable score no tier at all, rather than a flattering default.',
];
