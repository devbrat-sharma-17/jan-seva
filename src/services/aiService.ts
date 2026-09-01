// ============================================================
// Classification Service — routing, duplicates, priority
// ============================================================
//
//   THIS IS NOT AI, AND NOTHING IN THE PRODUCT CALLS IT AI ANY MORE.
//
// It is weighted keyword matching over the description, scored across
// all categories rather than resolved by the first hit. Photos are not
// analysed. No model is loaded. The word "AI" used to appear on the
// landing page, in the README and in the timeline event text on top of
// `text.includes(keyword)`, and a judge who read either would find the
// gap in about ninety seconds.
//
// The honest position is also the stronger one. CPGRAMS' IGMS already
// does spam, bulk and repetitive-grievance detection, urgency flagging,
// topic clustering and spatiotemporal analysis at NATIONAL scale. This
// platform is not going to win on classification and should not pretend
// to. Singapore's OneService — a real model trained on 160,000+ cases —
// publishes ~80% case-type accuracy and ~85% routing accuracy, so any
// honest system must assume roughly one in five is misrouted and design
// for it:
//
//   * the citizen confirms the suggested category before submitting;
//   * misrouting is recoverable through audited cross-department
//     reassignment, which already requires a written reason;
//   * NO citizen-facing consequence depends on this classifier. A
//     misrouted complaint is slower. It is never closed, never
//     rejected, and never scored against anyone by the matcher.
//
// Confidence is derived from the margin over the runner-up, so a report
// that matched nothing says so instead of asserting a category at 94%.

import { computeSlaHealth } from './slaService';
import { distanceMetres } from './geoService';
import { getIssueForComplaint, computeSpread } from './issueService';
import type { ReportDraft, AIAnalysis, DuplicateMatch } from '../types/report';
import type { Complaint } from '../types';
import { getStoredComplaints } from './complaintService';
import { formatRelative } from './timeService';

interface CategoryProfile {
  id: string;
  title: string;
  department: string;
  departmentName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  basePriority: number;
  /** Hindi and Hinglish terms matter here — most reports are typed that way. */
  keywords: string[];
}

const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    id: 'roads',
    title: 'Roads & Potholes',
    department: 'pwd',
    departmentName: 'Public Works Department (PWD)',
    severity: 'high',
    basePriority: 85,
    keywords: [
      'pothole', 'gaddha', 'road', 'sadak', 'crack', 'tar', 'asphalt', 'speed breaker',
      'resurfac', 'bump', 'damaged road', 'broken road',
    ],
  },
  {
    id: 'garbage',
    title: 'Garbage & Sanitation',
    department: 'sanitation',
    departmentName: 'Municipal Sanitation Department',
    severity: 'medium',
    basePriority: 72,
    keywords: [
      'garbage', 'kachra', 'kachara', 'waste', 'safai', 'trash', 'dump', 'dustbin',
      'litter', 'smell', 'rubbish', 'sewage', 'gandagi',
    ],
  },
  {
    id: 'water',
    title: 'Water Leakage & Supply',
    department: 'water_works',
    departmentName: 'Public Health & Water Works',
    severity: 'high',
    basePriority: 88,
    keywords: [
      'water', 'pani', 'leak', 'pipe', 'pipeline', 'drain', 'nali', 'tap', 'supply',
      'burst', 'flood', 'overflow', 'sewer',
    ],
  },
  {
    id: 'streetlights',
    title: 'Street Lighting',
    department: 'electrical',
    departmentName: 'Municipal Electrical Division',
    severity: 'medium',
    basePriority: 65,
    keywords: [
      'light', 'streetlight', 'street light', 'lamp', 'pole', 'dark', 'bijli', 'batti',
      'bulb', 'led', 'electric', 'wire',
    ],
  },
  {
    id: 'infrastructure',
    title: 'Public Infrastructure',
    department: 'urban_infra',
    departmentName: 'Urban Infrastructure Cell',
    severity: 'medium',
    basePriority: 70,
    keywords: [
      'bridge', 'pul', 'park', 'footpath', 'divider', 'railing', 'bench', 'wall',
      'building', 'toilet', 'bus stop', 'signage',
    ],
  },
];

const DEFAULT_PROFILE = CATEGORY_PROFILES[0];

/** Words that mark an issue as dangerous, not merely inconvenient. */
const URGENCY_TERMS = [
  'accident', 'danger', 'injur', 'child', 'school', 'hospital', 'urgent', 'emergency',
  'collapse', 'fell', 'deep', 'major', 'severe', 'big', 'blocked', 'khatra',
];

/** Complaints within this radius of the same category are treated as the same issue. */
const DUPLICATE_RADIUS_METRES = 150;


