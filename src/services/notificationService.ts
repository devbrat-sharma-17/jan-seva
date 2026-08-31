// ============================================================
// Notification Service — deduplicated operational alerts
// ============================================================
//
// Notifications are DERIVED from the complaint store, not accumulated.
// The old approach recomputed a fresh list on every render, each item
// with a new id, so read state never stuck and the same seven SLA
// breaches reappeared as new alerts on every navigation.
//
// Here, each alert gets a stable FINGERPRINT built from what it is
// about. The same condition always produces the same id, so:
//
//   - marking one read keeps it read across renders and reloads
//   - a condition that clears stops being reported
//   - a condition that recurs is the same alert, not a new one
//
// Only the read set is persisted. The alerts themselves are recomputed,
// which means they can never disagree with the records they describe.

import type { AdminNotification, AttentionSeverity } from '../types/admin';
import type { DepartmentId } from '../types/department';
import { getStoredComplaints, getDepartmentMetrics } from './complaintService';
import { computeSlaHealth } from './slaService';
import { calculatePerformanceScore } from './performanceService';
import { DEPARTMENTS } from '../data/departments';
import { readJSON, writeJSON, subscribeToKey } from './storage';

const READ_STORAGE_KEY = 'jan_seva_admin_notifications_read_v1';

const DEPARTMENT_IDS: DepartmentId[] = [
  'roads',
  'sanitation',
  'water',
  'electrical',
  'infrastructure',
];

/**
 * Stable id for a condition. Built from the alert's *subject*, never from
 * a timestamp or a counter, so the same situation always hashes to the
 * same notification.
 */
function fingerprint(parts: Array<string | number>): string {
  return parts.map((p) => String(p).toLowerCase().replace(/\s+/g, '-')).join(':');
}

function readReadSet(): Set<string> {
  const stored = readJSON<string[] | null>(READ_STORAGE_KEY, null);
  return new Set(Array.isArray(stored) ? stored : []);
}

function writeReadSet(ids: Set<string>): void {
  try {
    // Cap growth: read markers for conditions that no longer exist are
    // dead weight, and the store is shared with citizen photos.
    writeJSON(READ_STORAGE_KEY, Array.from(ids).slice(-200));
  } catch {
    // Read state is a convenience; losing it re-shows an alert at worst.
  }
}

/** Builds the current alert set from the records, newest concern first. */
export function getAdminNotifications(): AdminNotification[] {
  const complaints = getStoredComplaints();
  const now = Date.now();
  const read = readReadSet();
  const notifications: AdminNotification[] = [];

  // --- SLA breaches, aggregated per department -------------------------
  const breachedByDept = new Map<DepartmentId, number>();
  let criticalUnassigned = 0;
  let reinspectionCount = 0;
  let latestBreachAt = 0;

  for (const c of complaints) {
    if (c.status === 'resolved') {
      continue;
    }

    const deptId = (c.department.id || '') as DepartmentId;
    const health = computeSlaHealth(c, now);

    if (health?.status === 'exceeded' && DEPARTMENTS[deptId]) {
      breachedByDept.set(deptId, (breachedByDept.get(deptId) ?? 0) + 1);
      latestBreachAt = Math.max(latestBreachAt, new Date(c.updatedAt).getTime());
    }

    const severity = c.aiAnalysis?.severity;
    if ((severity === 'critical' || (c.aiAnalysis?.priorityScore ?? 0) >= 90) && !c.assignedOfficer?.name) {
      criticalUnassigned += 1;
    }

    if (c.feedback?.reinspectionRequested) reinspectionCount += 1;
  }

  for (const [deptId, count] of breachedByDept) {
    const dept = DEPARTMENTS[deptId];
    const id = fingerprint(['sla-breach', deptId, count]);
    notifications.push({
      id,
      type: 'sla_breach',
      severity: count >= 5 ? 'critical' : 'high',
      title: `${count} SLA ${count === 1 ? 'breach' : 'breaches'} in ${dept.shortName}`,
      message: `${count} complaint${count === 1 ? '' : 's'} past the resolution deadline.`,
      department: dept.name,
      departmentId: deptId,
      timestamp: new Date(latestBreachAt || now).toISOString(),
      read: read.has(id),
    });
  }

  if (criticalUnassigned > 0) {
    const id = fingerprint(['critical-unassigned', criticalUnassigned]);
    notifications.push({
      id,
      type: 'escalation',
      severity: 'critical',
      title: `${criticalUnassigned} critical ${criticalUnassigned === 1 ? 'complaint has' : 'complaints have'} no officer`,
      message: 'High-severity reports are waiting on an assignment.',
      timestamp: new Date(now).toISOString(),
      read: read.has(id),
    });
  }

  if (reinspectionCount > 0) {
    const id = fingerprint(['reinspection', reinspectionCount]);
    notifications.push({
      id,
      type: 'feedback',
      severity: 'medium',
      title: `${reinspectionCount} reinspection ${reinspectionCount === 1 ? 'request' : 'requests'}`,
      message: 'Citizens have asked for work to be looked at again.',
      timestamp: new Date(now).toISOString(),
      read: read.has(id),
    });
  }

  // --- Department standing ---------------------------------------------
  for (const deptId of DEPARTMENT_IDS) {
    const metrics = getDepartmentMetrics(deptId);
    if (metrics.totalReceived === 0) continue;

    const score = calculatePerformanceScore(metrics);
    const dept = DEPARTMENTS[deptId];

    if (score.tier === 'critical' || score.tier === 'needs-attention') {
      const id = fingerprint(['performance', deptId, score.tier]);
      notifications.push({
        id,
        type: 'performance_drop',
        severity: score.tier === 'critical' ? ('high' as AttentionSeverity) : 'medium',
        title: `${dept.shortName} performance is ${score.tierLabel.toLowerCase()}`,
        message: `Score ${score.totalScore}/100 · ${metrics.slaCompliancePercent}% SLA compliance.`,
        department: dept.name,
        departmentId: deptId,
        timestamp: new Date(now).toISOString(),
        read: read.has(id),
      });
    }

    if (score.tier === 'star') {
      const id = fingerprint(['recognition', deptId]);
      notifications.push({
        id,
        type: 'recognition',
        severity: 'low',
        title: `${dept.shortName} reached star department`,
        message: `Score ${score.totalScore}/100 across resolution, SLA and satisfaction.`,
        department: dept.name,
        departmentId: deptId,
        timestamp: new Date(now).toISOString(),
        read: read.has(id),
      });
    }
  }

  const severityOrder: Record<AttentionSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return notifications.sort((a, b) => {
    // Unread first, then by urgency: a read critical should not outrank
    // a new one just because it is more severe.
    if (a.read !== b.read) return a.read ? 1 : -1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getUnreadNotificationCount(): number {
  return getAdminNotifications().filter((n) => !n.read).length;
}

export function markNotificationRead(id: string): void {
  const read = readReadSet();
  read.add(id);
  writeReadSet(read);
}

export function markAllNotificationsRead(): void {
  const read = readReadSet();
  getAdminNotifications().forEach((n) => read.add(n.id));
  writeReadSet(read);
}

export function markNotificationUnread(id: string): void {
  const read = readReadSet();
  read.delete(id);
  writeReadSet(read);
}

/** Read state changes in this tab and others. */
export function subscribeToNotificationReadState(onChange: () => void): () => void {
  return subscribeToKey(READ_STORAGE_KEY, onChange);
}
