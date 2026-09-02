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
import { demoSeedDataAllowed } from '../config/appMode';
import { getCityCode, defaultCity } from '../data/cities';
import { deriveIdentityReference, maskMobile, maskAadhaar } from './identityService';
import {
  resolveLookup,
  isPubliclyTrackable,
  computeExpiresAt,
  toPublicComplaint,
} from './privacyService';
import { snapToAsset, assetForComplaint, recordRepair } from './assetService';
import { recordEvidenceHash, worstGrade } from './proofService';
import type { CaptureIntegrity, CaptureIntegrityGrade } from '../types/proof';
import {
  addStake,
  ensureIssueFor,
  getIssueForComplaint,
  priorityWithSpread,
  computeSpread,
  markProvisionallyClosed,
  recordConfirmation,
  recordDispute,
  summariseConsent,
} from './issueService';
import {
  openWatchWindow,
  answerCheckpoint,
  isAuditSampled,
  nextPrompt,
  getAuditQueue,
} from './verificationService';

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
    // Production starts empty. Seeding synthetic Gwalior complaints into
    // a real beta would put invented civic issues in front of real
    // departments and fold them into every published figure.
    const seed = demoSeedDataAllowed() ? buildSeedComplaints() : [];
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
  const list = readStore();
  const index = list.findIndex((c) => c.id === complaint.id);

  // Version is owned by the store, not by callers. Deriving it from what
  // is currently persisted — rather than from the copy the caller is
  // holding — means two writers cannot both land on the same number.
  const currentVersion = index === -1 ? 0 : list[index].version ?? 0;

  const withRetention: Complaint = {
    ...complaint,
    version: currentVersion + 1,
    expiresAt: computeExpiresAt(complaint),
    isPubliclyTrackable: isPubliclyTrackable(complaint),
  };

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
/**
 * Public tracking lookup.
 *
 * Same mode gate as `submitReport`, and for the same reason: reads and
 * writes must agree about where complaints live. Splitting them was the
 * bug this closes — creation went to Postgres while tracking searched
 * localStorage, so a real submission produced a real ticket number that
 * `/track` reported as "not found".
 *
 *   NO FALLBACK. A failed request is an error, not a reason to go
 *   looking in localStorage. Answering "not found" from a stale local
 *   store when the server is merely unreachable tells a citizen their
 *   complaint does not exist, which is worse than telling them the
 *   service is down.
 */
export async function getById(complaintId: string): Promise<LookupOutcome> {
  if (!demoSeedDataAllowed()) return getByIdServer(complaintId);

  await new Promise((resolve) => setTimeout(resolve, 420));

  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId) ?? null;

  return resolveLookup(found);
}

async function getByIdServer(complaintId: string): Promise<LookupOutcome> {
  const cleanId = normaliseId(complaintId);

  let response: Response;
  try {
    response = await fetch(`/api/complaints/${encodeURIComponent(cleanId)}`, {
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new SubmissionError(
      'NETWORK_ERROR',
      'We could not reach the service. Check your connection and try again.'
    );
  }

  if (!response.ok) {
    // 503 and 500 are outages, not answers. Rendering "not found" for
    // them would be the UI lying about a complaint that exists.
    throw new SubmissionError(...(await describeSubmissionFailure(response)));
  }

  const body = (await response.json()) as LookupOutcome;

  // A network boundary: the shape is checked on arrival regardless of
  // what the endpoint promises. Anything unrecognised is a miss, not a
  // half-rendered complaint.
  if (body?.kind === 'found' || body?.kind === 'expired' || body?.kind === 'not-found') {
    return body;
  }
  return { kind: 'not-found' };
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
// ------------------------------------------------------------
// Submission
// ------------------------------------------------------------
//
// Two implementations behind one function, exactly as otpService does
// (spec §11). The wizard calls `submitReport` and cannot tell which ran.
//
//   demo / development   the in-browser store. What the prototype has
//                        always done, and what the 337 self-tests and the
//                        stakeholder build exercise.
//   production           POST /api/complaints/create. The ticket id, the
//                        department, the status, the SLA and the identity
//                        are all decided server-side.
//
//   THE DEMO PATH IS NOT A FALLBACK.
//   If the production path fails, it FAILS — it never quietly writes to
//   localStorage instead. A citizen who is told their complaint was filed
//   must have a row in Postgres to show for it, and a silent downgrade
//   would hand out ticket numbers for reports nobody will ever action.

/**
 * The idempotency key for the submission currently in flight.
 *
 * Created on the first attempt and reused until one SUCCEEDS, so a retry
 * after a timeout — the case where the server may well have committed the
 * complaint before the connection dropped — carries the same key and
 * returns the same ticket instead of filing a duplicate. Cleared on
 * success so the next report gets its own.
 *
 * Deliberately not derived from the draft's contents: a citizen who edits
 * one word after a failure is still filing the same report.
 */
let pendingSubmissionKey: string | null = null;

function submissionKey(): string {
  if (!pendingSubmissionKey) {
    pendingSubmissionKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return pendingSubmissionKey;
}

/** Raised with a message already safe to show a citizen. */
export class SubmissionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SubmissionError';
    this.code = code;
  }
}

interface CreateComplaintResponse {
  complaintId: string;
  civicIssueId: string;
  departmentId: string | null;
  status: string;
  slaDueAt: string;
  createdAt: string;
  replayed: boolean;
}

/**
 * Files the report against the real backend.
 *
 * Sends ONLY what a citizen is entitled to assert. `departmentId`,
 * `status`, `priorityScore`, `slaDueAt` and `isSynthetic` are absent by
 * construction — the endpoint ignores them anyway, and sending them would
 * imply the client has a say.
 */
async function submitReportServer(
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string
): Promise<Complaint> {
  const confirmed = draft.location?.confirmed;
  const gps = draft.location?.gps;

  const latitude = confirmed?.latitude ?? draft.location?.latitude;
  const longitude = confirmed?.longitude ?? draft.location?.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new SubmissionError('VALIDATION_ERROR', 'Please confirm the location of the issue.');
  }

  let response: Response;
  try {
    response = await fetch('/api/complaints/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: submissionKey(),
        cityId,
        category: analysis.category,
        title: `${CATEGORY_TITLES[analysis.category] || 'Civic Issue'} at ${
          confirmed?.locality || draft.location?.locality || defaultCity.name
        }`,
        description: draft.description,
        // The CONFIRMED issue location.
        lat: latitude,
        lng: longitude,
        locality: confirmed?.locality ?? draft.location?.locality,
        address: confirmed?.address ?? draft.location?.address,
        locationSource: confirmed?.source ?? 'gps',
        // Where the DEVICE was. Separate fields, never merged with the above.
        gpsLat: gps?.latitude,
        gpsLng: gps?.longitude,
        gpsAccuracy: gps?.accuracy,
        gpsCapturedAt: gps?.detectedAt,
        // The server's own signed statement that it verified this citizen.
        // Absent means the report is filed anonymously, which is allowed.
        identityAttestation: draft.identityAttestation,
      }),
    });
  } catch {
    // A transport failure, not a rejection. The key is deliberately NOT
    // cleared: the server may have committed before the socket died, and
    // retrying with the same key returns that complaint rather than a
    // second one.
    throw new SubmissionError(
      'NETWORK_ERROR',
      'We could not reach the service. Check your connection and try again.'
    );
  }

  if (!response.ok) {
    throw new SubmissionError(...(await describeSubmissionFailure(response)));
  }

  const body = (await response.json()) as CreateComplaintResponse;
  if (!body?.complaintId) {
    throw new SubmissionError('INTERNAL_ERROR', 'We could not file your report just now.');
  }

  // Filed. The next report starts a new submission.
  pendingSubmissionKey = null;
  clearDraftStorage();

  return toComplaintShape(body, draft, analysis, cityId);
}

