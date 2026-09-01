// ============================================================
// Privacy Service — Public projection & retention
// ============================================================
// Knowing a Complaint ID buys convenience, not the reporter's identity.
// `toPublicComplaint` is the single place that decides what a Complaint-ID
// holder may see. Because `PublicComplaint` simply has no `reporter` field,
// a component rendering the public view cannot leak a name or number even
// by mistake — the compiler stops it.

import type { Complaint, PublicComplaint, LookupOutcome } from '../types';
import { assetForComplaint, detectRepeatFailure } from './assetService';

// ------------------------------------------------------------
// RETENTION IS SPLIT. This is the change everything else rests on.
// ------------------------------------------------------------
//
// The previous rule deleted a resolved complaint from public tracking
// after 48 hours. That protected the citizen, and it also destroyed the
// city's memory: the product could not answer "has this been fixed
// before?" — the single most important question in municipal
// maintenance — because nothing survived long enough to be asked about.
//
// The two things being protected are different and now expire
// differently:
//
//   IDENTITY expires at 48 hours. After that the record is no longer
//   linked to the citizen who reported it, no longer appears in their
//   complaint list, and no longer accepts their actions.
//
//   THE CIVIC RECORD DOES NOT EXPIRE. What was broken, where, which
//   department fixed it, whether the evidence was verified, and whether
//   it held — that is a record about public infrastructure and public
//   money, not about a person. It becomes an ARCHIVED record: readable,
//   attached to its asset, and permanent.
//
// The archived projection carries no identity, no coordinates, no
// officer contact and no photographs. It is strictly narrower than the
// live public projection, so archival only ever removes.

/** A resolved complaint stays linked to its reporter for this long. */
export const IDENTITY_RETENTION_MS = 48 * 60 * 60 * 1000;

/** @deprecated Renamed. Kept so existing imports keep compiling. */
export const PUBLIC_RETENTION_MS = IDENTITY_RETENTION_MS;

/**
 * When retention starts. `resolvedAt` is authoritative; `updatedAt` is the
 * fallback for older records written before the field existed.
 */
