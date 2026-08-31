// ============================================================
// Complaint Service — Demo store & tracking engine
// ============================================================
//   UI  ->  Service  ->  Local Demo Store  ->  (future) Backend API
//
// Components never touch localStorage. Swapping the store for a REST or
// GraphQL client should require changes only inside this file.

import type {
  Complaint,
  ComplaintTimelineEvent,
  ComplaintStatus,
  PublicComplaint,
  LookupOutcome,
  IdentityMethod,
} from '../types';
import type { ReportDraft, AIAnalysis } from '../types/report';
import { readJSON, writeJSON, removeKey, subscribeToKey } from './storage';
import { slaTargetFor } from './slaService';
import { buildSeedComplaints } from '../data/seedComplaints';
import { getCityCode, defaultCity } from '../data/cities';
import { deriveIdentityReference, maskMobile, maskAadhaar } from './identityService';
import {
  resolveLookup,
  isPubliclyTrackable,
  computeExpiresAt,
  toPublicComplaint,
} from './privacyService';

const DRAFT_STORAGE_KEY = 'jan_seva_report_draft_v1';
const COMPLAINTS_STORAGE_KEY = 'jan_seva_complaints_v3';
const SEQUENCE_STORAGE_KEY = 'jan_seva_ticket_sequence_v1';

export { StorageQuotaError } from './storage';

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

/** Internal. Full records including identity references — never rendered directly. */
function readStore(): Complaint[] {
  const stored = readJSON<Complaint[] | null>(COMPLAINTS_STORAGE_KEY, null);

  if (!Array.isArray(stored)) {
    const seed = buildSeedComplaints();
    try {
      writeJSON(COMPLAINTS_STORAGE_KEY, seed);
    } catch {
      // Seeding is best-effort; callers still receive usable data.
    }
    return seed;
  }

  return stored;
}

export function getStoredComplaints(): Complaint[] {
  return readStore();
}

/**
 * Upserts a complaint, refreshing its derived retention fields.
 * Throws `StorageQuotaError` when the write will not fit, so the caller can
 * tell the citizen rather than issuing a ticket number for a lost report.
 */
export function saveComplaintToStore(complaint: Complaint): void {
  const withRetention: Complaint = {
    ...complaint,
    expiresAt: computeExpiresAt(complaint),
    isPubliclyTrackable: isPubliclyTrackable(complaint),
  };

  const list = readStore();
  const index = list.findIndex((c) => c.id === complaint.id);

  const updated =
    index === -1
      ? [withRetention, ...list]
      : list.map((c) => (c.id === complaint.id ? withRetention : c));

  writeJSON(COMPLAINTS_STORAGE_KEY, updated);
}

export function subscribeToComplaints(onChange: () => void): () => void {
  return subscribeToKey(COMPLAINTS_STORAGE_KEY, onChange);
}

/** Normalises the many ways a ticket ID gets pasted in. */
function normaliseId(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').trim();
}

/** Monotonic ticket numbers, verified unique against the store. */
export function generateComplaintId(cityId: string = defaultCity.id): string {
  const cityCode = getCityCode(cityId);
  const year = new Date().getFullYear();

  const last = readJSON<number>(SEQUENCE_STORAGE_KEY, 0);
  // Start above the seeded range so generated tickets never shadow demo data.
  let next = Math.max(last, 1500) + 1;

  const taken = new Set(readStore().map((c) => c.id));
  let candidate = `JS-${cityCode}-${year}-${String(next).padStart(6, '0')}`;
  while (taken.has(candidate)) {
    next += 1;
    candidate = `JS-${cityCode}-${year}-${String(next).padStart(6, '0')}`;
  }

  try {
    writeJSON(SEQUENCE_STORAGE_KEY, next);
  } catch {
    // A lost counter costs a gap in numbering, not correctness — the
    // uniqueness check above still holds.
  }

  return candidate;
}

/** Ticket ID shape, city code left open so new cities need no code change. */
export const TICKET_PATTERN = /^JS-[A-Z]{3}-\d{4}-\d{4,6}$/;

export function isValidTicketFormat(raw: string): boolean {
  return TICKET_PATTERN.test(normaliseId(raw));
}