/**
 * Maps a failed response to a code and a sentence the UI can render.
 *
 * The endpoint already returns citizen-ready copy, but a proxy, a WAF or
 * a cold start can return something else entirely, so anything
 * unrecognised becomes a generic sentence rather than being displayed.
 */
async function describeSubmissionFailure(response: Response): Promise<[string, string]> {
  let code = 'INTERNAL_ERROR';
  let message = '';

  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (typeof body.error?.code === 'string') code = body.error.code;
    if (typeof body.error?.message === 'string' && body.error.message.length < 300) {
      message = body.error.message;
    }
  } catch {
    // Not our envelope. Fall through to the status-based defaults.
  }

  if (message) return [code, message];

  switch (response.status) {
    case 401:
      return ['AUTH_REQUIRED', 'Your verification has expired. Please verify again.'];
    case 403:
      return ['FORBIDDEN', 'This report could not be accepted.'];
    case 409:
      return ['CONFLICT', 'This report has already been filed.'];
    case 413:
      return ['STORAGE_ERROR', 'That photo is too large. Please retake it.'];
    case 422:
      return ['VALIDATION_ERROR', 'Please check the details and try again.'];
    case 429:
      return ['RATE_LIMITED', 'Too many reports just now. Please wait a moment and try again.'];
    case 503:
      return ['PROVIDER_UNAVAILABLE', 'This service is not available yet. Please try again later.'];
    default:
      return ['INTERNAL_ERROR', 'We could not file your report just now. Please try again.'];
  }
}

/**
 * Dresses the server's answer in the shape `/report` already renders.
 *
 * The UI is frozen (spec §1, §44), so the adapter moves rather than the
 * screen. Every authoritative value here — id, department, status, SLA —
 * comes from the response; the draft supplies only what the citizen typed
 * and photographed.
 */