function retentionAnchor(complaint: Complaint): number | null {
  const resolvedAt = complaint.resolution?.resolvedAt;
  if (resolvedAt) {
    const t = new Date(resolvedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (complaint.status === 'resolved') {
    const t = new Date(complaint.updatedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** The instant a complaint stops being linked to its reporter. */
export function computeExpiresAt(complaint: Complaint): string | undefined {
  const anchor = retentionAnchor(complaint);
  return anchor === null ? undefined : new Date(anchor + IDENTITY_RETENTION_MS).toISOString();
}

/**
 * Whether the record is still the reporter's own.
 *
 * Only resolved complaints ever stop being trackable this way. An open
 * complaint — however old — stays linked, because the citizen is still
 * waiting on it, and expiring it would be the platform walking away
 * from an unfinished job.
 */
export function isPubliclyTrackable(complaint: Complaint, now: number = Date.now()): boolean {
  if (complaint.status !== 'resolved') return true;
  const anchor = retentionAnchor(complaint);
  if (anchor === null) return true;
  return now - anchor < IDENTITY_RETENTION_MS;
}

/** True once identity retention has lapsed and only the civic record remains. */
export function isArchived(complaint: Complaint, now: number = Date.now()): boolean {
  return !isPubliclyTrackable(complaint, now);
}

/** Milliseconds until public tracking ends; null when it never does. */
export function timeUntilExpiry(complaint: Complaint, now: number = Date.now()): number | null {
  if (complaint.status !== 'resolved') return null;
  const anchor = retentionAnchor(complaint);
  if (anchor === null) return null;
  return anchor + IDENTITY_RETENTION_MS - now;
}

/**
 * Blurring happens in CSS on a downscaled `<img>`, not by rewriting pixels:
 * the citizen must still be able to tell a pothole from an overflowing bin,
 * which is the whole point of a public status page. What it protects is the
 * incidental detail — faces, plates, house numbers, doorways — that a full
 * resolution photo carries and a status check does not need.
 */
function protectPhotos(photos: string[] | undefined): string[] {
  return (photos ?? []).slice(0, 3);
}

/**
 * Redacts a complaint down to what a Complaint-ID holder may see.
 * Drops: reporter identity, coordinates, street address, AI routing
 * internals, and the original photo assets.
 */
export function toPublicComplaint(complaint: Complaint, now: number = Date.now()): PublicComplaint {
  return {
    id: complaint.id,
    cityId: complaint.cityId,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    status: complaint.status,

    issue: {
      category: complaint.issue.category,
      title: complaint.issue.title,
      description: complaint.issue.description,
    },

    photoCount: complaint.photos.length,
    protectedPhotos: protectPhotos(complaint.photos),
    resolutionEvidenceCount: complaint.resolution?.evidencePhotos?.length ?? 0,
    protectedResolutionPhotos: protectPhotos(complaint.resolution?.evidencePhotos),

    // Locality granularity only. The exact address and the coordinates the
    // citizen confirmed at report time stay behind verification.
    area: {
      locality: complaint.location.locality,
      city: complaint.location.city,
      state: complaint.location.state,
    },

    department: complaint.department,
    assignedOfficer: complaint.assignedOfficer,
    sla: complaint.sla,
    timeline: complaint.timeline,
    latestUpdate: complaint.latestUpdate,
    duplicate: complaint.duplicate,

    resolution: complaint.resolution
      ? {
          resolvedAt: complaint.resolution.resolvedAt,
          citizenVerifiedResolved: complaint.resolution.citizenVerifiedResolved,
        }
      : undefined,

    expiresAt: computeExpiresAt(complaint),
    isPubliclyTrackable: isPubliclyTrackable(complaint, now),
    isArchived: false,

    // The asset link and its history survive archival, because they are
    // facts about public infrastructure rather than about a person.
    assetId: assetForComplaint(complaint)?.id,
    isRepeatFailure: detectRepeatFailure(complaint) !== null,
    evidenceGrade: complaint.resolution?.evidenceGrade,
  };
}

/**
 * The permanent civic record, after identity retention has lapsed.
 *
 * Strictly narrower than the live public projection: archival only ever
 * removes. Gone are the officer (a named municipal employee attached to
 * a specific citizen's complaint), the photographs, and the internal
 * timeline. What remains is what was broken, where at locality
 * granularity, which department answered for it, whether the evidence
 * was verified and whether the fix held.
 */
export function toArchivedComplaint(complaint: Complaint, now: number = Date.now()): PublicComplaint {
  const live = toPublicComplaint(complaint, now);

  return {
    ...live,
    isArchived: true,
    isPubliclyTrackable: false,

    // A named officer tied to one identifiable complaint is a person.
    // The department stays; the individual does not.
    assignedOfficer: undefined,

    // Photographs can carry faces, plates and doorways. A permanent
    // public record has no business holding them.
    protectedPhotos: [],
    protectedResolutionPhotos: [],

    // The timeline is written for the citizen and names the officers who
    // acted. Archival keeps the outcome and drops the narrative.
    timeline: [],

    // Free-text feedback is the citizen's own voice and can identify
    // them. The rating is a number about the service and stays.
    feedback: complaint.feedback?.rating
      ? { rating: complaint.feedback.rating, submittedAt: complaint.feedback.submittedAt }
      : undefined,

    latestUpdate: {
      title: complaint.resolution?.citizenVerifiedResolved
        ? 'Resolved and confirmed by the citizen'
        : 'Closed by the department',
      description:
        'This is the permanent civic record. The reporting citizen is no longer linked to it.',
      timestamp: complaint.resolution?.resolvedAt ?? complaint.updatedAt,
    },
  };
}

/**
 * Resolves a public look-up into one of three outcomes. Expiry is reported
 * distinctly from "not found" so the citizen learns their complaint was
 * closed rather than being told it never existed — without any further
 * detail being disclosed.
 */
export function resolveLookup(complaint: Complaint | null, now: number = Date.now()): LookupOutcome {
  if (!complaint) return { kind: 'not-found' };

  if (!isPubliclyTrackable(complaint, now)) {
    // Not a dead end. The identity link has lapsed; the record of the
    // repair has not, and the citizen who looks it up deserves to see
    // that the work is on the city's permanent books.
    return {
      kind: 'expired',
      resolvedAt: complaint.resolution?.resolvedAt ?? complaint.updatedAt,
      archived: toArchivedComplaint(complaint, now),
    };
  }

  return { kind: 'found', complaint: toPublicComplaint(complaint, now) };
}

/**
 * The share message and the printed receipt both leave JAN-SEVA, so both are
 * built from the public projection only — never from the full record.
 */
export function buildShareMessage(complaint: PublicComplaint, trackingUrl: string): string {
  return [
    'JAN-SEVA Complaint Update',
    '',
    `Complaint ID: ${complaint.id}`,
    `Issue: ${complaint.issue.title}`,
    `Location: ${complaint.area.locality}, ${complaint.area.city}`,
    `Status: ${complaint.status.replace('-', ' ').toUpperCase()}`,
    `Department: ${complaint.department.name}`,
    '',
    `Track: ${trackingUrl}`,
  ].join('\n');
}