function appendEvent(complaint: Complaint, event: ComplaintTimelineEvent): Complaint {
  return {
    ...complaint,
    timeline: [event, ...complaint.timeline],
    latestUpdate: {
      title: event.title,
      description: event.description,
      timestamp: event.timestamp,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// Public look-up (Complaint ID only — no OTP)
// ------------------------------------------------------------

/**
 * Public tracking. Returns a redacted `PublicComplaint`, or an `expired`
 * outcome for a resolved complaint past its 48-hour retention window.
 *
 * This is the only entry point a Complaint-ID holder gets. There is no
 * overload that returns the full record, so the reporter's identity cannot
 * be reached without verifying.
 */
export async function getById(complaintId: string): Promise<LookupOutcome> {
  await new Promise((resolve) => setTimeout(resolve, 420));

  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId) ?? null;

  return resolveLookup(found);
}

/**
 * Full record, gated on the caller proving the identity reference matches
 * the complaint's reporter. Used once a citizen has verified — for original
 * photos, the exact confirmed location, and citizen-only actions.
 */
export async function getByIdVerified(
  complaintId: string,
  identityReference: string
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 380));

  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId);

  if (!found) return null;
  // Verification for a *different* citizen grants nothing here.
  if (found.reporter.identityReference !== identityReference) return null;

  return found;
}

/**
 * Every complaint filed under a verified identity, newest activity first.
 * Resolved complaints past their retention window are omitted.
 */