function toComplaintShape(
  body: CreateComplaintResponse,
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string
): Complaint {
  const confirmed = draft.location?.confirmed;
  const gps = draft.location?.gps;

  return {
    id: body.complaintId,
    cityId,
    createdAt: body.createdAt,
    updatedAt: body.createdAt,
    status: body.status as ComplaintStatus,
    issue: {
      category: analysis.category,
      title: `${CATEGORY_TITLES[analysis.category] || 'Civic Issue'} at ${
        confirmed?.locality || draft.location?.locality || defaultCity.name
      }`,
      description: draft.description,
    },
    photos: draft.photos.map((p) => p.url),
    photoProvenance: draft.photos.map((p) => ({
      captureMethod: p.captureMethod ?? 'UNKNOWN',
      capturedAtClient: p.capturedAtClient,
    })),
    location: {
      latitude: confirmed?.latitude ?? draft.location?.latitude ?? defaultCity.coordinates.lat,
      longitude: confirmed?.longitude ?? draft.location?.longitude ?? defaultCity.coordinates.lng,
      address: confirmed?.address || draft.location?.address || `${defaultCity.name} municipal area`,
      locality: confirmed?.locality || draft.location?.locality || 'City Centre',
      city: confirmed?.city || draft.location?.city || defaultCity.name,
      state: confirmed?.state || draft.location?.state || defaultCity.state,
      source: confirmed?.source || 'gps',
      gps: gps
        ? {
            latitude: gps.latitude,
            longitude: gps.longitude,
            accuracy: gps.accuracy,
            detectedAt: gps.detectedAt,
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
      // The SERVER's routing decision, not the client's guess. Null means
      // general triage, and the UI says so rather than naming a department
      // nobody has assigned.
      id: body.departmentId ?? undefined,
      name: body.departmentId
        ? DEPARTMENTS[body.departmentId as DepartmentId]?.name ?? analysis.departmentName
        : 'Awaiting routing',
      division: '',
      helpline: body.departmentId
        ? DEPARTMENTS[body.departmentId as DepartmentId]?.helpline ?? ''
        : '',
    },
    sla: { dueAt: body.slaDueAt, status: 'normal' },
    timeline: [
      {
        id: `evt-${body.complaintId}-1`,
        title: 'Complaint received',
        description: 'Report submitted through JAN-SEVA.',
        timestamp: body.createdAt,
        status: 'pending',
        actor: 'Citizen Portal',
      },
    ],
    latestUpdate: {
      title: 'Complaint received',
      description: body.departmentId
        ? 'Routed for assignment.'
        : 'In the triage queue for assignment.',
      timestamp: body.createdAt,
    },
  };
}

export async function submitReport(
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string = defaultCity.id
): Promise<Complaint> {
  if (!demoSeedDataAllowed()) return submitReportServer(draft, analysis, cityId);
  return submitReportDemo(draft, analysis, cityId);
}

async function submitReportDemo(
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
      description: `Matched to ${analysis.departmentName} from the description by keyword, with a ${targetHours}-hour turnaround target. You confirmed this category before submitting.`,
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
    photoProvenance: draft.photos.map((p) => ({
      captureMethod: p.captureMethod ?? 'UNKNOWN',
      capturedAtClient: p.capturedAtClient,
    })),
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

  // Anchor the report to a piece of infrastructure. A null snap is a
  // real and common outcome — the report simply did not fall inside any
  // known asset's radius — and is recorded as such rather than forced
  // onto whatever happened to be nearest.
  const snap = snapToAsset(
    { latitude: complaint.location.latitude, longitude: complaint.location.longitude },
    analysis.category
  );

  const anchored: Complaint = snap
    ? { ...complaint, assetId: snap.asset.id, assetSnapMetres: snap.distanceMetres }
    : complaint;

  saveComplaintToStore(anchored);
  clearDraftStorage();
  return anchored;
}

/**
 * Files this citizen's own report against a shared civic issue.
 * Additive by design: the primary keeps its timeline, officer and SLA, and
 * gains an event plus the new photos as further evidence.
 */
export async function joinExistingComplaint(
  draft: ReportDraft,
  analysis: AIAnalysis,
  cityId: string = defaultCity.id
): Promise<Complaint> {
  const match = analysis.duplicateMatch;
  if (!match) throw new Error('No matching complaint to join.');

  const existing = readStore().find((c) => c.id === match.id);
  if (!existing) {
    // Seed drift — file a standalone complaint rather than lose the report.
    return submitReport(draft, analysis, cityId);
  }

  // ----------------------------------------------------------
  // This citizen files their OWN complaint. It is not merged into
  // anyone else's, and it is not archived.
  //
  // The previous implementation appended photos to the first reporter's
  // ticket and incremented `supportingCount`. That made the first
  // reporter's ticket the issue and gave only that person a
  // verification vote — so nineteen other citizens could have their
  // complaint closed by a stranger. NYC Council Int 0744-2024 was
  // drafted because agencies were doing exactly this.
  // ----------------------------------------------------------
  const ownReport = await submitReport(draft, analysis, cityId);

  // The shared problem. Created on the first join, because a complaint
  // nobody else has reported does not need an issue record — it is one.
  const issue = ensureIssueFor(existing);
  addStake(issue.id, ownReport);
  const updatedIssue = getIssueForComplaint(ownReport.id) ?? issue;

  const nowIso = new Date().toISOString();
  const spread = computeSpread(updatedIssue);

  // ----------------------------------------------------------
  // Priority is now genuinely recomputed, which it never was before.
  //
  // The success screen used to tell the citizen their report had
  // "raised the priority" of the existing complaint. It had not:
  // `priorityScore` was written once at submission and never touched
  // again. It is recomputed here from independence-weighted spread,
  // capped, so twenty reports from one building cannot buy a queue
  // position that twenty reports from twenty streets would earn.
  // ----------------------------------------------------------
  const basePriority = existing.aiAnalysis?.priorityScore ?? 70;
  const nextPriority = priorityWithSpread(basePriority, updatedIssue);

  const withEvent = appendEvent(existing, {
    id: `evt-confirm-${Date.now()}`,
    title: 'Independent report added',
    description: `Another citizen reported the same issue and filed their own complaint (${ownReport.id}). ${spread.label}.${
      nextPriority > basePriority
        ? ` Priority raised from ${basePriority} to ${nextPriority}.`
        : ' Priority unchanged — the additional report came from the same location cluster.'
    }`,
    timestamp: nowIso,
    status: existing.status,
    actor: 'Citizen Confirmation',
    visibility: 'public',
  });

  const linkedPrimary: Complaint = {
    ...withEvent,
    civicIssueId: updatedIssue.id,
    aiAnalysis: existing.aiAnalysis
      ? { ...existing.aiAnalysis, priorityScore: nextPriority }
      : undefined,
    duplicate: {
      isLinked: true,
      primaryIssueId: existing.id,
      primaryTitle: existing.issue.title,
      supportingCount: updatedIssue.stakes.length,
      civicIssueId: updatedIssue.id,
    },
  };

  saveComplaintToStore(linkedPrimary);

  // Link the joiner's own record back to the shared issue, so their
  // tracking page can show the shared work AND their own standing.
  const linkedOwn: Complaint = {
    ...(readStore().find((c) => c.id === ownReport.id) ?? ownReport),
    civicIssueId: updatedIssue.id,
    duplicate: {
      isLinked: true,
      primaryIssueId: existing.id,
      primaryTitle: existing.issue.title,
      supportingCount: updatedIssue.stakes.length,
      civicIssueId: updatedIssue.id,
    },
  };
  saveComplaintToStore(linkedOwn);

  clearDraftStorage();
  return readStore().find((c) => c.id === ownReport.id) ?? linkedOwn;
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

  // This citizen's vote on a shared issue, and only theirs. Nineteen
  // other reporters keep their own.
  const issue = getIssueForComplaint(existing.id);
  let consentNote = '';
  if (issue) {
    const next = recordConfirmation(issue.id, existing.id);
    if (next) {
      const consent = summariseConsent(next);
      consentNote = consent.unanimous
        ? ` All ${consent.total} citizens who reported this issue have now confirmed it.`
        : ` ${consent.confirmed} of ${consent.total} reporters have confirmed; the issue stays open until the rest do.`;
    }
  }

  const updated: Complaint = {
    ...verified,
    status: 'resolved',
    resolution: {
      ...existing.resolution,
      citizenVerifiedResolved: true,
      citizenVerifiedAt: nowIso,
      // Retention runs from the original resolution, not from the
      // confirmation — otherwise confirming would silently extend the window.
      resolvedAt: existing.resolution?.resolvedAt || nowIso,
    },
    // ------------------------------------------------------------
    // The watch window opens here.
    //
    // A citizen standing next to a fresh patch will confirm it. This
    // schedules the question that actually matters — is it still there
    // in thirty days, and in ninety — and it is the only mechanism in
    // the product that can tell a real repair from a cosmetic one.
    // ------------------------------------------------------------
    verification: {
      ...existing.verification,
      ...openWatchWindow(nowIso),
      auditSampled: isAuditSampled(existing.id),
      auditOutcome: isAuditSampled(existing.id) ? 'pending' : undefined,
    },
    feedback: { rating, comment, submittedAt: nowIso },
  };

  const withConsent: Complaint = consentNote
    ? {
        ...updated,
        latestUpdate: {
          ...updated.latestUpdate,
          description: `${updated.latestUpdate.description}${consentNote}`,
        },
      }
    : updated;

  saveComplaintToStore(withConsent);
  return withConsent;
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

  // A dissent on a shared issue. One reporter saying "still broken from
  // where I stand" reopens the work — but a reason is required, and
  // reopens are capped per reporter so a single voice cannot loop the
  // issue indefinitely against nineteen others who say it is fixed.
  const issue = getIssueForComplaint(existing.id);
  let capped = false;
  if (issue) {
    const outcome = recordDispute(
      issue.id,
      existing.id,
      comment?.trim() || 'Citizen reported the issue is still unresolved.'
    );
    capped = outcome.capped;
  }

  const updated: Complaint = {
    ...reopened,
    status: capped ? existing.status : 'in-progress',
    // Clearing `resolvedAt` is what stops the identity retention clock.
    // A complaint the citizen says is unresolved must not quietly
    // expire out from under them.
    resolution: {
      ...existing.resolution,
      resolvedAt: undefined,
      citizenVerifiedResolved: false,
    },
    // A reopen also cancels the durability watch: there is nothing to
    // re-check the durability of until the work is done again.
    verification: undefined,
    sla: capped
      ? existing.sla
      : { ...existing.sla, dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), status: 'normal' },
    feedback: {
      ...existing.feedback,
      comment,
      submittedAt: nowIso,
      reinspectionRequested: true,
      reinspectionRequestedAt: nowIso,
    },
  };

  saveComplaintToStore(updated);
  return updated;
}

// ------------------------------------------------------------
// Deferred verification
// ------------------------------------------------------------

/** The durability question owed to this citizen right now, if any. */
export function getDurabilityPrompt(complaint: Complaint) {
  return nextPrompt(complaint);
}

/**
 * Records a citizen's answer to a 30- or 90-day durability check.
 *
 * `failed` reopens the complaint with a fresh 24-hour target, exactly as
 * a reinspection request does — a fix that lasted three weeks did not
 * last, and the record should say so rather than staying closed because
 * someone once ticked a box.
 */
