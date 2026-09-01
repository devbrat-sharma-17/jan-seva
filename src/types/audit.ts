// ============================================================
// Audit Trail Types
// ============================================================
// The audit trail is an INTERNAL accountability record. It is a separate
// thing from the citizen-facing complaint timeline:
//
//   Complaint timeline  what happened, written for the citizen
//   Audit trail         who did it, written for oversight
//
// A citizen never sees an audit event. A department sees only its own
// department's events. An administrator sees the city.

import type { DepartmentId } from './department';

export type AuditActorRole =
  | 'admin'
  | 'department_head'
  | 'department_nodal'
  | 'department_field'
  | 'system';

export type AuditAction =
  // Department operations
  | 'complaint_assigned'
  | 'complaint_reassigned_officer'
  | 'work_started'
  | 'progress_update_added'
  | 'evidence_added'
  | 'resolution_submitted'
  | 'reinspection_accepted'
  // Administrative operations
  | 'department_reassign'
  | 'manual_escalation'
  | 'priority_override'
  | 'complaint_reopened'
  | 'sla_review'
  | 'note_added'
  | 'complaint_viewed'
  | 'report_generated'
  // Screening & moderation (spec §36). Deliberately in the SAME trail as
  // everything else: "who reviewed this citizen's report and why" is an
  // oversight question of exactly the kind this record exists to answer,
  // and a separate moderation log would be the one nobody audits.
  | 'screening_case_opened'
  | 'screening_case_claimed'
  | 'screening_unavailable'
  | 'submission_blocked_pre_submit'
  | 'moderation_decision'
  | 'citizen_warning_recorded'
  | 'abuse_restriction_applied'
  | 'abuse_restriction_cleared';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: AuditActorRole;
  /** Scope this event belongs to. Absent for city-wide admin actions. */
  departmentId?: DepartmentId;
  action: AuditAction;
  // 'citizen' targets carry an opaque identity reference, never a name,
  // a number or an Aadhaar value.
  targetType: 'complaint' | 'department' | 'system' | 'citizen';
  targetId: string;
  description: string;
  metadata?: Record<string, string>;
}

/** Who is asking, so the trail can be filtered to what they may see. */
export type AuditScope =
  | { role: 'admin' }
  | { role: 'department'; departmentId: DepartmentId };