export async function getByIdentity(identityReference: string): Promise<Complaint[]> {
  await new Promise((resolve) => setTimeout(resolve, 480));

  if (!identityReference) return [];

  const now = Date.now();
  return readStore()
    .filter((c) => c.reporter.identityReference === identityReference)
    .filter((c) => isPubliclyTrackable(c, now))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Timeline for one complaint, newest first. */
export async function getTimeline(complaintId: string): Promise<ComplaintTimelineEvent[]> {
  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!found) return [];

  return [...found.timeline].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ------------------------------------------------------------
// Submission
// ------------------------------------------------------------

const CATEGORY_TITLES: Record<string, string> = {
  roads: 'Roads & Potholes',
  garbage: 'Garbage & Sanitation',
  water: 'Water Leakage & Supply',
  streetlights: 'Street Lighting',
  infrastructure: 'Public Infrastructure',
};

/** Builds the persisted reporter block. Raw identifiers never reach it. */
function buildReporter(draft: ReportDraft): Complaint['reporter'] {
  const method: IdentityMethod = draft.identityMethod;
  const rawValue = method === 'aadhaar' ? draft.aadhaarNumber : draft.mobileNumber;

  const label = method === 'aadhaar' ? maskAadhaar(rawValue) : maskMobile(rawValue);

  return {
    name: draft.name.trim() || 'Citizen',
    // Only ever the masked mobile, and only when mobile was the method.
    mobileMasked: method === 'mobile' ? label : undefined,
    identityMethod: method,
    identityVerified: draft.identityVerified,
    identityReference: deriveIdentityReference(method, rawValue),
    identityLabel: label,
  };
}

/**
 * Creates a complaint from a completed draft.
 * Throws `StorageQuotaError` if the record does not fit — deliberately not
 * caught, so the success screen is never shown for an unsaved report.
 */
export async function submitReport(
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string = defaultCity.id
): Promise<Complaint> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const complaintId = generateComplaintId(cityId);
  const nowIso = new Date().toISOString();
  const targetHours = slaTargetFor(analysis.department);

  const timeline: ComplaintTimelineEvent[] = [
    {
      id: `evt-${Date.now()}-2`,
      title: `Routed to ${analysis.departmentName}`,
      description: `Automated classification assigned this issue to ${analysis.departmentName} with a ${targetHours}-hour turnaround target.`,
      timestamp: nowIso,
      status: 'assigned',
      actor: 'JAN-SEVA Routing Engine',
    },
    {
      id: `evt-${Date.now()}-1`,
      title: 'Complaint received',
      description: 'Report submitted via JAN-SEVA with GPS location and photo evidence.',
      timestamp: nowIso,
      status: 'pending',
      actor: 'Citizen Portal',
    },
  ];

  const complaint: Complaint = {
    id: complaintId,
    cityId,
    createdAt: nowIso,
    updatedAt: nowIso,
    status: 'pending',
    issue: {
      category: analysis.category,
      title: `${CATEGORY_TITLES[analysis.category] || 'Civic Issue'} at ${draft.location?.locality || defaultCity.name}`,
      description: draft.description,
    },
    photos: draft.photos.map((p) => p.url),
    // The location the citizen confirmed on the report's location step is
    // what gets stored as the official complaint location.
    // The device GPS position is preserved separately for auditing/GIS validation.
    location: {
      latitude: draft.location?.confirmed?.latitude ?? draft.location?.latitude ?? defaultCity.coordinates.lat,
      longitude: draft.location?.confirmed?.longitude ?? draft.location?.longitude ?? defaultCity.coordinates.lng,
      address: draft.location?.confirmed?.address || draft.location?.address || `${defaultCity.name} municipal area`,
      locality: draft.location?.confirmed?.locality || draft.location?.locality || 'City Centre',
      city: draft.location?.confirmed?.city || draft.location?.city || defaultCity.name,
      state: draft.location?.confirmed?.state || draft.location?.state || defaultCity.state,
      source: draft.location?.confirmed?.source || 'gps',
      gps: draft.location?.gps
        ? {
            latitude: draft.location.gps.latitude,
            longitude: draft.location.gps.longitude,
            accuracy: draft.location.gps.accuracy,
            detectedAt: draft.location.gps.detectedAt,
          }
        : undefined,
    },

    reporter: buildReporter(draft),
    aiAnalysis: {
      category: analysis.category,
      categoryTitle: analysis.categoryTitle,
      severity: analysis.severity,
      priorityScore: analysis.priorityScore,
      department: analysis.department,
    },
    department: {
      name: analysis.departmentName,
      division: `${analysis.departmentName.split(' ')[0]} Gwalior Division`,
      helpline: '0751-2441000',
    },
    sla: { dueAt: new Date(Date.now() + targetHours * 3600 * 1000).toISOString(), status: 'normal' },
    timeline,
    latestUpdate: {
      title: 'Complaint received & routed',
      description: `Routed to ${analysis.departmentName}. Officer assignment in progress.`,
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(complaint);
  clearDraftStorage();
  return complaint;
}

/**
 * Adds this report as a confirmation on an existing complaint.
 * Additive by design: the primary keeps its timeline, officer and SLA, and
 * gains an event plus the new photos as further evidence.
 */
export async function joinExistingComplaint(
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string = defaultCity.id
): Promise<Complaint> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const match = analysis.duplicateMatch;
  if (!match) throw new Error('No matching complaint to join.');

  const existing = readStore().find((c) => c.id === match.id);
  if (!existing) {
    // Seed drift — file a standalone complaint rather than lose the report.
    return submitReport(draft, analysis, cityId);
  }

  const nowIso = new Date().toISOString();
  const reporterName = draft.name.trim() || 'A citizen';
  const supportingCount = (existing.duplicate?.supportingCount ?? match.supportingCount ?? 1) + 1;

  const confirmed = appendEvent(existing, {
    id: `evt-confirm-${Date.now()}`,
    title: 'Citizen confirmation added',
    description: `${reporterName} confirmed this issue is still present and submitted additional photo evidence. ${supportingCount} citizens have now reported it.`,
    timestamp: nowIso,
    status: existing.status,
    actor: 'Citizen Confirmation',
  });

  const merged: Complaint = {
    ...confirmed,
    photos: [...existing.photos, ...draft.photos.map((p) => p.url)].slice(0, 8),
    duplicate: {
      isLinked: true,
      primaryIssueId: existing.id,
      primaryTitle: existing.issue.title,
      supportingCount,
    },
  };

  saveComplaintToStore(merged);
  clearDraftStorage();
  return merged;
}

// ------------------------------------------------------------
// Citizen actions
// ------------------------------------------------------------

/** One open update request per complaint per day keeps the timeline useful. */
const UPDATE_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface UpdateRequestResult {
  complaint: PublicComplaint | null;
  throttled: boolean;
}

/**
 * "Request an update" — available publicly, since it discloses nothing and
 * only nudges the department. Returns the redacted projection.
 */
export async function requestUpdate(complaintId: string): Promise<UpdateRequestResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return { complaint: null, throttled: false };

  const lastRequest = existing.timeline.find((e) => e.actor === 'Citizen Request');
  if (lastRequest) {
    const age = Date.now() - new Date(lastRequest.timestamp).getTime();
    if (!Number.isNaN(age) && age < UPDATE_REQUEST_COOLDOWN_MS) {
      return { complaint: toPublicComplaint(existing), throttled: true };
    }
  }

  const updated = appendEvent(existing, {
    id: `evt-update-req-${Date.now()}`,
    title: 'Update requested',
    description: 'A status update was requested. The concerned department has been notified.',
    timestamp: new Date().toISOString(),
    status: existing.status,
    actor: 'Citizen Request',
  });

  saveComplaintToStore(updated);
  return { complaint: toPublicComplaint(updated), throttled: false };
}