export async function answerDurabilityCheck(
  complaintId: string,
  identityReference: string,
  dayOffset: 30 | 90,
  outcome: 'holding' | 'failed',
  note?: string
): Promise<Complaint | null> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const cleanId = normaliseId(complaintId);
  const existing = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!existing || existing.reporter.identityReference !== identityReference) return null;
  if (!existing.verification?.checkpoints) return null;

  const nowIso = new Date().toISOString();
  const verification = answerCheckpoint(existing.verification, dayOffset, outcome, note);

  const withEvent = appendEvent(existing, {
    id: `evt-durability-${Date.now()}`,
    title: outcome === 'holding' ? `Still fixed at ${dayOffset} days` : `Failed again at ${dayOffset} days`,
    description:
      outcome === 'holding'
        ? `The citizen confirmed the repair was still holding ${dayOffset} days after it was completed.`
        : `The citizen reported the repair failed again within ${dayOffset} days.${note ? ` "${note}"` : ''}`,
    timestamp: nowIso,
    status: outcome === 'holding' ? 'resolved' : 'in-progress',
    actor: 'Citizen Durability Check',
    actorType: 'citizen',
    visibility: 'public',
  });

  const updated: Complaint =
    outcome === 'holding'
      ? { ...withEvent, verification }
      : {
          ...withEvent,
          status: 'in-progress',
          verification,
          resolution: {
            ...existing.resolution,
            resolvedAt: undefined,
            citizenVerifiedResolved: false,
          },
          sla: {
            ...existing.sla,
            dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            status: 'normal',
          },
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
      // Provenance survives the draft. Losing it on a resumed report
      // would silently downgrade a live capture to "unknown origin".
      captureMethod: p.captureMethod,
      capturedAtClient: p.capturedAtClient,
    })),
    aadhaarNumber: '',
    otp: '',
    // Verification does not survive a reload either: a restored draft must
    // not arrive pre-verified without anyone having proved anything.
    identityVerified: false,
    // And neither does the token that proves it. `...draft` above would
    // otherwise spread it into localStorage, where a short-lived
    // attestation would outlive the session it was issued for and sit on
    // disk for anything with access to the origin to read.
    identityAttestation: undefined,
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
// Department & Admin Operations API
// ============================================================
//
// Every operational change to a complaint funnels through
// `applyComplaintMutation` below. Components never touch the store, and
// never construct a complaint object themselves, so one place is
// responsible for:
//
//   1. object-level authorisation  (may this actor touch this record?)
//   2. version check               (has someone else moved it since?)
//   3. the change itself
//   4. timeline event + timestamps
//   5. persistence                 (which bumps the version)
//   6. audit entry
//   7. offline queueing            (so nothing is lost without a signal)
//
// Skipping this helper skips all seven.

import type { DepartmentId, DepartmentMetrics } from '../types/department';
import { DEPARTMENTS } from '../data/departments';
import { resolveOperationActor, toAuditActor, type OperationActor } from './actorContext';
import { recordAuditEvent } from './auditService';
import type { AuditAction } from '../types/audit';
import { getNetworkSnapshot } from './networkService';
import { enqueue, type SyncOperationType } from './syncService';
import { computeSlaHealth } from './slaService';
import { calculatePerformanceScore } from './performanceService';
import { computeDurabilityStats } from './verificationService';
import { findRepeatFailures } from './assetService';
import { gradePoints } from './proofService';

/** Match complaint to a department configuration */
export function matchesDepartment(complaint: Complaint, deptId: string): boolean {
  const norm = deptId.toLowerCase().trim();
  const deptCfg = DEPARTMENTS[norm as keyof typeof DEPARTMENTS];
  const aiDept = (complaint.aiAnalysis?.department || '').toLowerCase();
  const category = (complaint.issue.category || '').toLowerCase();
  const deptName = (complaint.department.name || '').toLowerCase();
  const deptIdInObj = (complaint.department.id || '').toLowerCase();

  // An explicit department id is authoritative. Without this short-circuit
  // a complaint reassigned away from Roads would still match Roads by
  // category, and two departments would each see it as theirs.
  if (deptIdInObj) return deptIdInObj === norm;

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

/** Which department currently owns a complaint. */
export function owningDepartmentOf(complaint: Complaint): DepartmentId | null {
  const explicit = (complaint.department.id || '').toLowerCase() as DepartmentId;
  if (explicit && DEPARTMENTS[explicit]) return explicit;

  const match = (Object.keys(DEPARTMENTS) as DepartmentId[]).find((id) =>
    matchesDepartment(complaint, id)
  );
  return match ?? null;
}

/** Retrieve all complaints for a specific department */
export function getComplaintsByDepartment(deptId: string): Complaint[] {
  return readStore().filter((c) => matchesDepartment(c, deptId));
}

// ------------------------------------------------------------
// Object-level authorisation
// ------------------------------------------------------------

export type OperationFailureReason =
  | 'not-found'
  | 'unauthorized'
  | 'no-session'
  | 'conflict'
  | 'invalid';

export type OperationResult =
  | {
      ok: true;
      complaint: Complaint;
      /** True when the change is saved locally but not yet acknowledged. */
      queued: boolean;
    }
  | {
      ok: false;
      reason: OperationFailureReason;
      /** Ready to render. Never a raw exception string. */
      message: string;
      /** Present on a conflict: what the record actually looks like now. */
      latest?: Complaint;
    };

const FAILURE_COPY: Record<OperationFailureReason, string> = {
  'not-found': 'That complaint could not be found.',
  unauthorized: 'This complaint belongs to another department.',
  'no-session': 'Your session has expired. Please sign in again.',
  conflict: 'This complaint was updated elsewhere. Review the latest version before changing it.',
  invalid: 'That change could not be applied.',
};

function failure(reason: OperationFailureReason, latest?: Complaint): OperationResult {
  return { ok: false, reason, message: FAILURE_COPY[reason], latest };
}

/**
 * Whether an actor may operate on one specific record.
 *
 * This is the check that page-level route guards cannot make. A guard
 * proves someone is signed into the department portal; only this proves
 * the record in front of them is their department's.
 */
export function actorCanAccessComplaint(
  actor: OperationActor | null,
  complaint: Complaint
): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (!actor.departmentId) return false;
  return matchesDepartment(complaint, actor.departmentId);
}

/**
 * Full record lookup, scoped to the caller's authority.
 *
 * Returns null for a complaint outside the actor's department — the same
 * answer as a complaint that does not exist, so probing IDs reveals
 * nothing about what other departments are handling.
 */
export function getComplaintForActor(complaintId: string): Complaint | null {
  const actor = resolveOperationActor();
  if (!actor) return null;

  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!found) return null;

  return actorCanAccessComplaint(actor, found) ? found : null;
}

/**
 * Why a scoped lookup came back empty, for a screen that needs to tell
 * "no such complaint" apart from "not yours".
 */
export function describeComplaintAccess(
  complaintId: string
): { kind: 'ok'; complaint: Complaint } | { kind: 'not-found' } | { kind: 'forbidden' } | { kind: 'no-session' } {
  const actor = resolveOperationActor();
  if (!actor) return { kind: 'no-session' };

  const cleanId = normaliseId(complaintId);
  const found = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!found) return { kind: 'not-found' };

  return actorCanAccessComplaint(actor, found)
    ? { kind: 'ok', complaint: found }
    : { kind: 'forbidden' };
}

/** @deprecated Use `getComplaintForActor` — this one applies no scope. */
export function getDepartmentComplaintById(complaintId: string): Complaint | null {
  return getComplaintForActor(complaintId);
}

// ------------------------------------------------------------
// The single mutation path
// ------------------------------------------------------------

