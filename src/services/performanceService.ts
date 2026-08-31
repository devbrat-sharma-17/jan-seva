// ============================================================
// Department Performance Service — weighted scoring
// ============================================================
//
// Two rules govern everything here:
//
//  1. Every input is DERIVED from the complaint records. No UI event
//     increments a metric, and there are no stored counters to drift.
//
//  2. Absent data is reported as absent, never as a default. The previous
//     version substituted 4.5 stars when nobody had rated a department
//     and 28 hours when nothing had been resolved — so a department with
//     no work at all scored in the seventies. A component with no data is
//     now excluded from the total and the remaining weights are rescaled,
//     so the score means "of what we can measure" rather than "of what we
//     assumed".

import type { DepartmentMetrics, PerformanceScoreBreakdown } from '../types/department';

interface Component {
  score: number;
  max: number;
  label: string;
  value: string;
  /** False when there is nothing to measure yet. */
  hasData: boolean;
}

/** Resolution speed, in points out of 20. Faster is better. */
function speedPoints(avgHours: number): number {
  if (avgHours <= 24) return 20;
  if (avgHours <= 36) return 18;
  if (avgHours <= 48) return 16;
  if (avgHours <= 72) return 12;
  return Math.max(4, Math.round(20 - avgHours / 10));
}

/** Backlog control, in points out of 10. A smaller open share is better. */
function backlogPoints(ratio: number): number {
  if (ratio <= 0.25) return 10;
  if (ratio <= 0.45) return 8;
  if (ratio <= 0.65) return 6;
  return Math.max(2, Math.round(10 - ratio * 10));
}

/** Escalation control, in points out of 5. Fewer escalations is better. */
function escalationPoints(ratio: number): number {
  if (ratio === 0) return 5;
  if (ratio <= 0.05) return 4;
  if (ratio <= 0.1) return 3;
  return 1;
}

/**
 * Weighted 0–100 department score.
 *
 * Weights: resolution rate 25, SLA compliance 25, resolution speed 20,
 * citizen satisfaction 20, backlog control 10, escalation rate 5.
 *
 * Recognition tiers: 90+ star, 75+ performing, 60+ needs attention,
 * below that critical. A department with nothing to measure gets no
 * tier at all rather than a flattering one.
 */
export function calculatePerformanceScore(metrics: DepartmentMetrics): PerformanceScoreBreakdown {
  const hasComplaints = metrics.totalReceived > 0;
  const hasResolutions = metrics.resolved > 0;
  const hasRatings = metrics.totalRatingsCount > 0;
  // Compliance is only meaningful once some complaint's SLA has settled.
  const hasSlaOutcome = metrics.resolved > 0 || metrics.slaBreached > 0;

  const resolutionRate: Component = {
    score: hasComplaints ? Math.round((clampPercent(metrics.resolutionRatePercent) / 100) * 25) : 0,
    max: 25,
    label: 'Resolution rate',
    value: hasComplaints ? `${clampPercent(metrics.resolutionRatePercent)}%` : 'No complaints yet',
    hasData: hasComplaints,
  };

  const slaCompliance: Component = {
    score: hasSlaOutcome ? Math.round((clampPercent(metrics.slaCompliancePercent) / 100) * 25) : 0,
    max: 25,
    label: 'SLA compliance',
    value: hasSlaOutcome ? `${clampPercent(metrics.slaCompliancePercent)}%` : 'No settled SLAs yet',
    hasData: hasSlaOutcome,
  };

  const resolutionSpeed: Component = {
    score: hasResolutions ? speedPoints(metrics.averageResolutionHours) : 0,
    max: 20,
    label: 'Resolution speed',
    value: hasResolutions ? `${metrics.averageResolutionHours}h average` : 'Nothing resolved yet',
    hasData: hasResolutions,
  };

  const citizenSatisfaction: Component = {
    score: hasRatings ? Math.round((metrics.citizenSatisfactionAverage / 5) * 20) : 0,
    max: 20,
    label: 'Citizen satisfaction',
    value: hasRatings
      ? `${metrics.citizenSatisfactionAverage.toFixed(1)} / 5 from ${metrics.totalRatingsCount} rating${metrics.totalRatingsCount === 1 ? '' : 's'}`
      : 'No ratings yet',
    hasData: hasRatings,
  };

  const backlogRatio = hasComplaints ? metrics.backlogCount / metrics.totalReceived : 0;
  const backlogControl: Component = {
    score: hasComplaints ? backlogPoints(backlogRatio) : 0,
    max: 10,
    label: 'Backlog control',
    value: hasComplaints ? `${metrics.backlogCount} open` : 'No complaints yet',
    hasData: hasComplaints,
  };

  const escalationRatio = hasComplaints ? metrics.escalated / metrics.totalReceived : 0;
  const escalationRate: Component = {
    score: hasComplaints ? escalationPoints(escalationRatio) : 0,
    max: 5,
    label: 'Escalation rate',
    value: hasComplaints
      ? `${metrics.escalated} escalated`
      : 'No complaints yet',
    hasData: hasComplaints,
  };

  const components = {
    resolutionRate,
    slaCompliance,
    resolutionSpeed,
    citizenSatisfaction,
    backlogControl,
    escalationRate,
  };

  // Rescale over what is actually measurable. A department awaiting its
  // first citizen rating is not penalised for the missing 20 points, and
  // is not credited with them either.
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
    /** How much of the scale had data behind it, out of 100 points. */
    dataCoverage: availableMax,
    components,
  };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
