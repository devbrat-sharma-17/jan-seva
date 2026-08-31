// ============================================================
// Admin Service — City-wide analytics derived from shared store
// ============================================================
// Every metric is computed from the same jan_seva_complaints_v3
// localStorage repository used by /report, /track, and /department.
// Nothing is hardcoded. When the demo data is replaced by an API,
// only this file needs to change.
//
// NOTE: All analytics shown in the Admin portal are DEMO/PLATFORM
// data, not official municipal statistics.

import type { Complaint } from '../types';
import type { DepartmentId, DepartmentMetrics, PerformanceScoreBreakdown } from '../types/department';
import type {
  CivicHealthScore,
  CivicHealthWeights,
  CivicHealthTier,
  CityOverviewKPIs,
  AttentionItem,
  AttentionSeverity,
  DepartmentRanking,
  CivicHotspot,
  FeedbackSummary,
  FeedbackTheme,
  EscalationSummary,
  AdminAuditAction,
  TrendSeries,
  TrendPeriod,
  AdminComplaintFilters,
  AdminInitiative,
} from '../types/admin';

import {
  getStoredComplaints,
  getDepartmentMetrics,
  getDepartmentEscalations,
  matchesDepartment,
} from './complaintService';

import { calculatePerformanceScore } from './performanceService';
import { computeSlaHealth } from './slaService';
import { DEPARTMENTS } from '../data/departments';
import {
  recordAuditEvent,
  getAuditTrail as readAuditTrail,
  getAuditTrailForComplaint as readComplaintAuditTrail,
  subscribeToAuditTrail,
} from './auditService';
import type { AuditEvent } from '../types/audit';

// ============================================================
// Constants
// ============================================================

const DEPARTMENT_IDS: DepartmentId[] = ['roads', 'sanitation', 'water', 'electrical', 'infrastructure'];

/**
 * Configurable Civic Health weights.
 * These can be tuned per-city or made admin-editable in the future.
 */
const DEFAULT_HEALTH_WEIGHTS: CivicHealthWeights = {
  departmentPerformance: 0.25,
  slaCompliance: 0.25,
  resolutionRate: 0.20,
  citizenSatisfaction: 0.15,
  backlogControl: 0.10,
  escalationControl: 0.05,
};

// ============================================================
// City Overview KPIs
// ============================================================

export function getCityOverview(): CityOverviewKPIs {
  const all = getStoredComplaints();
  const now = Date.now();

  let active = 0;
  let resolved = 0;
  let escalated = 0;
  let totalRatingSum = 0;
  let ratingsCount = 0;
  let totalResolutionHoursSum = 0;
  let resolvedWithTimestamp = 0;
  let pendingCitizenVerification = 0;
  let citizenVerified = 0;
  let slaBreached = 0;
  let resolvedOnTime = 0;

  for (const c of all) {
    // Derived from `dueAt` against the clock. The persisted `sla.status`
    // is a snapshot from write time and goes stale within hours.
    const health = computeSlaHealth(c, now);

    if (c.status === 'resolved') {
      resolved++;
      if (c.resolution?.citizenVerifiedResolved) {
        citizenVerified++;
      } else {
        pendingCitizenVerification++;
      }
      if (health && health.msRemaining >= 0) resolvedOnTime++;
      if (c.resolution?.resolvedAt) {
        const created = new Date(c.createdAt).getTime();
        const res = new Date(c.resolution.resolvedAt).getTime();
        if (res > created) {
          totalResolutionHoursSum += Math.max(1, Math.round((res - created) / (3600 * 1000)));
          resolvedWithTimestamp++;
        }
      }
    } else {
      active++;
      if (health?.status === 'exceeded') slaBreached++;
    }

    // One complaint, one escalation. Counting the status and the breach
    // separately made a single escalated complaint appear as two.
    if (c.status === 'escalated' || c.sla.escalatedAt) escalated++;

    if (c.feedback?.rating) {
      totalRatingSum += c.feedback.rating;
      ratingsCount++;
    }
  }

  const total = all.length;

  // Measured over complaints whose SLA outcome is settled — resolved, or
  // already breached. Work still inside its window has neither met nor
  // missed the target, and counting it as compliant flatters the number.
  const slaSettled = resolved + slaBreached;
  const slaCompliancePercent = slaSettled > 0
    ? Math.round((resolvedOnTime / slaSettled) * 100)
    : 0;
  const citizenSatisfactionAverage = ratingsCount > 0
    ? Number((totalRatingSum / ratingsCount).toFixed(1))
    : 0;
  const averageResolutionHours = resolvedWithTimestamp > 0
    ? Math.round(totalResolutionHoursSum / resolvedWithTimestamp)
    : 0;
  const resolutionVerificationRate = resolved > 0
    ? Math.round((citizenVerified / resolved) * 100)
    : 0;

  return {
    totalComplaints: total,
    activeComplaints: active,
    resolvedComplaints: resolved,
    escalatedComplaints: escalated,
    slaCompliancePercent,
    citizenSatisfactionAverage,
    averageResolutionHours,
    pendingCitizenVerification,
    resolutionVerificationRate,
  };
}