interface MutationSpec {
  complaintId: string;
  /** Version the caller believes it is editing. Omit to skip the check. */
  expectedVersion?: number;
  /** Admin-only operations refuse a department session outright. */
  adminOnly?: boolean;
  /** Applies the change. Returns null to reject as invalid. */
  mutate: (current: Complaint, actor: OperationActor) => Complaint | null;
  audit: (current: Complaint, actor: OperationActor) => {
    action: AuditAction;
    description: string;
    metadata?: Record<string, string>;
  };
  sync: (current: Complaint) => { type: SyncOperationType; summary: string; payload?: Record<string, string | number | boolean> };
}

async function applyComplaintMutation(spec: MutationSpec): Promise<OperationResult> {
  const actor = resolveOperationActor();
  if (!actor) return failure('no-session');

  if (spec.adminOnly && actor.role !== 'admin') return failure('unauthorized');

  const cleanId = normaliseId(spec.complaintId);
  const current = readStore().find((c) => c.id.toUpperCase() === cleanId);
  if (!current) return failure('not-found');

  if (!actorCanAccessComplaint(actor, current)) return failure('unauthorized');

  if (
    spec.expectedVersion !== undefined &&
    (current.version ?? 0) !== spec.expectedVersion
  ) {
    return failure('conflict', current);
  }

  const next = spec.mutate(current, actor);
  if (!next) return failure('invalid');

  try {
    saveComplaintToStore(next);
  } catch {
    // A quota failure is the one case where the change genuinely did not
    // land, so it must not be reported as saved.
    return {
      ok: false,
      reason: 'invalid',
      message: 'There is no room left on this device to save that change. Clear old complaints and try again.',
    };
  }

  const auditSpec = spec.audit(current, actor);
  recordAuditEvent({
    actor: toAuditActor(actor),
    action: auditSpec.action,
    targetType: 'complaint',
    targetId: current.id,
    description: auditSpec.description,
    metadata: auditSpec.metadata,
  });

  // Written locally either way. Offline, it also joins the queue so the
  // officer sees it is saved-but-unsent rather than silently divergent.
  let queued = false;
  if (!getNetworkSnapshot().isOnline) {
    const syncSpec = spec.sync(current);
    enqueue({
      type: syncSpec.type,
      entityId: current.id,
      summary: syncSpec.summary,
      payload: syncSpec.payload,
    });
    queued = true;
  }

  const saved = readStore().find((c) => c.id.toUpperCase() === cleanId) ?? next;
  return { ok: true, complaint: saved, queued };
}

// ------------------------------------------------------------
// Administrative operations
// ------------------------------------------------------------

/** Admin action: move a complaint to a different department. */
export async function reassignComplaintDepartment(
  complaintId: string,
  newDeptId: DepartmentId,
  newDeptName: string,
  reason: string,
  expectedVersion?: number
): Promise<OperationResult> {
  if (!reason.trim()) {
    return { ok: false, reason: 'invalid', message: 'A reason is required to reassign a complaint.' };
  }

  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    adminOnly: true,
    mutate: (existing, actor) => {
      const nowIso = new Date().toISOString();
      const oldDept = existing.department.name;
      const target = DEPARTMENTS[newDeptId];

      const withEvent = appendEvent(existing, {
        id: `evt-reassign-${Date.now()}`,
        title: `Reassigned to ${newDeptName}`,
        description: `Routing transfer from ${oldDept} to ${newDeptName}. Reason: ${reason}`,
        timestamp: nowIso,
        status: existing.status,
        actor: actor.name,
        actorType: 'system',
        visibility: 'public',
      });

      return {
        ...withEvent,
        updatedAt: nowIso,
        department: {
          id: newDeptId,
          name: newDeptName,
          division: target?.divisions[0] || existing.department.division || 'Gwalior Municipal Central',
          helpline: target?.helpline || existing.department.helpline || '0751-2441111',
        },
        // The new department's nodal officer assigns their own crew.
        assignedOfficer: undefined,
        latestUpdate: {
          title: `Transferred to ${newDeptName}`,
          description: `Routing transfer: ${reason}`,
          timestamp: nowIso,
        },
      };
    },
    audit: (existing) => ({
      action: 'department_reassign',
      description: `Reassigned from ${existing.department.name} to ${newDeptName}. Reason: ${reason}`,
      metadata: { fromDept: existing.department.name, toDept: newDeptName, reason },
    }),
    sync: () => ({
      type: 'REASSIGN_DEPARTMENT',
      summary: `Reassign to ${newDeptName}`,
      payload: { departmentId: newDeptId },
    }),
  });
}

/** Admin action: escalate a complaint by hand. */
export async function manualEscalateComplaint(
  complaintId: string,
  reason: string,
  expectedVersion?: number
): Promise<OperationResult> {
  if (!reason.trim()) {
    return { ok: false, reason: 'invalid', message: 'A reason is required to escalate a complaint.' };
  }

  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    adminOnly: true,
    mutate: (existing, actor) => {
      const nowIso = new Date().toISOString();

      const withEvent = appendEvent(existing, {
        id: `evt-manual-esc-${Date.now()}`,
        title: 'Escalated by the Command Centre',
        description: `${reason} Escalated to the Municipal Commissioner and department head.`,
        timestamp: nowIso,
        status: 'escalated',
        actor: actor.name,
        actorType: 'system',
        visibility: 'public',
      });

      return {
        ...withEvent,
        status: 'escalated',
        updatedAt: nowIso,
        sla: {
          ...existing.sla,
          escalatedAt: nowIso,
          escalationLevel: 'Level 2 (Executive)',
          escalatedTo: 'Municipal Commissioner & Department Head',
        },
        latestUpdate: {
          title: 'Escalated for priority action',
          description: reason,
          timestamp: nowIso,
        },
      };
    },
    audit: () => ({
      action: 'manual_escalation',
      description: `Manually escalated. Reason: ${reason}`,
      metadata: { reason },
    }),
    sync: () => ({ type: 'MANUAL_ESCALATION', summary: 'Manual escalation' }),
  });
}

// ------------------------------------------------------------
// Department operations
// ------------------------------------------------------------

export interface AssignmentTarget {
  name: string;
  designation: string;
  staffId?: string;
  team?: string;
  phone?: string;
}

