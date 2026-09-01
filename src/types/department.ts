// ============================================================
// Department Operations Types — JAN-SEVA Phase 4
// ============================================================

export type DepartmentId =
  | 'roads'
  | 'sanitation'
  | 'water'
  | 'electrical'
  | 'infrastructure';

export type DepartmentRole = 'head' | 'nodal' | 'field';

export interface DepartmentStaff {
  id: string;
  name: string;
  role: DepartmentRole;
  roleTitle: string;
  designation: string;
  email: string;
  phone: string;
  avatar?: string;
  division: string;
  team?: string;
  currentWorkload: number;
}

export interface DepartmentVisualMotif {
  accent: string;
  accentLight: string;
  accentBg: string;
  accentGlow: string;
  tagline: string;
  motifName: string;
  heroBgPattern: string;
}

export interface DepartmentConfig {
  id: DepartmentId;
  aiDeptId: string;
  name: string;
  shortName: string;
  hindiName: string;
  description: string;
  icon: string;
  categories: string[];
  divisions: string[];
  helpline: string;
  visual: DepartmentVisualMotif;
  mockStaff: DepartmentStaff[];
  mockTeams: string[];
  operationalKeywords: string[];
}

export interface DepartmentUser {
  id: string;
  staffId: string;
  name: string;
  email: string;
  role: DepartmentRole;
  roleTitle: string;
  designation: string;
  departmentId: DepartmentId;
  departmentName: string;
  division: string;
  team?: string;
  avatar?: string;
}

export interface DepartmentMetrics {
  totalReceived: number;
  active: number;
  pending: number;
  assigned: number;
  inProgress: number;
  resolutionSubmitted: number;
  resolved: number;
  citizenVerified: number;
  reinspectionRequested: number;
  slaAtRisk: number;
  slaBreached: number;
  escalated: number;
  unassigned: number;
  highPriority: number;
  criticalPriority: number;
  averageResolutionHours: number;
  resolutionRatePercent: number;
  slaCompliancePercent: number;
  citizenSatisfactionAverage: number;
  totalRatingsCount: number;
  backlogCount: number;

  // ----------------------------------------------------------
  // Outcome quality
  // ----------------------------------------------------------
  // Everything above measures how much was closed and how fast. Nothing
  // above measures whether the work HELD. A department that closes
  // everything in four hours with fake photos scores 100 on it.
  //
  // These are the inputs that make that impossible.

  /** Resolutions the citizen actually confirmed, over resolutions claimed. */
  citizenVerifiedRatePercent: number;
  /** Citizen-confirmed closures that later failed a durability check. */
  durabilityFailures: number;
  /** Durability checkpoints answered "still fixed". */
  durabilityHolding: number;
  /**
   * Percentage of answered durability checks that held. Null when none
   * have been answered — an unmeasured durability rate is reported as
   * unmeasured, never as 100%.
   */
  durabilityRatePercent: number | null;
  /** New complaints on an asset this department repaired recently. */
  repeatFailures: number;
  /** Repeat failures over resolutions. Null with nothing resolved. */
  repeatFailureRatePercent: number | null;
  /** Resolutions carrying at least one evidence photo. */
  resolutionsWithEvidence: number;
  /** Mean capture-integrity score, 0-100. Null when nothing was graded. */
  evidenceIntegrityPercent: number | null;
  /** Resolutions whose evidence was graded `disputed`. */
  disputedEvidenceCount: number;
  /** Independent re-inspections completed, and how many upheld the closure. */
  auditsCompleted: number;
  auditsUpheld: number;
  /**
   * Complaints per active officer. Normalises the backlog so a
   * department cannot win the ranking by handling less work.
   */
  workloadPerOfficer: number;
}

/** One scored dimension. `hasData` false means it was not measurable. */
export interface PerformanceComponent {
  score: number;
  max: number;
  label: string;
  value: string;
  hasData: boolean;
}

export interface PerformanceScoreBreakdown {
  totalScore: number;
  /**
   * `no-data` is a real outcome, not a failure. A department with no
   * complaints has no performance, and must not be shown a tier it did
   * not earn in either direction.
   */
  tier: 'star' | 'performing' | 'needs-attention' | 'critical' | 'no-data';
  tierLabel: string;
  tierBadge: string;
  /** Points on the 100-point scale that had data behind them. */
  dataCoverage: number;
  components: {
    citizenVerified: PerformanceComponent;
    durability: PerformanceComponent;
    repeatFailure: PerformanceComponent;
    evidenceIntegrity: PerformanceComponent;
    slaCompliance: PerformanceComponent;
    workloadBacklog: PerformanceComponent;
    resolutionSpeed: PerformanceComponent;
    citizenSatisfaction: PerformanceComponent;
  };
  /**
   * Why the score is what it is, in plain sentences.
   *
   * A number without reasons gets argued with; a number with reasons
   * gets acted on. Published alongside the score wherever it appears.
   */
  reasons: string[];
}

export interface PriorityExplanation {
  level: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
}