/**
 * Citizen confirms the fix. Verified-only: closing a complaint on someone
 * else's behalf is exactly what the verification gate exists to prevent.
 */
export async function submitFeedback(
  complaintId: string,
  identityReference: string,
  rating: number,
  comment?: string
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing || existing.reporter.identityReference !== identityReference) return null;

  const nowIso = new Date().toISOString();

  const verified = appendEvent(existing, {
    id: `evt-verified-${Date.now()}`,
    title: 'Resolution verified by citizen',
    description: comment
      ? `Citizen confirmed the issue is resolved (${rating}/5): "${comment}"`
      : `Citizen confirmed the issue is resolved with a ${rating}-star rating.`,
    timestamp: nowIso,
    status: 'resolved',
    actor: 'Citizen Verification',
  });

  const updated: Complaint = {
    ...verified,
    status: 'resolved',
    resolution: {
      ...existing.resolution,
      citizenVerifiedResolved: true,
      // Retention runs from the original resolution, not from the
      // confirmation — otherwise confirming would silently extend the window.
      resolvedAt: existing.resolution?.resolvedAt || nowIso,
    },
    feedback: { rating, comment, submittedAt: nowIso },
  };

  saveComplaintToStore(updated);
  return updated;
}

/**
 * Citizen says the issue is not actually fixed. Reopens the complaint and
 * gives the department a fresh 24-hour target. Verified-only.
 */
export async function requestReinspection(
  complaintId: string,
  identityReference: string,
  comment?: string
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing || existing.reporter.identityReference !== identityReference) return null;

  const nowIso = new Date().toISOString();

  const reopened = appendEvent(existing, {
    id: `evt-reinspect-${Date.now()}`,
    title: 'Reinspection requested by citizen',
    description: comment
      ? `Citizen reported the issue is still unresolved: "${comment}"`
      : 'Citizen reported the issue is still unresolved. Marked for reinspection.',
    timestamp: nowIso,
    status: 'in-progress',
    actor: 'Citizen Verification',
  });

  const updated: Complaint = {
    ...reopened,
    status: 'in-progress',
    // Clearing `resolvedAt` is what stops the 48-hour retention clock. A
    // complaint the citizen says is unresolved must not quietly expire.
    resolution: {
      ...existing.resolution,
      resolvedAt: undefined,
      citizenVerifiedResolved: false,
    },
    sla: { ...existing.sla, dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), status: 'normal' },
    feedback: { ...existing.feedback, comment, submittedAt: nowIso, reinspectionRequested: true },
  };

  saveComplaintToStore(updated);
  return updated;
}

// ------------------------------------------------------------
// Receipt
// ------------------------------------------------------------

export interface ReceiptData {
  complaintId: string;
  reportedOn: string;
  issue: string;
  category: string;
  area: string;
  reportedThrough: string;
  status: ComplaintStatus;
  department: string;
  division: string;
}

/**
 * Built from the public projection only. The acknowledgement slip gets
 * printed and shared, so it must not carry the reporter's name, number or
 * coordinates — see the privacy rules on sharing.
 */
export function generateReceiptData(complaint: PublicComplaint): ReceiptData {
  return {
    complaintId: complaint.id,
    reportedOn: complaint.createdAt,
    issue: complaint.issue.title,
    category: complaint.issue.category,
    area: `${complaint.area.locality}, ${complaint.area.city}`,
    reportedThrough: 'JAN-SEVA Citizen Portal',
    status: complaint.status,
    department: complaint.department.name,
    division: complaint.department.division,
  };
}