/** Assign an officer and crew to a complaint. */
export async function assignComplaint(
  complaintId: string,
  officer: AssignmentTarget,
  teamName?: string,
  expectedVersion?: number
): Promise<OperationResult> {
  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      const nowIso = new Date().toISOString();
      const assignedTeam =
        teamName || officer.team || existing.department.assignedTeam || 'Maintenance Unit 1';
      const isReassignment = Boolean(existing.assignedOfficer?.name);

      const withEvent = appendEvent(existing, {
        id: `evt-assign-${Date.now()}`,
        title: `Assigned to ${officer.name}`,
        description: `Task assigned to ${officer.name} (${officer.designation}) in ${assignedTeam}.`,
        timestamp: nowIso,
        status: 'assigned',
        actor: actor.name,
        actorType: 'officer',
        visibility: 'public',
      });

      return {
        ...withEvent,
        // Assigning must not drag a complaint that is already being
        // worked on, or resolved, back to "assigned".
        status: existing.status === 'pending' ? 'assigned' : existing.status,
        updatedAt: nowIso,
        department: { ...existing.department, assignedTeam },
        assignedOfficer: {
          name: officer.name,
          designation: officer.designation,
          staffId: officer.staffId,
          team: assignedTeam,
          phone: officer.phone,
        },
        latestUpdate: {
          title: isReassignment ? `Reassigned to ${officer.name}` : `Assigned to ${officer.name}`,
          description: `Task assigned to ${assignedTeam}. Work scheduled.`,
          timestamp: nowIso,
        },
      };
    },
    audit: (existing) => ({
      action: existing.assignedOfficer?.name ? 'complaint_reassigned_officer' : 'complaint_assigned',
      description: `Assigned to ${officer.name} (${officer.designation})`,
      metadata: {
        officer: officer.name,
        team: teamName || officer.team || '',
        previousOfficer: existing.assignedOfficer?.name ?? '',
      },
    }),
    sync: () => ({
      type: 'ASSIGN_COMPLAINT',
      summary: `Assign to ${officer.name}`,
      payload: { officer: officer.name },
    }),
  });
}

/** Officer starts on-site work. */
export async function startWorkOnComplaint(
  complaintId: string,
  expectedVersion?: number
): Promise<OperationResult> {
  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      if (existing.status === 'resolved') return null;
      const nowIso = new Date().toISOString();

      const withEvent = appendEvent(existing, {
        id: `evt-startwork-${Date.now()}`,
        title: 'On-site work commenced',
        description: 'The field team has arrived on site and begun work.',
        timestamp: nowIso,
        status: 'in-progress',
        actor: actor.name,
        actorType: 'officer',
        visibility: 'public',
      });

      return {
        ...withEvent,
        status: 'in-progress',
        updatedAt: nowIso,
        latestUpdate: {
          title: 'On-site work in progress',
          description: 'The operations team is working at the reported location.',
          timestamp: nowIso,
        },
      };
    },
    audit: () => ({ action: 'work_started', description: 'Marked on-site work as started' }),
    sync: () => ({ type: 'START_WORK', summary: 'Start on-site work' }),
  });
}

/** Post a progress note, with optional field photos. */
export async function addDepartmentProgressUpdate(
  complaintId: string,
  note: string,
  photos: string[] = [],
  isInternal: boolean = false,
  expectedVersion?: number
): Promise<OperationResult> {
  if (!note.trim()) {
    return { ok: false, reason: 'invalid', message: 'Write a short note describing the progress.' };
  }

  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      const nowIso = new Date().toISOString();

      const withEvent = appendEvent(existing, {
        id: `evt-progress-${Date.now()}`,
        title: isInternal ? 'Internal operational note' : 'Field progress update',
        description: note,
        timestamp: nowIso,
        status: existing.status,
        actor: actor.name,
        actorType: 'officer',
        // Internal notes stay out of the citizen's timeline entirely.
        visibility: isInternal ? 'internal' : 'public',
        photos: photos.length > 0 ? photos : undefined,
      });

      return {
        ...withEvent,
        updatedAt: nowIso,
        latestUpdate: isInternal
          ? existing.latestUpdate
          : { title: 'Field progress update', description: note, timestamp: nowIso },
      };
    },
    audit: () => ({
      action: photos.length > 0 ? 'evidence_added' : 'progress_update_added',
      description: isInternal
        ? `Internal note added${photos.length ? ` with ${photos.length} photo(s)` : ''}`
        : `Progress update posted${photos.length ? ` with ${photos.length} photo(s)` : ''}`,
      metadata: { visibility: isInternal ? 'internal' : 'public', photos: String(photos.length) },
    }),
    sync: () => ({
      type: 'ADD_PROGRESS_UPDATE',
      summary: isInternal ? 'Internal note' : 'Progress update',
      payload: { photos: photos.length, internal: isInternal },
    }),
  });
}

/**
 * Submit a resolution with a note and graded photo evidence.
 *
 * `integrity` carries the provenance bound to each photo at shutter. It
 * is optional at the type level only so older callers keep compiling;
 * every path in the department portal supplies it, and a resolution
 * arriving without it is graded `unverified` rather than assumed clean.
 *
 * A resolution whose evidence is graded `disputed` is REFUSED here, not
 * merely flagged. That is the difference between making evidence fraud
 * punishable after the fact and making it non-submittable.
 */
export async function submitDepartmentResolution(
  complaintId: string,
  resolutionNote: string,
  evidencePhotos: string[],
  expectedVersion?: number,
  integrity?: CaptureIntegrity[]
): Promise<OperationResult> {
  if (!resolutionNote.trim()) {
    return { ok: false, reason: 'invalid', message: 'Describe what was done before submitting.' };
  }
  if (evidencePhotos.length === 0) {
    return { ok: false, reason: 'invalid', message: 'Attach at least one photo of the completed work.' };
  }

  const grades = (integrity ?? []).map((i) => i.grade);
  const evidenceGrade: CaptureIntegrityGrade =
    grades.length > 0 ? worstGrade(grades) : 'unverified';

  if (evidenceGrade === 'disputed') {
    const failed = (integrity ?? [])
      .flatMap((i) => i.checks)
      .filter((c) => c.severity === 'blocking' && c.passed === false);

    return {
      ok: false,
      reason: 'invalid',
      message:
        failed.length > 0
          ? `This resolution cannot be submitted: ${failed[0].detail}`
          : 'This resolution cannot be submitted: the evidence failed a provenance check.',
    };
  }

  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      const nowIso = new Date().toISOString();

      // ------------------------------------------------------
      // The repair goes on the asset's permanent ledger here.
      //
      // Recorded when the DEPARTMENT says the work is done, not when
      // the citizen later confirms it. Whether it held is a separate
      // question, answered by deferred verification and by the next
      // repeat failure — and both of those need this entry to exist.
      // ------------------------------------------------------
      const asset = assetForComplaint(existing);
      let repairId: string | undefined;

      if (asset) {
        repairId = recordRepair({
          assetId: asset.id,
          complaintId: existing.id,
          category: existing.issue.category,
          completedAt: nowIso,
          note: resolutionNote,
          crew: existing.department.assignedTeam ?? existing.assignedOfficer?.team,
          evidenceHash: integrity?.[0]?.perceptualHash,
          captureGrade: evidenceGrade,
        }).id;
      }

      // Index every accepted photo, so the same image cannot close a
      // second complaint anywhere in the city.
      for (const capture of integrity ?? []) {
        recordEvidenceHash(capture.perceptualHash, existing.id, asset?.id, capture.sha256);
      }

      // A shared issue is closed PROVISIONALLY. Every citizen who
      // reported it keeps their own vote.
      const sharedIssue = getIssueForComplaint(existing.id);
      if (sharedIssue) markProvisionallyClosed(sharedIssue.id);

      const withEvent = appendEvent(existing, {
        id: `evt-resolution-${Date.now()}`,
        title: 'Resolution submitted — awaiting citizen verification',
        description: resolutionNote,
        timestamp: nowIso,
        status: 'resolved',
        actor: actor.name,
        actorType: 'officer',
        visibility: 'public',
        photos: evidencePhotos,
      });

      return {
        ...withEvent,
        status: 'resolved',
        updatedAt: nowIso,
        resolution: {
          ...existing.resolution,
          evidencePhotos,
          resolvedAt: nowIso,
          resolutionNote,
          resolvedBy: actor.name,
          // The department closing a job is not the citizen agreeing it
          // is fixed. Only the citizen sets this, from /track.
          citizenVerifiedResolved: false,
          captureIntegrity: integrity,
          evidenceGrade,
          assetRepairId: repairId,
        },
        latestUpdate: {
          title: 'Resolved — awaiting your confirmation',
          description: resolutionNote,
          timestamp: nowIso,
        },
      };
    },
    audit: () => ({
      action: 'resolution_submitted',
      description: `Resolution submitted with ${evidencePhotos.length} evidence photo(s), capture grade: ${evidenceGrade}`,
      metadata: {
        photos: String(evidencePhotos.length),
        evidenceGrade,
        hashes: (integrity ?? []).map((i) => i.perceptualHash).join(','),
      },
    }),
    sync: () => ({
      type: 'SUBMIT_RESOLUTION',
      summary: 'Submit resolution',
      payload: { photos: evidencePhotos.length },
    }),
  });
}

