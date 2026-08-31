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

export interface PerformanceScoreBreakdown {
  totalScore: number;
  tier: 'star' | 'performing' | 'needs-attention' | 'critical';
  tierLabel: string;
  tierBadge: string;
  components: {
    resolutionRate: { score: number; max: number; label: string; value: string };
    slaCompliance: { score: number; max: number; label: string; value: string };
    resolutionSpeed: { score: number; max: number; label: string; value: string };
    citizenSatisfaction: { score: number; max: number; label: string; value: string };
    backlogControl: { score: number; max: number; label: string; value: string };
    escalationRate: { score: number; max: number; label: string; value: string };
  };
}

export interface PriorityExplanation {
  level: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
}