// ============================================================
// Civic Health Score — weighted composite, NOT a simple avg
// ============================================================

export function getCivicHealthScore(weights: CivicHealthWeights = DEFAULT_HEALTH_WEIGHTS): CivicHealthScore {
  const allMetrics: Array<{ metrics: DepartmentMetrics; score: PerformanceScoreBreakdown }> = [];

  for (const deptId of DEPARTMENT_IDS) {
    const metrics = getDepartmentMetrics(deptId);
    const score = calculatePerformanceScore(metrics);
    allMetrics.push({ metrics, score });
  }

  const count = allMetrics.length || 1;

  // Component 1: Weighted average of department performance scores
  const avgDeptScore = allMetrics.reduce((s, m) => s + m.score.totalScore, 0) / count;

  // Component 2: City-wide SLA compliance
  const overview = getCityOverview();
  const slaRaw = overview.slaCompliancePercent;

  // Component 3: City-wide resolution rate
  const resolutionRateRaw = overview.totalComplaints > 0
    ? Math.round((overview.resolvedComplaints / overview.totalComplaints) * 100)
    : 100;

  // Component 4: Citizen satisfaction (0-5 → 0-100)
  const satisfactionRaw = overview.citizenSatisfactionAverage > 0
    ? Math.round((overview.citizenSatisfactionAverage / 5) * 100)
    : 80;

  // Component 5: Backlog control (inverse of active/total ratio)
  const backlogRatio = overview.totalComplaints > 0
    ? overview.activeComplaints / overview.totalComplaints
    : 0;
  const backlogRaw = Math.round((1 - backlogRatio) * 100);

  // Component 6: Escalation control (inverse of escalation/total)
  const escRatio = overview.totalComplaints > 0
    ? overview.escalatedComplaints / overview.totalComplaints
    : 0;
  const escRaw = Math.round((1 - Math.min(1, escRatio * 5)) * 100); // 20%+ escalations = 0 score

  // Weighted composite
  const totalScore = Math.min(100, Math.max(0, Math.round(
    avgDeptScore * weights.departmentPerformance +
    slaRaw * weights.slaCompliance +
    resolutionRateRaw * weights.resolutionRate +
    satisfactionRaw * weights.citizenSatisfaction +
    backlogRaw * weights.backlogControl +
    escRaw * weights.escalationControl
  )));

  let tier: CivicHealthTier = 'good';
  let tierLabel = 'Good';
  let tierBadge = 'Good';
  if (totalScore >= 90) { tier = 'excellent'; tierLabel = 'Excellent'; tierBadge = 'Excellent'; }
  else if (totalScore >= 75) { tier = 'good'; tierLabel = 'Good'; tierBadge = 'Good'; }
  else if (totalScore >= 60) { tier = 'fair'; tierLabel = 'Fair'; tierBadge = 'Fair'; }
  else { tier = 'poor'; tierLabel = 'Poor'; tierBadge = 'Poor'; }

  return {
    totalScore,
    tier,
    tierLabel,
    tierBadge,
    components: {
      departmentPerformance: {
        score: Math.round(avgDeptScore * weights.departmentPerformance),
        max: Math.round(100 * weights.departmentPerformance),
        label: 'Department Performance',
        value: `${Math.round(avgDeptScore)} avg`,
      },
      slaCompliance: {
        score: Math.round(slaRaw * weights.slaCompliance),
        max: Math.round(100 * weights.slaCompliance),
        label: 'SLA Compliance',
        value: `${slaRaw}%`,
      },
      resolutionRate: {
        score: Math.round(resolutionRateRaw * weights.resolutionRate),
        max: Math.round(100 * weights.resolutionRate),
        label: 'Resolution Rate',
        value: `${resolutionRateRaw}%`,
      },
      citizenSatisfaction: {
        score: Math.round(satisfactionRaw * weights.citizenSatisfaction),
        max: Math.round(100 * weights.citizenSatisfaction),
        label: 'Citizen Satisfaction',
        value: `${overview.citizenSatisfactionAverage.toFixed(1)} / 5`,
      },
      backlogControl: {
        score: Math.round(backlogRaw * weights.backlogControl),
        max: Math.round(100 * weights.backlogControl),
        label: 'Backlog Control',
        value: `${overview.activeComplaints} active`,
      },
      escalationControl: {
        score: Math.round(escRaw * weights.escalationControl),
        max: Math.round(100 * weights.escalationControl),
        label: 'Escalation Control',
        value: `${overview.escalatedComplaints} escalated`,
      },
    },
  };
}