/** Department accepts a citizen's reinspection request. */
export async function acceptDepartmentReinspection(
  complaintId: string,
  note: string = 'Reinspection accepted. A priority field team has been redeployed.',
  expectedVersion?: number
): Promise<OperationResult> {
  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      if (!existing.feedback?.reinspectionRequested) return null;
      const nowIso = new Date().toISOString();

      const withEvent = appendEvent(existing, {
        id: `evt-reinspect-ack-${Date.now()}`,
        title: 'Reinspection accepted',
        description: note,
        timestamp: nowIso,
        status: 'in-progress',
        actor: actor.name,
        actorType: 'officer',
        visibility: 'public',
      });

      return {
        ...withEvent,
        status: 'in-progress',
        updatedAt: nowIso,
        feedback: {
          ...existing.feedback,
          // Cleared because the request has been taken up, not dismissed;
          // the timeline entry above is the durable record of it.
          reinspectionRequested: false,
          reinspectionNote: note,
        },
        latestUpdate: { title: 'Reinspection in progress', description: note, timestamp: nowIso },
      };
    },
    audit: () => ({ action: 'reinspection_accepted', description: 'Citizen reinspection request accepted' }),
    sync: () => ({ type: 'ACCEPT_REINSPECTION', summary: 'Accept reinspection' }),
  });
}

/**
 * Independent re-inspection of a sampled closure.
 *
 * The officer who did the work cannot sign off their own audit. That
 * one rule is what makes this a control rather than a formality, and it
 * is enforced here rather than left to procedure — refusing at the
 * mutation layer means no screen can accidentally allow it.
 *
 * This sampling is also the field-validation mechanism the platform
 * would need before it could honestly build anything predictive. A
 * Washington DC rat-infestation model validated well on held-out 311
 * data and then failed against actual field inspections; the lesson was
 * that only field assessment tests validity.
 */
export async function recordAuditReinspection(
  complaintId: string,
  outcome: 'upheld' | 'failed',
  note: string,
  expectedVersion?: number
): Promise<OperationResult> {
  if (!note.trim()) {
    return { ok: false, reason: 'invalid', message: 'Record what you found on the re-inspection.' };
  }

  return applyComplaintMutation({
    complaintId,
    expectedVersion,
    mutate: (existing, actor) => {
      // Self-audit is refused outright.
      const closedBy = (existing.resolution?.resolvedBy ?? '').trim().toLowerCase();
      if (closedBy && closedBy === actor.name.trim().toLowerCase()) return null;

      const nowIso = new Date().toISOString();

      const withEvent = appendEvent(existing, {
        id: `evt-audit-${Date.now()}`,
        title: outcome === 'upheld' ? 'Independent re-inspection: upheld' : 'Independent re-inspection: failed',
        description: note,
        timestamp: nowIso,
        status: outcome === 'upheld' ? 'resolved' : 'in-progress',
        actor: actor.name,
        actorType: 'officer',
        visibility: 'public',
      });

      const verification = {
        ...existing.verification,
        auditSampled: true,
        auditSampledAt: existing.verification?.auditSampledAt ?? nowIso,
        auditOutcome: outcome,
        auditedBy: actor.name,
        auditNote: note,
      };

      if (outcome === 'upheld') return { ...withEvent, verification, updatedAt: nowIso };

      // A failed audit reopens the job. A closure that does not survive
      // an inspection was not a closure.
      return {
        ...withEvent,
        status: 'in-progress',
        updatedAt: nowIso,
        verification,
        resolution: {
          ...existing.resolution,
          resolvedAt: undefined,
          citizenVerifiedResolved: false,
        },
        sla: {
          ...existing.sla,
          dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          status: 'normal',
        },
      };
    },
    audit: () => ({
      action: 'sla_review',
      description: `Independent re-inspection recorded as ${outcome}`,
      metadata: { outcome, note },
    }),
    sync: () => ({ type: 'ACCEPT_REINSPECTION', summary: `Audit re-inspection (${outcome})` }),
  });
}

// ------------------------------------------------------------
// Derived operational metrics
// ------------------------------------------------------------
//
// Everything below is COMPUTED from the shared complaint records on every
// read. There are no stored counters to drift, and no UI event increments
// a metric. If a number here looks wrong, the records say so.

