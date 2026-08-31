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
    resolutionRate: PerformanceComponent;
    slaCompliance: PerformanceComponent;
    resolutionSpeed: PerformanceComponent;
    citizenSatisfaction: PerformanceComponent;
    backlogControl: PerformanceComponent;
    escalationRate: PerformanceComponent;
  };
}

export interface PriorityExplanation {
  level: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
}