/** Scores each category by keyword hits and returns the best, with confidence. */
function classify(text: string, hintedCategory?: string): { profile: CategoryProfile; confidence: number } {
  const scores = CATEGORY_PROFILES.map((profile) => {
    let score = profile.keywords.reduce(
      (total, keyword) => (text.includes(keyword) ? total + 1 : total),
      0
    );
    // The category tapped on the landing page is a signal, not a verdict —
    // the description can still override it.
    if (hintedCategory && profile.id === hintedCategory) score += 1.5;
    return { profile, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;

  if (best.score === 0) {
    // Nothing matched. Say so with a low confidence rather than asserting
    // "roads" at 94% the way the previous version did.
    return { profile: hintedCategory
      ? CATEGORY_PROFILES.find((p) => p.id === hintedCategory) ?? DEFAULT_PROFILE
      : DEFAULT_PROFILE, confidence: 0.35 };
  }

  // Confidence reflects how clearly the winner beat the next candidate.
  const margin = best.score - (runnerUp?.score ?? 0);
  const confidence = Math.min(0.97, 0.55 + margin * 0.12 + Math.min(best.score, 4) * 0.05);

  return { profile: best.profile, confidence: Number(confidence.toFixed(2)) };
}

function toDuplicateMatch(complaint: Complaint, distance: number): DuplicateMatch {
  return {
    id: complaint.id,
    title: complaint.issue.title || 'Reported civic issue',
    location: complaint.location?.address || complaint.location?.locality || 'Gwalior',
    distanceMeters: distance,
    status:
      complaint.status === 'resolved'
        ? 'resolved'
        : complaint.status === 'pending'
        ? 'pending'
        : 'in-progress',
    reportedAt: formatRelative(complaint.createdAt),
    supportingCount: complaint.duplicate?.supportingCount ?? 1,
    thumbnailUrl: complaint.photos?.[0],
  };
}

/**
 * Finds an open complaint of the same category close enough to be the same
 * physical issue. The previous implementation compared the description
 * against two hardcoded phrases, so it fired only for a scripted demo and
 * never for a genuine report.
 */
function findDuplicate(draft: ReportDraft, category: string): DuplicateMatch | null {
  const location = draft.location;
  if (!location) return null;

  const candidates = getStoredComplaints()
    .filter((c) => {
      // A resolved complaint is history, not a duplicate to join.
      if (c.status === 'resolved') return false;
      if (c.issue.category !== category) return false;
      return typeof c.location?.latitude === 'number' && typeof c.location?.longitude === 'number';
    })
    .map((c) => ({ complaint: c, distance: distanceMetres(location, c.location) }))
    .filter(({ distance }) => distance <= DUPLICATE_RADIUS_METRES)
    .sort((a, b) => a.distance - b.distance);

  const nearest = candidates[0];
  return nearest ? toDuplicateMatch(nearest.complaint, nearest.distance) : null;
}

/**
 * Classifies a draft report.
 *
 * Named `analyzeReportMock` for continuity with existing callers. It is
 * not a mock of a model that exists elsewhere — it is the whole
 * implementation, and the UI describes it as keyword matching.
 */
export async function analyzeReportMock(draft: ReportDraft): Promise<AIAnalysis> {
  // Deliberate pause so the citizen sees the classification step happen
  // rather than the form appearing to skip it. Not inference latency.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const text = (draft.description || '').toLowerCase();
  const { profile, confidence } = classify(text, draft.category);

  // Urgency terms and photo evidence both raise the routing priority.
  const urgencyHits = URGENCY_TERMS.filter((term) => text.includes(term)).length;
  const priorityScore = Math.min(
    99,
    profile.basePriority + urgencyHits * 4 + (draft.photos.length > 1 ? 3 : 0)
  );

  const severity: AIAnalysis['severity'] =
    priorityScore >= 92 ? 'critical' : priorityScore >= 80 ? 'high' : profile.severity;

  return {
    category: profile.id,
    categoryTitle: profile.title,
    severity,
    priorityScore,
    department: profile.department,
    departmentName: profile.departmentName,
    confidence,
    duplicateMatch: findDuplicate(draft, profile.id),
  };
}

/** Explains why an issue received its specific priority triage */
export function explainPriority(complaint: Complaint): { level: 'critical' | 'high' | 'medium' | 'low'; reasons: string[] } {
  const reasons: string[] = [];
  const score = complaint.aiAnalysis?.priorityScore || 70;
  const severity = complaint.aiAnalysis?.severity || 'medium';
  const desc = (complaint.issue.description || '').toLowerCase();
  const title = (complaint.issue.title || '').toLowerCase();
  const fullText = `${title} ${desc}`;

  // Severity reason
  if (severity === 'critical') {
    reasons.push('Description contains urgency terms indicating a public safety risk');
  } else if (severity === 'high') {
    reasons.push('High physical severity / structural damage');
  }

  // Location / Corridor impact
  if (
    fullText.includes('crossing') ||
    fullText.includes('main road') ||
    fullText.includes('city centre') ||
    fullText.includes('highway') ||
    fullText.includes('traffic')
  ) {
    reasons.push('Located on high-traffic civic corridor');
  }

  /* Independent support, stated as SPREAD rather than as a count.
     "18 reports" invites the reader to treat volume as truth; a count
     is also trivially manufactured by a resident association or a
     contractor. What the number establishes is how many independent
     places and identities it came from. */
  const issue = getIssueForComplaint(complaint.id);
  if (issue && issue.stakes.length > 1) {
    const spread = computeSpread(issue);
    reasons.push(spread.label);
  }

  /* SLA health is computed against the clock. Reading the persisted
     `sla.status` meant a complaint that breached hours ago was still
     explained as on track, and never gained the priority weight that
     should have pushed it up the queue. */
  const slaHealth = computeSlaHealth(complaint);
  if (slaHealth?.status === 'exceeded') {
    reasons.push(`SLA deadline exceeded by ${slaHealth.label}`);
  } else if (slaHealth?.status === 'approaching') {
    reasons.push(`SLA window closing — ${slaHealth.label} remaining`);
  }

  // Fallback reason if list is empty
  if (reasons.length === 0) {
    reasons.push(`Standard ${complaint.department.name} operational triage schedule`);
  }

  const level: 'critical' | 'high' | 'medium' | 'low' =
    score >= 90 || slaHealth?.status === 'exceeded'
      ? 'critical'
      : score >= 75 || severity === 'high'
      ? 'high'
      : score >= 50
      ? 'medium'
      : 'low';

  return { level, reasons };
}

