// ============================================================
// Audit Service — internal accountability trail
// ============================================================
//
// One trail for every operationally meaningful action taken inside the
// portals, by anyone. Recorded by the service layer at the point of
// mutation, not by components, so an action cannot reach the store
// without leaving a record.
//
// Privacy: an audit entry records WHO acted on WHICH complaint and WHY.
// It never copies citizen identity, contact details, photos or the raw
// report text. Descriptions are written on the assumption an auditor
// unrelated to the complaint will read them.

import type { AuditAction, AuditActorRole, AuditEvent, AuditScope } from '../types/audit';
import type { DepartmentId, DepartmentRole } from '../types/department';
import { readJSON, writeJSON, subscribeToKey } from './storage';

const AUDIT_STORAGE_KEY = 'jan_seva_audit_trail_v2';

/**
 * Trail cap. A demo store shares a ~5 MB budget with complaint photos,
 * and an unbounded log would eventually cost a citizen their submission.
 * Oldest entries are dropped first.
 */
const MAX_EVENTS = 400;

function readTrail(): AuditEvent[] {
  const stored = readJSON<AuditEvent[] | null>(AUDIT_STORAGE_KEY, null);
  return Array.isArray(stored) ? stored : [];
}

function writeTrail(events: AuditEvent[]): void {
  try {
    writeJSON(AUDIT_STORAGE_KEY, events.slice(0, MAX_EVENTS));
  } catch {
    // Never let a full store block the mutation the audit describes.
  }
}

export interface AuditActor {
  id: string;
  name: string;
  role: AuditActorRole;
  departmentId?: DepartmentId;
}

/** Maps a department portal role onto its audit actor role. */
export function departmentActorRole(role: DepartmentRole): AuditActorRole {
  if (role === 'head') return 'department_head';
  if (role === 'field') return 'department_field';
  return 'department_nodal';
}

export interface RecordAuditInput {
  actor: AuditActor;
  action: AuditAction;
  targetType: AuditEvent['targetType'];
  targetId: string;
  description: string;
  metadata?: Record<string, string>;
}

export function recordAuditEvent(input: RecordAuditInput): AuditEvent {
  const event: AuditEvent = {
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    departmentId: input.actor.departmentId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    description: input.description,
    metadata: input.metadata,
  };

  // Newest first: every reader wants the recent end.
  writeTrail([event, ...readTrail()]);
  return event;
}

/**
 * The trail, filtered to what the asking scope may see.
 *
 * A department gets its own events plus the city-wide administrative
 * actions taken *on its complaints* — an officer needs to know their
 * complaint was reassigned away, but not what happened in Sanitation.
 */
export function getAuditTrail(scope: AuditScope, limit = 50): AuditEvent[] {
  const all = readTrail();

  if (scope.role === 'admin') return all.slice(0, limit);

  return all
    .filter((evt) => evt.departmentId === scope.departmentId)
    .slice(0, limit);
}

/** Every recorded action against one complaint, within the asker's scope. */
export function getAuditTrailForComplaint(
  complaintId: string,
  scope: AuditScope
): AuditEvent[] {
  const upper = complaintId.toUpperCase();

  return readTrail().filter((evt) => {
    if (evt.targetType !== 'complaint') return false;
    if (evt.targetId.toUpperCase() !== upper) return false;
    if (scope.role === 'admin') return true;
    // Administrative actions carry no department, but they are recorded
    // against this department's complaint, so its staff may see them.
    return !evt.departmentId || evt.departmentId === scope.departmentId;
  });
}

export function subscribeToAuditTrail(onChange: () => void): () => void {
  return subscribeToKey(AUDIT_STORAGE_KEY, onChange);
}

/** Readable label for an action, so no screen renders a raw enum. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  complaint_assigned: 'Assigned',
  complaint_reassigned_officer: 'Officer changed',
  work_started: 'Work started',
  progress_update_added: 'Progress update',
  evidence_added: 'Evidence added',
  resolution_submitted: 'Resolution submitted',
  reinspection_accepted: 'Reinspection accepted',
  department_reassign: 'Department reassigned',
  manual_escalation: 'Manually escalated',
  priority_override: 'Priority overridden',
  complaint_reopened: 'Reopened',
  sla_review: 'SLA reviewed',
  note_added: 'Note added',
  complaint_viewed: 'Record opened',
  report_generated: 'Report generated',
  screening_case_opened: 'Flagged for review',
  screening_case_claimed: 'Review started',
  screening_unavailable: 'Screening unavailable',
  submission_blocked_pre_submit: 'Submission blocked before filing',
  moderation_decision: 'Moderation decision',
  citizen_warning_recorded: 'Citizen warning recorded',
  abuse_restriction_applied: 'Restriction applied',
  abuse_restriction_cleared: 'Restriction lifted',
};