/** Complaints a department is answerable for. */
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
  /** Resolved inside its SLA window — the numerator for compliance. */
  let resolvedOnTime = 0;

  for (const c of deptComplaints) {
    const isResolved = c.status === 'resolved';
    // Health is derived from `dueAt` against the clock, never from the
    // persisted `sla.status`, which is a snapshot from write time.
    const health = computeSlaHealth(c, now);

    if (isResolved) {
      resolved += 1;
      if (c.resolution?.citizenVerifiedResolved) citizenVerified += 1;
      if (health && health.msRemaining >= 0) resolvedOnTime += 1;

      if (c.resolution?.resolvedAt) {
        const created = new Date(c.createdAt).getTime();
        const res = new Date(c.resolution.resolvedAt).getTime();
        if (res > created) {
          totalResolutionHoursSum += Math.max(1, Math.round((res - created) / 3_600_000));
          resolvedWithTimestampCount += 1;
        }
      }
    } else {
      active += 1;
      if (c.status === 'pending') pending += 1;
      else if (c.status === 'assigned') assigned += 1;
      else if (c.status === 'in-progress') inProgress += 1;
      else if (c.status === 'resolution-submitted') resolutionSubmitted += 1;

      if (!c.assignedOfficer?.name) unassigned += 1;
      if (c.feedback?.reinspectionRequested) reinspectionRequested += 1;

      if (health?.status === 'exceeded') slaBreached += 1;
      else if (health?.status === 'approaching') slaAtRisk += 1;
    }

    // Escalation is a state a complaint is in, counted once. The previous
    // version added one for a breached SLA and another for the escalated
    // status, so a single escalated complaint showed as two.
    if (c.status === 'escalated' || c.sla.escalatedAt) escalated += 1;

    if (c.feedback?.rating) {
      totalRatingSum += c.feedback.rating;
      ratingsCount += 1;
    }

    const priorityScore = c.aiAnalysis?.priorityScore ?? 70;
    const severity = c.aiAnalysis?.severity ?? 'medium';
    if (priorityScore >= 90 || severity === 'critical') criticalPriority += 1;
    else if (priorityScore >= 75 || severity === 'high') highPriority += 1;
  }

  const totalReceived = deptComplaints.length;

  // No records means no rate. A department with nothing filed against it
  // has not achieved 94% resolution — it has no resolution rate at all,
  // and the UI renders that as a dash rather than a flattering number.
  const resolutionRatePercent = totalReceived > 0 ? Math.round((resolved / totalReceived) * 100) : 0;

  // Compliance is measured over complaints whose SLA outcome is settled:
  // resolved on time, or currently breached. Work still inside its window
  // has neither passed nor failed and must not dilute either side.
  const slaSettled = resolved + slaBreached;
  const slaCompliancePercent = slaSettled > 0 ? Math.round((resolvedOnTime / slaSettled) * 100) : 0;

  const citizenSatisfactionAverage =
    ratingsCount > 0 ? Number((totalRatingSum / ratingsCount).toFixed(1)) : 0;

  const averageResolutionHours =
    resolvedWithTimestampCount > 0
      ? Math.round(totalResolutionHoursSum / resolvedWithTimestampCount)
      : 0;

  // ----------------------------------------------------------
  // Outcome quality
  // ----------------------------------------------------------
  // These are the inputs that stop the score from being a measure of
  // how fast a department can close things. Each one is derived, and
  // each one reports "not measurable yet" rather than a default.

  const durability = computeDurabilityStats(deptComplaints);
  const repeatFailures = findRepeatFailures(deptComplaints).length;

  let resolutionsWithEvidence = 0;
  let integritySum = 0;
  let disputedEvidenceCount = 0;

  for (const c of deptComplaints) {
    const evidence = c.resolution?.evidencePhotos ?? [];
    if (evidence.length === 0) continue;

    resolutionsWithEvidence += 1;

    // A resolution recorded before capture grading existed is graded
    // `unverified` rather than assumed clean — it genuinely was not
    // checked, and saying so is the whole point of the grade.
    const grade = c.resolution?.evidenceGrade ?? 'unverified';
    integritySum += gradePoints(grade);
    if (grade === 'disputed') disputedEvidenceCount += 1;
  }

  // Active field and nodal staff carrying work. Heads are excluded:
  // a department head is not a spare pair of hands for the backlog.
  const officerCount = Math.max(
    1,
    (DEPARTMENTS[deptId as DepartmentId]?.mockStaff ?? []).filter((s) => s.role !== 'head').length
  );

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

    citizenVerifiedRatePercent: resolved > 0 ? Math.round((citizenVerified / resolved) * 100) : 0,
    durabilityFailures: durability.failed,
    durabilityHolding: durability.holding,
    durabilityRatePercent: durability.durabilityRate,
    repeatFailures,
    // Measured against resolutions, not against everything received: a
    // department cannot have a repeat-failure rate on work it has not
    // done yet.
    repeatFailureRatePercent: resolved > 0 ? Math.round((repeatFailures / resolved) * 100) : null,
    resolutionsWithEvidence,
    evidenceIntegrityPercent:
      resolutionsWithEvidence > 0
        ? Math.round((integritySum / resolutionsWithEvidence) * 100)
        : null,
    disputedEvidenceCount,
    auditsCompleted: durability.auditsCompleted,
    auditsUpheld: durability.auditsUpheld,
    workloadPerOfficer: Number((active / officerCount).toFixed(2)),
  };
}

/**
 * Where one department stands against the others, WITHOUT disclosing what
 * the others scored.
 *
 * A department head is entitled to know whether they are behind. They are
 * not entitled to Water Services' backlog, and a leaderboard naming every
 * department's figures inside the department portal would be exactly the
 * cross-department exposure the session scope is meant to prevent. The
 * full comparison lives in the Command Centre, behind admin authority.
 */
export function getDepartmentRank(deptId: string): { rank: number; total: number } | null {
  const ids = Object.keys(DEPARTMENTS) as DepartmentId[];

  const scored = ids
    .map((id) => {
      const metrics = getDepartmentMetrics(id);
      const breakdown = calculatePerformanceScore(metrics);
      return { id, score: breakdown.totalScore, ranked: breakdown.tier !== 'no-data' };
    })
    .filter((row) => row.ranked)
    .sort((a, b) => b.score - a.score);

  const index = scored.findIndex((row) => row.id === deptId);
  if (index === -1) return null;

  return { rank: index + 1, total: scored.length };
}

/** Triage query: items requiring action now. */
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
    if (c.status === 'resolved') continue;

    const health = computeSlaHealth(c, now);
    if (health?.status === 'exceeded') breached.push(c);
    else if (health?.status === 'approaching') atRisk.push(c);

    if (!c.assignedOfficer?.name) unassigned.push(c);
    if (c.feedback?.reinspectionRequested) reinspection.push(c);
  }

  return { breached, atRisk, unassigned, reinspection };
}

/**
 * Closures this department owes an independent re-inspection.
 *
 * Excludes anything the requesting officer closed themselves, so the
 * queue an officer sees is only work they are allowed to audit.
 */
export function getDepartmentAuditQueue(deptId: string, officerName?: string): Complaint[] {
  const queue = getAuditQueue(getComplaintsByDepartment(deptId));
  if (!officerName) return queue;

  const self = officerName.trim().toLowerCase();
  return queue.filter((c) => (c.resolution?.resolvedBy ?? '').trim().toLowerCase() !== self);
}

/** Complaints whose asset has failed again since it was last repaired. */
export function getDepartmentRepeatFailures(deptId: string) {
  return findRepeatFailures(getComplaintsByDepartment(deptId));
}

/** Escalated or SLA-breached complaints. */
export function getDepartmentEscalations(deptId?: string): Complaint[] {
  const all = deptId ? getComplaintsByDepartment(deptId) : readStore();
  const now = Date.now();

  return all.filter((c) => {
    if (c.status === 'escalated') return true;
    if (c.status === 'resolved') return false;
    return computeSlaHealth(c, now)?.status === 'exceeded';
  });
}

/**
 * Complaints assigned to one officer.
 *
 * Matched on staff ID where the assignment carries one. The previous
 * `norm.includes(officerName)` fallback matched an empty officer name
 * against every unassigned complaint, so a field officer's list filled
 * with work nobody had given them.
 */
export function getMyWorkComplaints(deptId: string, staffId: string, staffName?: string): Complaint[] {
  const deptComplaints = getComplaintsByDepartment(deptId);
  const id = staffId.toLowerCase().trim();
  const name = (staffName ?? '').toLowerCase().trim();

  return deptComplaints.filter((c) => {
    if (c.status === 'resolved') return false;

    const assignedId = (c.assignedOfficer?.staffId || '').toLowerCase();
    const assignedName = (c.assignedOfficer?.name || '').toLowerCase();
    if (!assignedId && !assignedName) return false;

    if (assignedId && assignedId === id) return true;
    return Boolean(name) && assignedName === name;
  });
}
