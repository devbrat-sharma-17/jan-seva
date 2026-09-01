// ============================================================
// Open311 Service — GeoReport v2 projection
// ============================================================
//
// Municipal performance data in India is mostly reported by the
// municipality about itself. That is precisely the structure that
// produced the Swachh Survekshan credibility disputes.
//
// Open311 GeoReport v2 is the interoperability standard for civic
// service requests. Emitting it costs almost nothing and answers the
// question every municipal buyer asks first — "will this integrate with
// what the city already has?" — with a specification rather than a
// promise.
//
//   PRIVACY.
//   This projection is built from `PublicComplaint`, never from
//   `Complaint`. That is not a convention, it is the type system: the
//   redacted projection has no `reporter` field, so this file cannot
//   leak a name, a number or a coordinate even by mistake.
//
//   The asset ledger IS published, because assets are public
//   infrastructure and carry no PII. Contractor attribution is NOT
//   published — that is a procurement dispute waiting to happen, and it
//   stays behind the Command Centre.

import type { PublicComplaint } from '../types';
import type { AssetRepair, CivicAsset } from '../types/asset';

/** Open311 service codes, mapped from JAN-SEVA categories. */
export const SERVICE_CODES: Record<string, { code: string; name: string; group: string }> = {
  roads: { code: 'JS-ROAD-001', name: 'Road surface & potholes', group: 'Streets' },
  garbage: { code: 'JS-SANI-001', name: 'Garbage & sanitation', group: 'Sanitation' },
  water: { code: 'JS-WATR-001', name: 'Water supply & drainage', group: 'Water' },
  streetlights: { code: 'JS-ELEC-001', name: 'Street lighting', group: 'Streets' },
  infrastructure: { code: 'JS-INFR-001', name: 'Public infrastructure', group: 'Facilities' },
};

/** GeoReport v2 status vocabulary. It has exactly two values. */
type Open311Status = 'open' | 'closed';

export interface Open311ServiceRequest {
  service_request_id: string;
  status: Open311Status;
  status_notes: string;
  service_name: string;
  service_code: string;
  description: string;
  requested_datetime: string;
  updated_datetime: string;
  expected_datetime?: string;
  address: string;
  agency_responsible: string;
  /**
   * Deliberately absent: `lat`, `long`, `email`, `first_name`,
   * `last_name`, `phone`, `media_url`.
   *
   * GeoReport v2 permits all of them. Publishing exact coordinates for a
   * complaint filed from a home address is a re-identification risk that
   * a locality string does not carry, and the reporter fields are PII
   * this platform never holds in a publishable form to begin with.
   */
  jan_seva_locality: string;
  jan_seva_asset_id?: string;
  jan_seva_citizen_verified: boolean;
}

export interface Open311Service {
  service_code: string;
  service_name: string;
  description: string;
  metadata: boolean;
  type: 'realtime';
  group: string;
}

/** GET /services.json — the service list. */
export function buildServiceList(): Open311Service[] {
  return Object.values(SERVICE_CODES).map((def) => ({
    service_code: def.code,
    service_name: def.name,
    description: `Civic complaints in the ${def.name.toLowerCase()} category, routed to the responsible municipal department.`,
    metadata: false,
    type: 'realtime' as const,
    group: def.group,
  }));
}

/** One request, built from the redacted projection only. */
export function toServiceRequest(complaint: PublicComplaint): Open311ServiceRequest {
  const def = SERVICE_CODES[complaint.issue.category] ?? {
    code: 'JS-MISC-001',
    name: 'Other civic issue',
    group: 'Other',
  };

  return {
    service_request_id: complaint.id,
    // GeoReport has no "resolved but awaiting citizen confirmation".
    // Mapping a provisional close to `closed` would overstate it, so an
    // unconfirmed resolution stays `open` and says why in the notes.
    status: complaint.resolution?.citizenVerifiedResolved ? 'closed' : 'open',
    status_notes: describeStatus(complaint),
    service_name: def.name,
    service_code: def.code,
    description: complaint.issue.title,
    requested_datetime: complaint.createdAt,
    updated_datetime: complaint.updatedAt,
    expected_datetime: complaint.sla?.dueAt,
    address: `${complaint.area.locality}, ${complaint.area.city}, ${complaint.area.state}`,
    agency_responsible: complaint.department.name,
    jan_seva_locality: complaint.area.locality,
    jan_seva_citizen_verified: Boolean(complaint.resolution?.citizenVerifiedResolved),
  };
}

function describeStatus(complaint: PublicComplaint): string {
  if (complaint.resolution?.citizenVerifiedResolved) {
    return 'Resolved and confirmed by the reporting citizen.';
  }
  if (complaint.status === 'resolved') {
    return 'Work reported complete by the department; awaiting citizen confirmation. Not counted as closed.';
  }
  if (complaint.status === 'escalated') return 'Escalated past the departmental response window.';
  return `Open with ${complaint.department.name}.`;
}

export function buildRequestFeed(complaints: PublicComplaint[]): Open311ServiceRequest[] {
  return complaints.map(toServiceRequest);
}

// ------------------------------------------------------------
// Asset ledger extension
// ------------------------------------------------------------

export interface PublicAssetLedgerEntry {
  asset_id: string;
  asset_kind: string;
  asset_name: string;
  locality: string;
  ward_id: string;
  repairs: Array<{
    completed_at: string;
    category: string;
    note: string;
    /** Published so a warranty window is checkable from outside. */
    defect_liability_months?: number;
    /** Published: proves the photo exists and is unique. Not the photo. */
    evidence_hash?: string;
    evidence_grade?: string;
  }>;
}

/**
 * The asset repair record as open data.
 *
 * `contractorId`, `contractorName`, `crew` and `costEstimate` are
 * stripped. Naming a contractor in a public dataset on the strength of
 * an automated attribution is the single most likely way to get this
 * platform blocked at the municipal level.
 */
export function toPublicAssetLedger(
  asset: CivicAsset,
  repairs: AssetRepair[]
): PublicAssetLedgerEntry {
  return {
    asset_id: asset.id,
    asset_kind: asset.kind,
    asset_name: asset.name,
    locality: asset.locality,
    ward_id: asset.wardId,
    repairs: repairs.map((r) => ({
      completed_at: r.completedAt,
      category: r.category,
      note: r.note,
      defect_liability_months: r.defectLiabilityMonths,
      evidence_hash: r.evidenceHash,
      evidence_grade: r.captureGrade,
    })),
  };
}

/** A downloadable snapshot, for the "can I have the data?" question. */
export function buildOpenDataBundle(
  complaints: PublicComplaint[],
  assets: Array<{ asset: CivicAsset; repairs: AssetRepair[] }>
): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      specification:
        'Open311 GeoReport v2 (service_requests) + JAN-SEVA asset ledger extension',
      notice:
        'Personal data is absent by construction: this bundle is built from the public complaint projection, which has no reporter fields. Contractor attribution is deliberately excluded.',
      services: buildServiceList(),
      service_requests: buildRequestFeed(complaints),
      asset_ledger: assets.map(({ asset, repairs }) => toPublicAssetLedger(asset, repairs)),
    },
    null,
    2
  );
}
