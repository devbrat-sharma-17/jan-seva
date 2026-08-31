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
  | 'report_generated';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: AuditActorRole;
  /** Scope this event belongs to. Absent for city-wide admin actions. */
  departmentId?: DepartmentId;
  action: AuditAction;
  targetType: 'complaint' | 'department' | 'system';
  targetId: string;
  description: string;
  metadata?: Record<string, string>;
}

/** Who is asking, so the trail can be filtered to what they may see. */
export type AuditScope =
  | { role: 'admin' }
  | { role: 'department'; departmentId: DepartmentId };