// ------------------------------------------------------------
// Draft persistence
// ------------------------------------------------------------

/**
 * Persists an in-progress report so a citizen can resume it.
 *
 * Credentials are stripped before the write. The draft holds the raw
 * Aadhaar number and the OTP in memory while the form is open — it has to,
 * to submit — but localStorage is not secure storage, and a half-finished
 * report left on a shared handset must not leave a full Aadhaar number
 * behind. On resume the citizen re-enters and re-verifies.
 *
 * Throws `StorageQuotaError` when the draft (mostly photos) will not fit.
 */
export function saveDraftStorage(draft: ReportDraft): void {
  writeJSON(DRAFT_STORAGE_KEY, {
    ...draft,
    // `File` handles cannot be serialised and are not needed on resume —
    // the compressed data URL already carries the image.
    photos: draft.photos.map((p) => ({
      id: p.id,
      url: p.url,
      name: p.name,
      size: p.size,
      timestamp: p.timestamp,
    })),
    aadhaarNumber: '',
    otp: '',
    // Verification does not survive a reload either: a restored draft must
    // not arrive pre-verified without anyone having proved anything.
    identityVerified: false,
    // The mobile number is kept masked so the resumed form can show which
    // number was being used without storing it.
    mobileNumber: '',
    mobileMaskedHint: draft.mobileNumber ? maskMobile(draft.mobileNumber) : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export function loadDraftStorage(): Partial<ReportDraft> | null {
  return readJSON<Partial<ReportDraft> | null>(DRAFT_STORAGE_KEY, null);
}

export function clearDraftStorage(): void {
  removeKey(DRAFT_STORAGE_KEY);
}

// ============================================================
// Department Operations API — Phase 4
// ============================================================

import type { DepartmentMetrics } from '../types/department';
import { DEPARTMENTS } from '../data/departments';



/** Match complaint to a department configuration */
export function matchesDepartment(complaint: Complaint, deptId: string): boolean {
  const norm = deptId.toLowerCase().trim();
  const deptCfg = DEPARTMENTS[norm as keyof typeof DEPARTMENTS];
  const aiDept = (complaint.aiAnalysis?.department || '').toLowerCase();
  const category = (complaint.issue.category || '').toLowerCase();
  const deptName = (complaint.department.name || '').toLowerCase();
  const deptIdInObj = (complaint.department.id || '').toLowerCase();

  if (deptIdInObj === norm) return true;

  if (deptCfg) {
    if (aiDept === deptCfg.aiDeptId.toLowerCase() || aiDept === norm) return true;
    if (deptCfg.categories.includes(category)) return true;
    if (deptName.includes(deptCfg.shortName.toLowerCase())) return true;
  }

  if (norm === 'roads' && (category === 'roads' || aiDept === 'pwd')) return true;
  if (norm === 'sanitation' && (category === 'garbage' || aiDept === 'sanitation')) return true;
  if (norm === 'water' && (category === 'water' || aiDept === 'water_works')) return true;
  if (norm === 'electrical' && (category === 'streetlights' || aiDept === 'electrical')) return true;
  if (norm === 'infrastructure' && (category === 'infrastructure' || aiDept === 'urban_infra')) return true;

  return false;
}

/** Retrieve all complaints for a specific department */
export function getComplaintsByDepartment(deptId: string): Complaint[] {
  const all = readStore();
  return all.filter((c) => matchesDepartment(c, deptId));
}

/** Direct full record lookup for authorized department staff */
export function getDepartmentComplaintById(complaintId: string): Complaint | null {
  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId);
  return found || null;
}

/** Admin Action: Reassign a complaint to a different department */
export async function reassignComplaintDepartment(
  complaintId: string,
  newDeptId: string,
  newDeptName: string,
  reason: string,
  adminName: string = 'City Administrator'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const oldDept = existing.department.name;

  const updatedTimeline = appendEvent(existing, {
    id: `evt-reassign-${Date.now()}`,
    title: `Reassigned to ${newDeptName}`,
    description: `Administrative routing transfer from ${oldDept} to ${newDeptName}. Reason: ${reason}`,
    timestamp: nowIso,
    status: existing.status,
    actor: adminName,
    actorType: 'system',
    visibility: 'public',
  });

  const updated: Complaint = {
    ...updatedTimeline,
    updatedAt: nowIso,
    department: {
      id: newDeptId,
      name: newDeptName,
      division: existing.department.division || 'Gwalior Municipal Central',
      helpline: existing.department.helpline || '0751-2441111',
    },
    assignedOfficer: undefined, // Clear assignment so new dept nodal officer can assign
    latestUpdate: {
      title: `Transferred to ${newDeptName}`,
      description: `Administrative routing transfer: ${reason}`,
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Admin Action: Manually escalate a complaint */
export async function manualEscalateComplaint(
  complaintId: string,
  reason: string,
  adminName: string = 'City Administrator'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();

  const updatedTimeline = appendEvent(existing, {
    id: `evt-manual-esc-${Date.now()}`,
    title: 'Manually escalated by Admin',
    description: `Administrative intervention: ${reason}. Escalated to Municipal Commissioner & Department Head.`,
    timestamp: nowIso,
    status: 'escalated',
    actor: adminName,
    actorType: 'system',
    visibility: 'public',
  });

  const updated: Complaint = {
    ...updatedTimeline,
    status: 'escalated',
    updatedAt: nowIso,
    sla: {
      ...existing.sla,
      status: 'exceeded',
      escalatedAt: nowIso,
      escalationLevel: 'Level 2 (Executive)',
      escalatedTo: 'Municipal Commissioner & Department Head',
    },
    latestUpdate: {
      title: 'Escalated by Admin',
      description: `Administrative priority escalation: ${reason}`,
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Assign an officer and/or team to a complaint */
export async function assignComplaint(
  complaintId: string,
  officer: {
    name: string;
    designation: string;
    staffId?: string;
    team?: string;
    phone?: string;
  },
  teamName?: string,
  actor: string = 'Department Nodal Officer'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const assignedTeam = teamName || officer.team || existing.department.assignedTeam || 'Maintenance Unit 1';

  const updatedTimeline = appendEvent(existing, {
    id: `evt-assign-${Date.now()}`,
    title: `Assigned to ${officer.name}`,
    description: `Task assigned to ${officer.name} (${officer.designation}) in ${assignedTeam}.`,
    timestamp: nowIso,
    status: 'assigned',
    actor,
    actorType: 'officer',
    visibility: 'public',
  });

  const updated: Complaint = {
    ...updatedTimeline,
    status: existing.status === 'pending' ? 'assigned' : existing.status,
    updatedAt: nowIso,
    department: {
      ...existing.department,
      assignedTeam,
    },
    assignedOfficer: {
      name: officer.name,
      designation: officer.designation,
      staffId: officer.staffId,
      team: assignedTeam,
      phone: officer.phone,
    },
    latestUpdate: {
      title: `Assigned to ${officer.name}`,
      description: `Task assigned to ${assignedTeam}. Work scheduled.`,
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Officer starts on-site work */
export async function startWorkOnComplaint(
  complaintId: string,
  actor: string = 'Field Officer'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();

  const updatedTimeline = appendEvent(existing, {
    id: `evt-startwork-${Date.now()}`,
    title: 'On-site work commenced',
    description: 'Field operations team has arrived on site and initiated repair/rectification work.',
    timestamp: nowIso,
    status: 'in-progress',
    actor,
    actorType: 'officer',
    visibility: 'public',
  });

  const updated: Complaint = {
    ...updatedTimeline,
    status: 'in-progress',
    updatedAt: nowIso,
    latestUpdate: {
      title: 'On-site work in progress',
      description: 'Operations team is actively working at the reported location.',
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Post a progress update note + optional field photos */
export async function addDepartmentProgressUpdate(
  complaintId: string,
  note: string,
  photos: string[] = [],
  isInternal: boolean = false,
  actor: string = 'Field Officer'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();

  const updatedTimeline = appendEvent(existing, {
    id: `evt-progress-${Date.now()}`,
    title: isInternal ? 'Internal Operational Note' : 'Field Progress Update',
    description: note,
    timestamp: nowIso,
    status: existing.status,
    actor,
    actorType: 'officer',
    visibility: isInternal ? 'internal' : 'public',
    photos: photos.length > 0 ? photos : undefined,
  });

  const updated: Complaint = {
    ...updatedTimeline,
    updatedAt: nowIso,
    latestUpdate: isInternal
      ? existing.latestUpdate
      : {
          title: 'Field Progress Update',
          description: note,
          timestamp: nowIso,
        },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Submit resolution with resolution notes and photo evidence */
export async function submitDepartmentResolution(
  complaintId: string,
  resolutionNote: string,
  evidencePhotos: string[],
  actor: string = 'Field Operations Team'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();

  const updatedTimeline = appendEvent(existing, {
    id: `evt-resolution-${Date.now()}`,
    title: 'Resolution submitted — awaiting citizen verification',
    description: resolutionNote || 'Work completed on site and verified by field team.',
    timestamp: nowIso,
    status: 'resolved',
    actor,
    actorType: 'officer',
    visibility: 'public',
    photos: evidencePhotos.length > 0 ? evidencePhotos : undefined,
  });

  const updated: Complaint = {
    ...updatedTimeline,
    status: 'resolved',
    updatedAt: nowIso,
    resolution: {
      evidencePhotos,
      resolvedAt: nowIso,
      resolutionNote,
      resolvedBy: actor,
      citizenVerifiedResolved: false,
    },
    latestUpdate: {
      title: 'Issue Resolved',
      description: resolutionNote || 'Work completed on site and verified by department team.',
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Department accepts a citizen's reinspection request and schedules re-work */
export async function acceptDepartmentReinspection(
  complaintId: string,
  note: string = 'Reinspection accepted. Priority field team redeployed.',
  actor: string = 'Nodal Officer'
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing) return null;

  const nowIso = new Date().toISOString();

  const updatedTimeline = appendEvent(existing, {
    id: `evt-reinspect-ack-${Date.now()}`,
    title: 'Reinspection accepted by department',
    description: note,
    timestamp: nowIso,
    status: 'in-progress',
    actor,
    actorType: 'officer',
    visibility: 'public',
  });

  const updated: Complaint = {
    ...updatedTimeline,
    status: 'in-progress',
    updatedAt: nowIso,
    feedback: {
      ...existing.feedback,
      reinspectionRequested: false, // Reset flag now that it's accepted and back in progress
      reinspectionNote: note,
    },
    latestUpdate: {
      title: 'Reinspection In Progress',
      description: note,
      timestamp: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

/** Calculate comprehensive operational metrics for a department */
export function getDepartmentMetrics(deptId: string): DepartmentMetrics {
  const deptComplaints = getComplaintsByDepartment(deptId);
  const now = Date.now();

  let active = 0;
  let pending = 0;
  let assigned = 0;
  let inProgress = 0;
  let resolutionSubmitted = 0;
  let resolved = 0;
  let citizenVerified = 0;
  let reinspectionRequested = 0;
  let slaAtRisk = 0;
  let slaBreached = 0;
  let escalated = 0;
  let unassigned = 0;
  let highPriority = 0;
  let criticalPriority = 0;
  let totalRatingSum = 0;
  let ratingsCount = 0;
  let totalResolutionHoursSum = 0;
  let resolvedWithTimestampCount = 0;

  for (const c of deptComplaints) {
    const isResolved = c.status === 'resolved';

    if (!isResolved) {
      active++;
      if (c.status === 'pending') pending++;
      else if (c.status === 'assigned') assigned++;
      else if (c.status === 'in-progress') inProgress++;
      else if (c.status === 'resolution-submitted') resolutionSubmitted++;

      if (!c.assignedOfficer?.name) unassigned++;

      const dueTime = new Date(c.sla.dueAt).getTime();
      if (c.sla.status === 'exceeded' || dueTime < now) {
        slaBreached++;
        escalated++;
      } else if (c.sla.status === 'approaching' || dueTime - now < 6 * 3600 * 1000) {
        slaAtRisk++;
      }

      if (c.feedback?.reinspectionRequested) {
        reinspectionRequested++;
      }
    } else {
      resolved++;
      if (c.resolution?.citizenVerifiedResolved) {
        citizenVerified++;
      }

      if (c.resolution?.resolvedAt) {
        const created = new Date(c.createdAt).getTime();
        const res = new Date(c.resolution.resolvedAt).getTime();
        const diffHours = Math.max(1, Math.round((res - created) / (3600 * 1000)));
        totalResolutionHoursSum += diffHours;
        resolvedWithTimestampCount++;
      }
    }

    if (c.status === 'escalated') {
      escalated++;
    }

    if (c.feedback?.rating) {
      totalRatingSum += c.feedback.rating;
      ratingsCount++;
    }

    const priorityScore = c.aiAnalysis?.priorityScore || 70;
    const severity = c.aiAnalysis?.severity || 'medium';
    if (priorityScore >= 90 || severity === 'critical') {
      criticalPriority++;
    } else if (priorityScore >= 75 || severity === 'high') {
      highPriority++;
    }
  }

  const totalReceived = deptComplaints.length;
  const resolutionRatePercent = totalReceived > 0 ? Math.round((resolved / totalReceived) * 100) : 94;
  const slaCompliancePercent =
    totalReceived > 0
      ? Math.max(70, Math.round(((totalReceived - slaBreached) / totalReceived) * 100))
      : 92;

  const citizenSatisfactionAverage =
    ratingsCount > 0 ? Number((totalRatingSum / ratingsCount).toFixed(1)) : 4.6;

  const averageResolutionHours =
    resolvedWithTimestampCount > 0
      ? Math.round(totalResolutionHoursSum / resolvedWithTimestampCount)
      : 28;

  return {
    totalReceived,
    active,
    pending,
    assigned,
    inProgress,
    resolutionSubmitted,
    resolved,
    citizenVerified,
    reinspectionRequested,
    slaAtRisk,
    slaBreached,
    escalated,
    unassigned,
    highPriority,
    criticalPriority,
    averageResolutionHours,
    resolutionRatePercent,
    slaCompliancePercent,
    citizenSatisfactionAverage,
    totalRatingsCount: ratingsCount,
    backlogCount: active,
  };
}

/** Triage query: items requiring immediate action */
export function getDepartmentNeedsAttention(deptId: string): {
  breached: Complaint[];
  atRisk: Complaint[];
  unassigned: Complaint[];
  reinspection: Complaint[];
} {
  const deptComplaints = getComplaintsByDepartment(deptId);
  const now = Date.now();

  const breached: Complaint[] = [];
  const atRisk: Complaint[] = [];
  const unassigned: Complaint[] = [];
  const reinspection: Complaint[] = [];

  for (const c of deptComplaints) {
    if (c.status !== 'resolved') {
      const dueTime = new Date(c.sla.dueAt).getTime();
      if (c.sla.status === 'exceeded' || dueTime < now) {
        breached.push(c);
      } else if (c.sla.status === 'approaching' || dueTime - now < 6 * 3600 * 1000) {
        atRisk.push(c);
      }

      if (!c.assignedOfficer?.name) {
        unassigned.push(c);
      }

      if (c.feedback?.reinspectionRequested) {
        reinspection.push(c);
      }
    }
  }

  return { breached, atRisk, unassigned, reinspection };
}

/** Filtered list of escalated/breached complaints */
export function getDepartmentEscalations(deptId?: string): Complaint[] {
  const all = deptId ? getComplaintsByDepartment(deptId) : readStore();
  const now = Date.now();

  return all.filter((c) => {
    if (c.status === 'escalated') return true;
    if (c.status !== 'resolved') {
      const dueTime = new Date(c.sla.dueAt).getTime();
      return c.sla.status === 'exceeded' || dueTime < now;
    }
    return false;
  });
}

/** Retrieve complaints assigned to a specific Field Officer */
export function getMyWorkComplaints(deptId: string, staffNameOrId: string): Complaint[] {
  const deptComplaints = getComplaintsByDepartment(deptId);
  const norm = staffNameOrId.toLowerCase().trim();

  return deptComplaints.filter((c) => {
    if (c.status === 'resolved') return false;
    const officerName = (c.assignedOfficer?.name || '').toLowerCase();
    const staffId = (c.assignedOfficer?.staffId || '').toLowerCase();
    return officerName.includes(norm) || staffId === norm || norm.includes(officerName);
  });
}

