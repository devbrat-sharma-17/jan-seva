// ============================================================
// Admin Command Center Types — JAN-SEVA Phase 5
// ============================================================
// These types are specific to the Admin Portal. They never duplicate
// Complaint or DepartmentMetrics — they extend or compose them.

import type { DepartmentId } from './department';

// ------------------------------------------------------------
// Admin User
// ------------------------------------------------------------

export type AdminRole = 'super_admin' | 'city_admin' | 'commissioner' | 'analyst' | 'auditor';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleTitle: string;
  city: string;
  cityId: string;
  avatar?: string;
  /** Permissions determine what the admin can see/do. */
  permissions: AdminPermissions;
}

export interface AdminPermissions {
  /** Can view masked citizen identity info (never raw Aadhaar). */
  viewCitizenIdentity: boolean;
  /** Can reassign complaints across departments. */
  reassignDepartment: boolean;
  /** Can trigger manual escalations. */
  manualEscalate: boolean;
  /** Can view the full audit trail. */
  viewAuditTrail: boolean;
  /** Can view performance analytics and department comparisons. */
  viewPerformance: boolean;
  /** Can manage civic initiatives. */
  manageInitiatives: boolean;
  /** Can generate and download reports. */
  generateReports: boolean;
}

// ------------------------------------------------------------
// City Health Score — configurable weighted composite
// ------------------------------------------------------------

export interface CivicHealthWeights {
  departmentPerformance: number;  // e.g. 0.25
  slaCompliance: number;         // e.g. 0.25
  resolutionRate: number;        // e.g. 0.20
  citizenSatisfaction: number;   // e.g. 0.15
  backlogControl: number;        // e.g. 0.10
  escalationControl: number;     // e.g. 0.05
  // Weights must sum to 1.0
}

export type CivicHealthTier = 'excellent' | 'good' | 'fair' | 'poor';

export interface CivicHealthScore {
  totalScore: number;   // 0–100
  tier: CivicHealthTier;
  tierLabel: string;
  tierBadge: string;
  components: {
    departmentPerformance: { score: number; max: number; label: string; value: string };
    slaCompliance: { score: number; max: number; label: string; value: string };
    resolutionRate: { score: number; max: number; label: string; value: string };
    citizenSatisfaction: { score: number; max: number; label: string; value: string };
    backlogControl: { score: number; max: number; label: string; value: string };
    escalationControl: { score: number; max: number; label: string; value: string };
  };
}

// ------------------------------------------------------------
// City Overview KPIs
// ------------------------------------------------------------

export interface CityOverviewKPIs {
  totalComplaints: number;
  activeComplaints: number;
  resolvedComplaints: number;
  escalatedComplaints: number;
  slaCompliancePercent: number;
  citizenSatisfactionAverage: number;
  averageResolutionHours: number;
  /** New: resolutions pending citizen verification — a distinct KPI. */
  pendingCitizenVerification: number;
  /** New: resolution verification rate. */
  resolutionVerificationRate: number;
}

// ------------------------------------------------------------
// Needs Attention — severity & action priority
// ------------------------------------------------------------

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  /** Numeric priority for sorting — lower = more urgent. */
  actionPriority: number;
  title: string;
  description: string;
  department?: string;
  departmentId?: DepartmentId;
  affectedCount?: number;
  timestamp: string;
  /** Route to drill into this issue. */
  drillDownPath?: string;
}

// ------------------------------------------------------------
// Department Ranking — always includes reasons
// ------------------------------------------------------------

export interface DepartmentRanking {
  departmentId: DepartmentId;
  departmentName: string;
  shortName: string;
  icon: string;
  accent: string;
  rank: number;
  performanceScore: number;
  tier: 'star' | 'performing' | 'needs-attention' | 'critical';
  tierLabel: string;
  tierBadge: string;
  resolutionRate: number;
  slaCompliance: number;
  citizenSatisfaction: number;
  averageResolutionHours: number;
  backlogCount: number;
  escalations: number;
  pendingVerification: number;
  /** Why this department has its current score / ranking. */
  reasons: string[];
  /** Positive recognition flags. */
  recognitions: string[];
  /** Trend: positive = improving, negative = declining. */
  trend: 'improving' | 'stable' | 'declining';
}

// ------------------------------------------------------------
// Civic Hotspot
// ------------------------------------------------------------

export interface CivicHotspot {
  id: string;
  locality: string;
  latitude: number;
  longitude: number;
  complaintCount: number;
  topCategory: string;
  topCategoryTitle: string;
  highPriorityCount: number;
  slaBreachedCount: number;
  averageResolutionHours: number;
  departments: string[];
}

// ------------------------------------------------------------
// Feedback Summary
// ------------------------------------------------------------

export interface FeedbackSummary {
  overallRating: number;
  totalRatings: number;
  positive: number;  // 4-5 stars
  neutral: number;   // 3 stars
  negative: number;  // 1-2 stars
  resolutionVerificationRate: number;
  totalResolved: number;
  citizenVerified: number;
  awaitingVerification: number;
  reinspectionRequested: number;
  departmentBreakdown: Array<{
    departmentId: DepartmentId;
    departmentName: string;
    rating: number;
    totalRatings: number;
  }>;
  themes: FeedbackTheme[];
}

export interface FeedbackTheme {
  id: string;
  label: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  count: number;
  icon: string;
}

// ------------------------------------------------------------
// Escalation Summary
// ------------------------------------------------------------

export interface EscalationSummary {
  slaAtRisk: number;
  slaBreached: number;
  escalated: number;
  reinspectionRequested: number;
}

// ------------------------------------------------------------
// Admin Audit Trail — SEPARATE from citizen timeline
// ------------------------------------------------------------

export interface AdminAuditEvent {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  action: AdminAuditAction;
  targetType: 'complaint' | 'department' | 'system';
  targetId: string;
  description: string;
  metadata?: Record<string, string>;
}

export type AdminAuditAction =
  | 'department_reassign'
  | 'manual_escalation'
  | 'priority_override'
  | 'sla_review'
  | 'note_added'
  | 'complaint_viewed'
  | 'report_generated';

// ------------------------------------------------------------
// Admin Notifications
// ------------------------------------------------------------

export interface AdminNotification {
  id: string;
  type: 'sla_breach' | 'performance_drop' | 'escalation' | 'recognition' | 'feedback' | 'system';
  severity: AttentionSeverity;
  title: string;
  message: string;
  department?: string;
  departmentId?: DepartmentId;
  timestamp: string;
  read: boolean;
}

// ------------------------------------------------------------
// Trend Data — derived from shared complaint/timeline data
// ------------------------------------------------------------

export interface TrendDataPoint {
  label: string;       // e.g. "Mon", "Week 1", "Jan"
  timestamp: string;   // ISO for tooltips
  value: number;
}

export interface TrendSeries {
  id: string;
  label: string;
  color: string;
  data: TrendDataPoint[];
}

export type TrendPeriod = '7d' | '30d' | '90d';

// ------------------------------------------------------------
// Admin Complaint Filters
// ------------------------------------------------------------

export interface AdminComplaintFilters {
  department?: DepartmentId;
  status?: string;
  priority?: string;
  category?: string;
  locality?: string;
  slaStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ------------------------------------------------------------
// Initiatives (demo)
// ------------------------------------------------------------

export interface AdminInitiative {
  id: string;
  title: string;
  department: DepartmentId;
  description: string;
  status: 'planned' | 'active' | 'completed';
  startDate: string;
  targetDate?: string;
  progress: number; // 0–100
  relatedComplaints: number;
  location: string;
}
