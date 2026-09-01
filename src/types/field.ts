// ============================================================
// Field Operations Types — work cards, escalation ladder, wards
// ============================================================

import type { DepartmentId } from './department';

// ------------------------------------------------------------
// One-Trip Work Card
// ------------------------------------------------------------
//
// Municipal field capacity is the binding constraint in an Indian city —
// not complaint volume, and certainly not dashboards. A crew that drives
// across Gwalior for one pothole and back has burned a day.
//
// Chicago CDOT has run this for years: a daily map of 311-reported
// potholes, routes computed so each crew fills the most possible, and
// crews fill every pothole on the block once they have arrived.
//
// This is a greedy nearest-neighbour heuristic over straight-line
// distance. It is NOT "AI optimisation" and is not described as such
// anywhere in the UI — saying what it actually is reads as more credible,
// not less.

export type WorkCardStatus = 'draft' | 'dispatched' | 'in-progress' | 'completed';

export interface WorkCardStop {
  sequence: number;
  complaintId: string;
  title: string;
  category: string;
  locality: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  /** Straight-line metres from the previous stop (0 for the first). */
  legMetres: number;
  /** Travel + on-site minutes budgeted for this stop. */
  estimatedMinutes: number;
  /** SLA health at the time the card was built. */
  slaStatus: 'normal' | 'approaching' | 'exceeded' | 'met';
  slaLabel: string;
  priorityScore: number;
  /** What the crew must photograph here, so the trip is not wasted. */
  captureRequirement: string;
  assetId?: string;
  /** True when this asset has failed before — the crew should know. */
  isRepeatFailure: boolean;
  completedAt?: string;
}

export interface WorkCard {
  id: string;
  departmentId: DepartmentId;
  /** ISO date (yyyy-mm-dd) the card is for. */
  forDate: string;
  createdAt: string;
  /** Crew or officer the card is dispatched to. */
  assignedTo?: string;
  assignedStaffId?: string;
  status: WorkCardStatus;
  stops: WorkCardStop[];
  totalDistanceMetres: number;
  estimatedMinutes: number;
  /** Straight-line metres if each stop were driven separately from base. */
  naiveDistanceMetres: number;
  /** Metres saved against one-trip-per-complaint dispatch. */
  savedMetres: number;
  /** Skill / category grouping this card covers. */
  skill: string;
  startsFrom: { latitude: number; longitude: number; label: string };
}

// ------------------------------------------------------------
// Escalation ladder
// ------------------------------------------------------------
//
// `escalatedTo: 'Municipal Commissioner & Department Head'` was a string.
// Nobody's queue grew, and nobody was accountable for the escalation
// itself. A level is a post with its own clock and its own backlog.

export interface EscalationPost {
  level: number;
  /** The post, not the person. Posts outlive postings. */
  postTitle: string;
  shortTitle: string;
  /** Hours this post has to act before the next level engages. */
  responseHours: number;
  /**
   * Whether this level's backlog may be shown outside the Command Centre.
   * Naming a serving officer's backlog publicly is politically fraught
   * enough to block adoption, so it is a per-city configuration decision
   * rather than a default.
   */
  publiclyVisible: boolean;
}

export interface EscalationQueueState {
  post: EscalationPost;
  openCount: number;
  /** Age of the oldest item in this queue, in hours. Null when empty. */
  oldestHours: number | null;
  /** Items in this queue past the post's own response window. */
  overdueCount: number;
  complaintIds: string[];
}

// ------------------------------------------------------------
// Ward Reality Index
// ------------------------------------------------------------
//
// Complaint-driven service allocation systematically over-serves the
// areas most able to complain. In an Indian city that maps closely onto
// income, literacy and smartphone access.
//
// `getCivicHotspots` sorted localities by raw complaint count and
// presented that as intelligence. It is the biased metric.
//
//   This index is ILLUSTRATIVE, and the UI says so. Without real
//   ward-level covariates it is a demonstration of the correction, not a
//   measurement. Building it wrong and presenting it confidently is worse
//   than not building it at all.

export interface WardProfile {
  id: string;
  name: string;
  zone: string;
  /** Census-scale figure. Seeded, and labelled as an estimate in the UI. */
  population: number;
  /** 0-1 estimated smartphone + data access. Drives reporting propensity. */
  connectivityIndex: number;
  /** 0-1 literacy proxy. */
  literacyIndex: number;
  centroid: { latitude: number; longitude: number };
  localities: string[];
}

export interface WardReality {
  ward: WardProfile;
  /** What was actually reported. The number every dashboard shows. */
  observedComplaints: number;
  /** What this ward would report at the city's average propensity. */
  expectedComplaints: number;
  /** observed / expected. Below 1 means the ward is under-reporting. */
  reportingRatio: number;
  /** 0-1 estimate of how likely this ward is to report a given problem. */
  propensity: number;
  /**
   * `silent` is the finding nobody builds a screen for: an area reporting
   * far below expectation is an attention item, not good performance.
   */
  signal: 'over-reported' | 'expected' | 'under-reported' | 'silent';
  /** Plain-language reading of the row, shown next to the number. */
  interpretation: string;
  resolvedCount: number;
  slaBreachedCount: number;
}
