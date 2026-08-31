// ============================================================
// Department Performance Service — Weighted Scoring Engine
// ============================================================

import type { DepartmentMetrics, PerformanceScoreBreakdown } from '../types/department';

/**
 * Calculates a weighted 0-100 Department Performance Score.
 * Weights:
 * - Resolution Rate: 25 points
 * - SLA Compliance: 25 points
 * - Resolution Speed: 20 points
 * - Citizen Satisfaction: 20 points
 * - Backlog Control: 10 points
 *
 * Recognition Tiers:
 * - 90–100: ⭐ STAR DEPARTMENT
 * - 75–89: 🟢 PERFORMING
 * - 60–74: 🟡 NEEDS ATTENTION
 * - <60: 🔴 CRITICAL
 */
export function calculatePerformanceScore(metrics: DepartmentMetrics): PerformanceScoreBreakdown {
  // 1. Resolution Rate (0 to 25 pts)
  const resRate = Math.min(100, Math.max(0, metrics.resolutionRatePercent));
  const resRateScore = Math.round((resRate / 100) * 25);

  // 2. SLA Compliance (0 to 25 pts)
  const slaComp = Math.min(100, Math.max(0, metrics.slaCompliancePercent));
  const slaCompScore = Math.round((slaComp / 100) * 25);

  // 3. Resolution Speed (0 to 20 pts)
  // Target: <= 24h = 20 pts, 48h = 16 pts, 72h = 10 pts, >96h = 4 pts
  const avgHours = metrics.averageResolutionHours || 28;
  let speedScore = 20;
  if (avgHours <= 24) speedScore = 20;
  else if (avgHours <= 36) speedScore = 18;
  else if (avgHours <= 48) speedScore = 16;
  else if (avgHours <= 72) speedScore = 12;
  else speedScore = Math.max(4, Math.round(20 - (avgHours / 10)));

  // 4. Citizen Satisfaction (0 to 20 pts)
  // Target: 5.0 = 20 pts, 4.5 = 18 pts, 4.0 = 16 pts, 3.0 = 10 pts
  const rating = metrics.citizenSatisfactionAverage || 4.5;
  const satScore = Math.round((rating / 5) * 20);

  // 5. Backlog Control (0 to 10 pts)
  // Fewer active backlogged complaints relative to total = higher score
  const total = Math.max(1, metrics.totalReceived);
  const backlogRatio = metrics.backlogCount / total;
  let backlogScore = 10;
  if (backlogRatio <= 0.25) backlogScore = 10;
  else if (backlogRatio <= 0.45) backlogScore = 8;
  else if (backlogRatio <= 0.65) backlogScore = 6;
  else backlogScore = Math.max(2, Math.round(10 - backlogRatio * 10));

  // 6. Escalation Rate Penalty (0 to 5 bonus / penalty balance)
  const escRatio = metrics.escalated / total;
  let escScore = 5;
  if (escRatio === 0) escScore = 5;
  else if (escRatio <= 0.05) escScore = 4;
  else if (escRatio <= 0.1) escScore = 3;
  else escScore = 1;

  // Composite 0 to 100 Score
  const rawTotal = resRateScore + slaCompScore + speedScore + satScore + backlogScore;
  const totalScore = Math.min(100, Math.max(0, rawTotal));

  // Recognition Tier
  let tier: PerformanceScoreBreakdown['tier'] = 'performing';
  let tierLabel = 'Performing';
  let tierBadge = 'Performing';

  if (totalScore >= 90) {
    tier = 'star';
    tierLabel = 'Star Department';
    tierBadge = 'Star department';
  } else if (totalScore >= 75) {
    tier = 'performing';
    tierLabel = 'Performing';
    tierBadge = 'Performing';
  } else if (totalScore >= 60) {
    tier = 'needs-attention';
    tierLabel = 'Needs Attention';
    tierBadge = 'Needs attention';
  } else {
    tier = 'critical';
    tierLabel = 'Improvement Required';
    tierBadge = 'Critical';
  }

  return {
    totalScore,
    tier,
    tierLabel,
    tierBadge,
    components: {
      resolutionRate: {
        score: resRateScore,
        max: 25,
        label: 'Resolution Rate',
        value: `${resRate}%`,
      },
      slaCompliance: {
        score: slaCompScore,
        max: 25,
        label: 'SLA Compliance',
        value: `${slaComp}%`,
      },
      resolutionSpeed: {
        score: speedScore,
        max: 20,
        label: 'Resolution Speed',
        value: `~${avgHours}h avg`,
      },
      citizenSatisfaction: {
        score: satScore,
        max: 20,
        label: 'Citizen Satisfaction',
        value: `${rating.toFixed(1)} / 5.0`,
      },
      backlogControl: {
        score: backlogScore,
        max: 10,
        label: 'Backlog Control',
        value: `${metrics.backlogCount} active`,
      },
      escalationRate: {
        score: escScore,
        max: 5,
        label: 'Escalation Rate',
        value: `${metrics.escalated} escalated`,
      },
    },
  };
}
