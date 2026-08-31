// ============================================================
// Actor Context — who is performing a mutation
// ============================================================
//
// Every portal mutation needs to know who is acting, for two reasons:
// authorising the operation, and attributing it in the audit trail.
//
// The actor is derived from the SESSION, never from an argument a
// component passes in. A caller that could name its own actor could
// name someone else's, and the audit trail would record a fiction.

import type { DepartmentId, DepartmentRole } from '../types/department';
import type { AuditActor } from './auditService';
import { departmentActorRole } from './auditService';
import { getSession } from './sessionService';
import { DEPARTMENTS } from '../data/departments';
import { getDemoAdminAccount } from '../data/demoDirectory';

export interface OperationActor {
  userId: string;
  /** Display name, for timeline attribution. */
  name: string;
  role: 'admin' | 'department';
  departmentId?: DepartmentId;
  departmentRole?: DepartmentRole;
  /** Job title, for timeline copy such as "Assigned by Nodal Officer". */
  roleTitle: string;
}

/** The acting user, or null when there is no valid session. */
export function resolveOperationActor(): OperationActor | null {
  const session = getSession();
  if (!session) return null;

  if (session.role === 'admin') {
    const account = getDemoAdminAccount();
    return {
      userId: session.userId,
      name: account.displayName,
      role: 'admin',
      roleTitle: 'City Administrator',
    };
  }

  if (!session.departmentId) return null;
  const dept = DEPARTMENTS[session.departmentId];
  if (!dept) return null;

  const staff =
    dept.mockStaff.find((s) => s.id === session.accountId) ??
    dept.mockStaff.find((s) => s.role === session.departmentRole) ??
    dept.mockStaff[0];

  return {
    userId: session.userId,
    name: staff.name,
    role: 'department',
    departmentId: dept.id,
    departmentRole: staff.role,
    roleTitle: staff.roleTitle,
  };
}

/** Projects an actor into the shape the audit trail records. */
export function toAuditActor(actor: OperationActor): AuditActor {
  return {
    id: actor.userId,
    name: actor.name,
    role: actor.role === 'admin' ? 'admin' : departmentActorRole(actor.departmentRole ?? 'nodal'),
    departmentId: actor.departmentId,
  };
}