// ============================================================
// Needs Attention — explicit severity & action priority
// ============================================================

export function getCityNeedsAttention(): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = Date.now();
  const all = getStoredComplaints();

  // Per-department analysis
  for (const deptId of DEPARTMENT_IDS) {
    const dept = DEPARTMENTS[deptId];
    const deptComplaints = all.filter(c => matchesDepartment(c, deptId));
    const metrics = getDepartmentMetrics(deptId);
    const score = calculatePerformanceScore(metrics);

    // SLA health from `dueAt` against the clock. The persisted
    // `sla.status` is a snapshot from write time and goes stale.
    const breached = deptComplaints.filter(c => {
      if (c.status === 'resolved') return false;
      return computeSlaHealth(c, now)?.status === 'exceeded';
    });
    if (breached.length > 0) {
      items.push({
        id: `attn-sla-breach-${deptId}`,
        severity: 'critical' as AttentionSeverity,
        actionPriority: 1,
        title: `${breached.length} complaint${breached.length > 1 ? 's' : ''} breached SLA`,
        description: `${dept.shortName} has ${breached.length} unresolved complaint${breached.length > 1 ? 's' : ''} past the SLA deadline.`,
        department: dept.shortName,
        departmentId: deptId,
        affectedCount: breached.length,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/escalations`,
      });
    }

    // SLA approaching
    const approaching = deptComplaints.filter(c => {
      if (c.status === 'resolved') return false;
      return computeSlaHealth(c, now)?.status === 'approaching';
    });
    if (approaching.length > 0) {
      items.push({
        id: `attn-sla-risk-${deptId}`,
        severity: 'high' as AttentionSeverity,
        actionPriority: 2,
        title: `${approaching.length} complaint${approaching.length > 1 ? 's' : ''} approaching SLA`,
        description: `${dept.shortName} has ${approaching.length} complaint${approaching.length > 1 ? 's' : ''} nearing their resolution deadline.`,
        department: dept.shortName,
        departmentId: deptId,
        affectedCount: approaching.length,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/escalations`,
      });
    }

    // Department performance drop
    if (score.tier === 'critical') {
      items.push({
        id: `attn-perf-critical-${deptId}`,
        severity: 'critical' as AttentionSeverity,
        actionPriority: 1,
        title: `${dept.shortName} — Critical performance`,
        description: `Performance score ${score.totalScore}/100. Requires immediate administrative review.`,
        department: dept.shortName,
        departmentId: deptId,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/departments/${deptId}`,
      });
    } else if (score.tier === 'needs-attention') {
      items.push({
        id: `attn-perf-warn-${deptId}`,
        severity: 'medium' as AttentionSeverity,
        actionPriority: 3,
        title: `${dept.shortName} — Performance needs attention`,
        description: `Performance score ${score.totalScore}/100. SLA compliance at ${metrics.slaCompliancePercent}%.`,
        department: dept.shortName,
        departmentId: deptId,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/departments/${deptId}`,
      });
    }

    // Reinspection requests
    if (metrics.reinspectionRequested > 0) {
      items.push({
        id: `attn-reinspect-${deptId}`,
        severity: 'high' as AttentionSeverity,
        actionPriority: 2,
        title: `${metrics.reinspectionRequested} reinspection request${metrics.reinspectionRequested > 1 ? 's' : ''}`,
        description: `${dept.shortName} has ${metrics.reinspectionRequested} citizen reinspection request${metrics.reinspectionRequested > 1 ? 's' : ''} awaiting action.`,
        department: dept.shortName,
        departmentId: deptId,
        affectedCount: metrics.reinspectionRequested,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/escalations`,
      });
    }

    // Unassigned backlog
    if (metrics.unassigned > 2) {
      items.push({
        id: `attn-unassigned-${deptId}`,
        severity: 'medium' as AttentionSeverity,
        actionPriority: 3,
        title: `${metrics.unassigned} unassigned complaints`,
        description: `${dept.shortName} has ${metrics.unassigned} complaints awaiting officer assignment.`,
        department: dept.shortName,
        departmentId: deptId,
        affectedCount: metrics.unassigned,
        timestamp: new Date().toISOString(),
        drillDownPath: `/admin/departments/${deptId}`,
      });
    }
  }

  // Sort by actionPriority (lower first), then severity
  const severityOrder: Record<AttentionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => {
    if (a.actionPriority !== b.actionPriority) return a.actionPriority - b.actionPriority;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return items;
}

// ============================================================
// Department Performance — rankings with reasons
// ============================================================

export function getAllDepartmentRankings(sortBy: 'score' | 'sla' | 'resolution' | 'satisfaction' | 'backlog' = 'score'): DepartmentRanking[] {
  const rankings: DepartmentRanking[] = [];

  // Read the store once. This loop used to call `getStoredComplaints()`
  // inside each of five iterations, parsing the whole repository five
  // times for one render of the standings table.
  const allComplaints = getStoredComplaints();

  for (const deptId of DEPARTMENT_IDS) {
    const dept = DEPARTMENTS[deptId];
    const metrics = getDepartmentMetrics(deptId);
    const score = calculatePerformanceScore(metrics);
    const components = score.components;

    /* Reasons and recognitions are only drawn from dimensions that have
       data. Without this guard, a department with nothing filed against
       it collected "Fast resolution speed" and "Zero escalations" for
       having done no work, while one awaiting its first citizen rating
       was marked down for "satisfaction 0/5". */
    const reasons: string[] = [];
    const recognitions: string[] = [];

    if (components.resolutionRate.hasData) {
      if (metrics.resolutionRatePercent >= 95) recognitions.push('Excellent resolution rate');
      else if (metrics.resolutionRatePercent < 80) {
        reasons.push(`Resolution rate ${metrics.resolutionRatePercent}%, below target`);
      }
    }

    if (components.slaCompliance.hasData) {
      if (metrics.slaCompliancePercent >= 95) recognitions.push('Top SLA compliance');
      else if (metrics.slaCompliancePercent < 80) {
        reasons.push(`SLA compliance ${metrics.slaCompliancePercent}%, needs improvement`);
      }
    }

    if (components.resolutionSpeed.hasData) {
      if (metrics.averageResolutionHours <= 24) recognitions.push('Fast turnaround');
      else if (metrics.averageResolutionHours > 48) {
        reasons.push(`Average turnaround ${metrics.averageResolutionHours}h, over the 48h target`);
      }
    }

    if (components.citizenSatisfaction.hasData) {
      if (metrics.citizenSatisfactionAverage >= 4.5) recognitions.push('High citizen satisfaction');
      else if (metrics.citizenSatisfactionAverage < 3.5) {
        reasons.push(`Citizen satisfaction ${metrics.citizenSatisfactionAverage}/5, below threshold`);
      }
    }

    if (metrics.totalReceived > 0) {
      if (metrics.backlogCount > 10) reasons.push(`Backlog of ${metrics.backlogCount} open complaints`);
      else if (metrics.backlogCount <= 3) recognitions.push('Well-controlled backlog');

      if (metrics.escalated > 5) reasons.push(`${metrics.escalated} escalations open`);
      else if (metrics.escalated === 0) recognitions.push('No escalations');
    }

    const deptComplaints = allComplaints.filter(c => matchesDepartment(c, deptId));
    const pendingVerification = deptComplaints.filter(c =>
      c.status === 'resolved' && c.resolution && !c.resolution.citizenVerifiedResolved
    ).length;

    /* Direction of travel, inferred from where the department stands
       today. A genuine trend needs history this build does not keep, so
       departments with nothing to measure are reported as flat rather
       than assigned a direction. */
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (score.tier !== 'no-data') {
      if (score.totalScore >= 85 && metrics.escalated <= 2) trend = 'improving';
      else if (score.totalScore < 70 || metrics.escalated > 5) trend = 'declining';
    }

    if (reasons.length === 0 && recognitions.length === 0) {
      reasons.push(
        metrics.totalReceived === 0
          ? 'No complaints routed to this department yet'
          : 'Performance within the expected range'
      );
    }

    rankings.push({
      departmentId: deptId,
      departmentName: dept.name,
      shortName: dept.shortName,
      icon: dept.icon,
      accent: dept.visual.accent,
      rank: 0, // Assigned after sorting.
      performanceScore: score.totalScore,
      tier: score.tier,
      tierLabel: score.tierLabel,
      tierBadge: score.tierBadge,
      resolutionRate: metrics.resolutionRatePercent,
      slaCompliance: metrics.slaCompliancePercent,
      citizenSatisfaction: metrics.citizenSatisfactionAverage,
      averageResolutionHours: metrics.averageResolutionHours,
      backlogCount: metrics.backlogCount,
      escalations: metrics.escalated,
      pendingVerification,
      reasons,
      recognitions,
      trend,
    });
  }

  // Departments with nothing to measure sort last on every key, so an
  // empty department never tops the standings on a technicality.
  const unranked = (r: DepartmentRanking) => (r.tier === 'no-data' ? 1 : 0);

  const by = (compare: (a: DepartmentRanking, b: DepartmentRanking) => number) =>
    rankings.sort((a, b) => unranked(a) - unranked(b) || compare(a, b));

  switch (sortBy) {
    case 'sla': by((a, b) => b.slaCompliance - a.slaCompliance); break;
    case 'resolution': by((a, b) => b.resolutionRate - a.resolutionRate); break;
    case 'satisfaction': by((a, b) => b.citizenSatisfaction - a.citizenSatisfaction); break;
    case 'backlog': by((a, b) => a.backlogCount - b.backlogCount); break;
    default: by((a, b) => b.performanceScore - a.performanceScore);
  }

  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

// ============================================================
// Civic Hotspots — derived from complaint GPS clustering
// ============================================================

export function getCivicHotspots(): CivicHotspot[] {
  const all = getStoredComplaints();
  const localityMap = new Map<string, Complaint[]>();

  for (const c of all) {
    const locality = c.location.locality || 'Unknown';
    if (!localityMap.has(locality)) localityMap.set(locality, []);
    localityMap.get(locality)!.push(c);
  }

  const hotspots: CivicHotspot[] = [];
  for (const [locality, complaints] of localityMap) {
    if (complaints.length < 1) continue;

    // Find most common category
    const catCounts = new Map<string, number>();
    for (const c of complaints) {
      const cat = c.issue.category;
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const catTitleMap: Record<string, string> = {
      roads: 'Roads & Potholes',
      garbage: 'Sanitation & Waste',
      water: 'Water Supply',
      streetlights: 'Electrical & Streetlights',
      infrastructure: 'Public Infrastructure',
    };

    const now = Date.now();
    const highPriority = complaints.filter(c =>
      (c.aiAnalysis?.priorityScore || 0) >= 75 || c.aiAnalysis?.severity === 'high' || c.aiAnalysis?.severity === 'critical'
    ).length;
    const slaBreached = complaints.filter(c => {
      if (c.status === 'resolved') return false;
      return computeSlaHealth(c, now)?.status === 'exceeded';
    }).length;

    // Average resolution hours
    const resolvedWithTime = complaints.filter(c => c.resolution?.resolvedAt);
    const avgResHours = resolvedWithTime.length > 0
      ? Math.round(resolvedWithTime.reduce((sum, c) => {
          const created = new Date(c.createdAt).getTime();
          const res = new Date(c.resolution!.resolvedAt!).getTime();
          return sum + Math.max(1, (res - created) / (3600 * 1000));
        }, 0) / resolvedWithTime.length)
      : 0;

    // Departments involved
    const depts = new Set<string>();
    for (const c of complaints) {
      if (c.department?.name) depts.add(c.department.name);
    }

    // Average lat/lng
    const avgLat = complaints.reduce((s, c) => s + c.location.latitude, 0) / complaints.length;
    const avgLng = complaints.reduce((s, c) => s + c.location.longitude, 0) / complaints.length;

    hotspots.push({
      id: `hotspot-${locality.toLowerCase().replace(/\s+/g, '-')}`,
      locality,
      latitude: avgLat,
      longitude: avgLng,
      complaintCount: complaints.length,
      topCategory: topCat?.[0] || 'unknown',
      topCategoryTitle: catTitleMap[topCat?.[0] || ''] || topCat?.[0] || 'General',
      highPriorityCount: highPriority,
      slaBreachedCount: slaBreached,
      averageResolutionHours: avgResHours,
      departments: [...depts],
    });
  }

  hotspots.sort((a, b) => b.complaintCount - a.complaintCount);
  return hotspots;
}

// ============================================================
// Feedback Summary — with resolution verification rate
// ============================================================

export function getFeedbackSummary(): FeedbackSummary {
  const all = getStoredComplaints();

  let overallSum = 0;
  let totalRatings = 0;
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let totalResolved = 0;
  let citizenVerified = 0;
  let awaitingVerification = 0;
  let reinspectionRequested = 0;

  const deptRatings = new Map<DepartmentId, { sum: number; count: number; name: string }>();

  for (const c of all) {
    if (c.status === 'resolved') {
      totalResolved++;
      if (c.resolution?.citizenVerifiedResolved) citizenVerified++;
      else awaitingVerification++;
    }

    if (c.feedback?.reinspectionRequested) reinspectionRequested++;

    if (c.feedback?.rating) {
      overallSum += c.feedback.rating;
      totalRatings++;
      if (c.feedback.rating >= 4) positive++;
      else if (c.feedback.rating === 3) neutral++;
      else negative++;

      // Department breakdown
      for (const deptId of DEPARTMENT_IDS) {
        if (matchesDepartment(c, deptId)) {
          const dept = DEPARTMENTS[deptId];
          if (!deptRatings.has(deptId)) deptRatings.set(deptId, { sum: 0, count: 0, name: dept.shortName });
          const d = deptRatings.get(deptId)!;
          d.sum += c.feedback.rating;
          d.count++;
          break;
        }
      }
    }
  }

  const departmentBreakdown = DEPARTMENT_IDS.map(deptId => {
    const dept = DEPARTMENTS[deptId];
    const d = deptRatings.get(deptId);
    return {
      departmentId: deptId,
      departmentName: dept.shortName,
      rating: d ? Number((d.sum / d.count).toFixed(1)) : 0,
      totalRatings: d?.count || 0,
    };
  });

  // Demo feedback themes
  const themes: FeedbackTheme[] = [
    { id: 'fast-resolution', label: 'Fast resolution', sentiment: 'positive' as const, count: Math.max(1, Math.round(positive * 0.6)), icon: '⚡' },
    { id: 'good-communication', label: 'Good communication', sentiment: 'positive' as const, count: Math.max(1, Math.round(positive * 0.4)), icon: '💬' },
    { id: 'delayed-response', label: 'Delayed response', sentiment: 'negative' as const, count: Math.max(0, Math.round(negative * 0.5)), icon: '⏳' },
    { id: 'incomplete-repair', label: 'Incomplete repair', sentiment: 'negative' as const, count: Math.max(0, Math.round(negative * 0.3)), icon: '🔧' },
    { id: 'repeated-issue', label: 'Repeated issue', sentiment: 'negative' as const, count: Math.max(0, reinspectionRequested), icon: '🔄' },
    { id: 'professional-staff', label: 'Professional staff', sentiment: 'positive' as const, count: Math.max(0, Math.round(positive * 0.3)), icon: '👤' },
  ].filter(t => t.count > 0);

  const resolutionVerificationRate = totalResolved > 0
    ? Math.round((citizenVerified / totalResolved) * 100)
    : 0;

  return {
    overallRating: totalRatings > 0 ? Number((overallSum / totalRatings).toFixed(1)) : 0,
    totalRatings,
    positive,
    neutral,
    negative,
    resolutionVerificationRate,
    totalResolved,
    citizenVerified,
    awaitingVerification,
    reinspectionRequested,
    departmentBreakdown,
    themes,
  };
}

// ============================================================
// Escalation Summary
// ============================================================

export function getEscalationSummary(): EscalationSummary {
  const all = getStoredComplaints();
  const now = Date.now();

  let slaAtRisk = 0;
  let slaBreached = 0;
  let escalated = 0;
  let reinspectionRequested = 0;

  for (const c of all) {
    if (c.status === 'resolved') {
      if (c.feedback?.reinspectionRequested) reinspectionRequested++;
      continue;
    }

    if (c.status === 'escalated') {
      escalated++;
      slaBreached++;
      continue;
    }

    const health = computeSlaHealth(c, now);
    if (health?.status === 'exceeded') {
      slaBreached++;
    } else if (health?.status === 'approaching') {
      slaAtRisk++;
    }

    if (c.feedback?.reinspectionRequested) reinspectionRequested++;
  }

  return { slaAtRisk, slaBreached, escalated, reinspectionRequested };
}

// ============================================================
// Trend Data — derived from shared complaint/timeline data
// ============================================================

export function getTrendData(period: TrendPeriod): TrendSeries[] {
  const all = getStoredComplaints();
  const now = Date.now();
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;

  let buckets: number;
  let bucketSize: number;
  let labelFn: (date: Date) => string;

  switch (period) {
    case '7d':
      buckets = 7;
      bucketSize = DAY;
      labelFn = (d) => d.toLocaleDateString('en-IN', { weekday: 'short' });
      break;
    case '30d':
      buckets = 4;
      bucketSize = 7 * DAY;
      labelFn = (d) => `Week of ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      break;
    case '90d':
      buckets = 3;
      bucketSize = 30 * DAY;
      labelFn = (d) => d.toLocaleDateString('en-IN', { month: 'short' });
      break;
    default:
      buckets = 7;
      bucketSize = DAY;
      labelFn = (d) => d.toLocaleDateString('en-IN', { weekday: 'short' });
  }

  const complaintsReceived = new Array(buckets).fill(0);
  const complaintsResolved = new Array(buckets).fill(0);
  const labels: string[] = [];
  const timestamps: string[] = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = now - (buckets - i) * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    labels.push(labelFn(new Date(bucketStart)));
    timestamps.push(new Date(bucketStart).toISOString());

    for (const c of all) {
      const created = new Date(c.createdAt).getTime();
      if (created >= bucketStart && created < bucketEnd) {
        complaintsReceived[i]++;
      }

      if (c.resolution?.resolvedAt) {
        const resolved = new Date(c.resolution.resolvedAt).getTime();
        if (resolved >= bucketStart && resolved < bucketEnd) {
          complaintsResolved[i]++;
        }
      }
    }
  }

  return [
    {
      id: 'received',
      label: 'Complaints Received',
      color: 'var(--admin-blue)',
      data: labels.map((label, i) => ({
        label,
        timestamp: timestamps[i],
        value: complaintsReceived[i],
      })),
    },
    {
      id: 'resolved',
      label: 'Complaints Resolved',
      color: 'var(--admin-green)',
      data: labels.map((label, i) => ({
        label,
        timestamp: timestamps[i],
        value: complaintsResolved[i],
      })),
    },
  ];
}

// ============================================================
// Recent Activity — derived from timeline events
// ============================================================

export function getRecentActivity(limit: number = 10): Array<{
  id: string;
  title: string;
  description: string;
  timestamp: string;
  department?: string;
  complaintId?: string;
  type: 'resolution' | 'escalation' | 'assignment' | 'update' | 'feedback' | 'citizen';
}> {
  const all = getStoredComplaints();
  const events: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    department?: string;
    complaintId?: string;
    type: 'resolution' | 'escalation' | 'assignment' | 'update' | 'feedback' | 'citizen';
  }> = [];

  for (const c of all) {
    for (const evt of c.timeline) {
      let type: typeof events[0]['type'] = 'update';
      if (evt.status === 'resolved') type = 'resolution';
      else if (evt.status === 'escalated') type = 'escalation';
      else if (evt.status === 'assigned') type = 'assignment';

      events.push({
        id: evt.id,
        title: evt.title,
        description: evt.description,
        timestamp: evt.timestamp,
        department: c.department.name,
        complaintId: c.id,
        type,
      });
    }

    // Add feedback as an event
    if (c.feedback?.submittedAt) {
      events.push({
        id: `feedback-${c.id}`,
        title: `Citizen rated ${c.feedback.rating}★`,
        description: c.feedback.comment || 'Feedback submitted.',
        timestamp: c.feedback.submittedAt,
        department: c.department.name,
        complaintId: c.id,
        type: 'feedback',
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}

// ============================================================
// Admin Notifications
// ============================================================
// Moved to `notificationService`, which fingerprints each alert so read
// state survives a re-render. Re-exported here because the admin screens
// already import their data from this module.

export {
  getAdminNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationUnread,
  subscribeToNotificationReadState,
} from './notificationService';

// ============================================================
// Admin Audit Trail — SEPARATE from complaint timeline
// ============================================================

// The trail itself lives in `auditService`, shared with the department
// portal, so an administrator sees department actions and department
// staff see the administrative actions taken on their complaints. These
// wrappers keep the admin screens reading city-wide scope by default.

export function addAuditEvent(
  admin: { id: string; name: string },
  action: AdminAuditAction,
  targetType: 'complaint' | 'department' | 'system',
  targetId: string,
  description: string,
  metadata?: Record<string, string>
): AuditEvent {
  return recordAuditEvent({
    actor: { id: admin.id, name: admin.name, role: 'admin' },
    action,
    targetType,
    targetId,
    description,
    metadata,
  });
}

export function getAuditTrail(limit: number = 50): AuditEvent[] {
  return readAuditTrail({ role: 'admin' }, limit);
}

export function getAuditTrailForComplaint(complaintId: string): AuditEvent[] {
  return readComplaintAuditTrail(complaintId, { role: 'admin' });
}

/** Re-exported so admin screens refresh when any actor writes to the trail. */
export const subscribeToAudit = subscribeToAuditTrail;

// ============================================================
// Admin Complaint Operations
// ============================================================

export function getFilteredComplaints(filters: AdminComplaintFilters): Complaint[] {
  let all = getStoredComplaints();
  const now = Date.now();

  if (filters.department) {
    all = all.filter(c => matchesDepartment(c, filters.department!));
  }

  if (filters.status) {
    all = all.filter(c => c.status === filters.status);
  }

  if (filters.priority) {
    all = all.filter(c => {
      const ps = c.aiAnalysis?.priorityScore || 50;
      const sev = c.aiAnalysis?.severity || 'medium';
      switch (filters.priority) {
        case 'critical': return ps >= 90 || sev === 'critical';
        case 'high': return (ps >= 75 && ps < 90) || sev === 'high';
        case 'medium': return (ps >= 50 && ps < 75) || sev === 'medium';
        case 'low': return ps < 50 || sev === 'low';
        default: return true;
      }
    });
  }

  if (filters.category) {
    all = all.filter(c => c.issue.category === filters.category);
  }

  if (filters.locality) {
    all = all.filter(c => c.location.locality.toLowerCase().includes(filters.locality!.toLowerCase()));
  }

  if (filters.slaStatus) {
    all = all.filter(c => {
      if (c.status === 'resolved') return filters.slaStatus === 'met';
      const slaStatus = computeSlaHealth(c, now)?.status;
      switch (filters.slaStatus) {
        case 'exceeded': return slaStatus === 'exceeded';
        case 'approaching': return slaStatus === 'approaching';
        case 'normal': return slaStatus === 'normal';
        default: return true;
      }
    });
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    all = all.filter(c =>
      c.id.toLowerCase().includes(q) ||
      c.issue.title.toLowerCase().includes(q) ||
      c.issue.description.toLowerCase().includes(q) ||
      c.location.locality.toLowerCase().includes(q) ||
      c.location.address.toLowerCase().includes(q)
    );
  }

  return all;
}

// ============================================================
// Department Detail for Admin drill-down
// ============================================================

export function getDepartmentDetail(deptId: DepartmentId) {
  const dept = DEPARTMENTS[deptId];
  if (!dept) return null;

  const metrics = getDepartmentMetrics(deptId);
  const score = calculatePerformanceScore(metrics);
  const ranking = getAllDepartmentRankings().find(r => r.departmentId === deptId);
  const escalations = getDepartmentEscalations(deptId);
  const complaints = getStoredComplaints().filter(c => matchesDepartment(c, deptId));

  /* Why this department needs attention.
     Each test is guarded on the data actually existing. Without the
     guards a department with no ratings reads as "satisfaction 0/5",
     and one with nothing resolved yet reads as "0% SLA compliance" —
     both of which are absence of evidence being reported as failure. */
  const whyAttention: string[] = [];

  const hasSlaOutcome = metrics.resolved > 0 || metrics.slaBreached > 0;
  if (hasSlaOutcome && metrics.slaCompliancePercent < 85) {
    whyAttention.push(`SLA compliance at ${metrics.slaCompliancePercent}%, below the 85% target.`);
  }
  if (metrics.resolved > 0 && metrics.averageResolutionHours > 48) {
    whyAttention.push(`Average turnaround ${metrics.averageResolutionHours}h, over the 48h target.`);
  }
  if (metrics.backlogCount > 5) {
    whyAttention.push(`Active backlog of ${metrics.backlogCount} complaints.`);
  }
  if (metrics.escalated > 2) {
    whyAttention.push(`${metrics.escalated} escalations currently open.`);
  }
  if (metrics.totalRatingsCount > 0 && metrics.citizenSatisfactionAverage < 4.0) {
    whyAttention.push(
      `Citizen satisfaction ${metrics.citizenSatisfactionAverage}/5 across ${metrics.totalRatingsCount} rating${metrics.totalRatingsCount === 1 ? '' : 's'}, below the 4.0 threshold.`
    );
  }
  if (metrics.reinspectionRequested > 0) {
    whyAttention.push(
      `${metrics.reinspectionRequested} citizen reinspection request${metrics.reinspectionRequested > 1 ? 's' : ''} outstanding.`
    );
  }
  if (metrics.unassigned > 0) {
    whyAttention.push(
      `${metrics.unassigned} complaint${metrics.unassigned > 1 ? 's' : ''} with no officer assigned.`
    );
  }

  /* Advisory next steps, ordered by what would move the score most.
     These are suggestions for a human to weigh, not instructions, and
     the UI labels them as such. */
  const recommendations: string[] = [];
  if (metrics.slaBreached > 0) {
    recommendations.push(
      `Clear the ${metrics.slaBreached} breached complaint${metrics.slaBreached > 1 ? 's' : ''} first — they carry the largest SLA penalty.`
    );
  }
  if (metrics.unassigned > 0) {
    recommendations.push('Assign an officer to every unassigned complaint before new intake arrives.');
  }
  if (metrics.highPriority + metrics.criticalPriority > 0 && metrics.backlogCount > 5) {
    recommendations.push('Review unresolved high-priority complaints with the nodal officer.');
  }
  if (metrics.reinspectionRequested > 0) {
    recommendations.push('Respond to outstanding reinspection requests — these are already-failed resolutions.');
  }

  return {
    config: dept,
    metrics,
    score,
    ranking,
    escalations,
    complaints,
    whyAttention,
    recommendations,
  };
}

// ============================================================
// Demo Initiatives
// ============================================================

export function getAdminInitiatives(): AdminInitiative[] {
  return [
    {
      id: 'ini-001',
      title: 'Swachh Ward Initiative',
      department: 'sanitation',
      description: 'Intensive waste management and cleanliness campaign across all 35 wards.',
      status: 'active',
      startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      progress: 45,
      relatedComplaints: 42,
      location: 'All Wards, Gwalior',
    },
    {
      id: 'ini-002',
      title: 'Smart Streetlight Upgrade',
      department: 'electrical',
      description: 'Replacing conventional sodium lamps with energy-efficient LED fixtures.',
      status: 'active',
      startDate: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      progress: 32,
      relatedComplaints: 18,
      location: 'Phase 1: City Centre, Thatipur',
    },
    {
      id: 'ini-003',
      title: 'Water Conservation Mission',
      department: 'water',
      description: 'Pipeline leak detection, pressure management, and water harvesting infrastructure.',
      status: 'planned',
      startDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
      progress: 0,
      relatedComplaints: 31,
      location: 'Lashkar, Morar, Maharaj Bada',
    },
    {
      id: 'ini-004',
      title: 'Road Repair Programme',
      department: 'roads',
      description: 'Post-monsoon pothole filling and road resurfacing across major arterials.',
      status: 'active',
      startDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      targetDate: new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString(),
      progress: 28,
      relatedComplaints: 56,
      location: 'City Centre, Phool Bagh, Morar',
    },
  ];
}
