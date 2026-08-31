// ============================================================
// Privacy Service — Public projection & retention
// ============================================================
// Knowing a Complaint ID buys convenience, not the reporter's identity.
// `toPublicComplaint` is the single place that decides what a Complaint-ID
// holder may see. Because `PublicComplaint` simply has no `reporter` field,
// a component rendering the public view cannot leak a name or number even
// by mistake — the compiler stops it.

import type { Complaint, PublicComplaint, LookupOutcome } from '../types';

/** A resolved complaint stays publicly trackable for this long. */
export const PUBLIC_RETENTION_MS = 48 * 60 * 60 * 1000;

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

/** The instant a complaint drops out of public tracking, if it ever does. */
export function computeExpiresAt(complaint: Complaint): string | undefined {
  const anchor = retentionAnchor(complaint);
  return anchor === null ? undefined : new Date(anchor + PUBLIC_RETENTION_MS).toISOString();
}

/**
 * Only resolved complaints expire. An open complaint — however old — stays
 * trackable, because the citizen is still waiting on it.
 */
export function isPubliclyTrackable(complaint: Complaint, now: number = Date.now()): boolean {
  if (complaint.status !== 'resolved') return true;
  const anchor = retentionAnchor(complaint);
  if (anchor === null) return true;
  return now - anchor < PUBLIC_RETENTION_MS;
}

/** Milliseconds until public tracking ends; null when it never does. */
export function timeUntilExpiry(complaint: Complaint, now: number = Date.now()): number | null {
  if (complaint.status !== 'resolved') return null;
  const anchor = retentionAnchor(complaint);
  if (anchor === null) return null;
  return anchor + PUBLIC_RETENTION_MS - now;
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
    return {
      kind: 'expired',
      resolvedAt: complaint.resolution?.resolvedAt ?? complaint.updatedAt,
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
