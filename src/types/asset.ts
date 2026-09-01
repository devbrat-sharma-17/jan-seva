// ============================================================
// Civic Asset Types — the physical layer
// ============================================================
//
// Until now JAN-SEVA modelled complaints. A complaint is a report about
// the city; it is not the city. Because nothing represented the road, the
// pole or the drain, the system could say "a pothole was reported here"
// and could not say "this fifty metres of road has been repaired four
// times this year".
//
// A CivicAsset is that missing noun. Complaints snap to one; repairs
// accumulate on it; and a fresh complaint against an asset repaired
// recently is a REPEAT FAILURE rather than a new job — which, inside an
// Indian road contract's defect liability period, is a warranty claim
// against the contractor rather than a new municipal expense.
//
// Privacy note: assets are public infrastructure. This layer carries no
// PII at all, which is what makes it safe to publish (see open311Service).

import type { DepartmentId } from './department';

export type AssetKind =
  | 'road-segment'
  | 'streetlight-pole'
  | 'drain-node'
  | 'bin-point'
  | 'footpath'
  | 'public-utility';

/**
 * A piece of city infrastructure with an identity that outlives any one
 * complaint about it.
 */
export interface CivicAsset {
  /** Stable public reference, e.g. "GWL-RD-0142". Printed on the ledger. */
  id: string;
  kind: AssetKind;
  /** Human name used in the UI: "Phool Bagh Road (City Centre stretch)". */
  name: string;
  locality: string;
  wardId: string;
  centroid: { latitude: number; longitude: number };
  /**
   * Both ends of a linear asset. Present only on segments.
   *
   * Snapping measures perpendicular distance to the SEGMENT, not to its
   * centroid: a pothole at the far end of a 300 m stretch is 150 m from
   * the midpoint and would be rejected by a centroid test, even though it
   * is unambiguously on that road.
   */
  endpoints?: [{ latitude: number; longitude: number }, { latitude: number; longitude: number }];
  /** Segments have length; point assets (poles, drains, bins) do not. */
  lengthMetres?: number;
  /** Complaint categories that can legitimately snap to this asset. */
  categories: string[];
  /**
   * How close a complaint must be to snap here. A 300 m road segment
   * accepts a wider radius than a single lamp column, which is why this
   * is per-asset rather than one global constant.
   */
  snapRadiusMetres: number;
  custodianDepartment: DepartmentId;
  installedAt?: string;
}

/**
 * One completed repair, appended to an asset's permanent ledger.
 *
 * `contractorId` and `crew` are recorded but never published — see the
 * note on attribution in assetService. Getting this wrong is a
 * procurement dispute, not a UI bug.
 */
export interface AssetRepair {
  id: string;
  assetId: string;
  /** The complaint whose resolution produced this repair, when there was one. */
  complaintId?: string;
  category: string;
  completedAt: string;
  /** Free-text description of the work, as written by the closing officer. */
  note: string;
  /** Internal attribution. Never rendered on a public surface. */
  crew?: string;
  contractorId?: string;
  contractorName?: string;
  /**
   * Defect liability period, in months from `completedAt`. Indian
   * municipal road contracts commonly run 12-36 months; Chandigarh MC
   * raised its road DLP from one year to three.
   */
  defectLiabilityMonths?: number;
  /** Perceptual hash of the evidence photo, so the repair is checkable later. */
  evidenceHash?: string;
  /** Capture integrity of the evidence at the moment it was submitted. */
  captureGrade?: 'verified' | 'unverified' | 'disputed';
  /** Indicative works cost in rupees. Seeded data only — never invoiced from. */
  costEstimate?: number;
  /** Set when a later failure was formally disputed by the contractor. */
  disputed?: boolean;
}

/**
 * A new complaint of the same category on an asset that was repaired
 * recently. This is the finding the whole asset layer exists to produce.
 */
export interface RepeatFailure {
  assetId: string;
  assetName: string;
  category: string;
  /** The repair this failure lands against. */
  repair: AssetRepair;
  complaintId: string;
  reportedAt: string;
  daysSinceRepair: number;
  /** True when the failure falls inside the repair's recorded DLP window. */
  withinWarranty: boolean;
  /** When the DLP on that repair expires, or null when none was recorded. */
  warrantyExpiresAt: string | null;
  /** Recoverable value if the warranty claim holds. Null without a cost. */
  recoverableEstimate: number | null;
}

/** Everything known about one asset, assembled for the ledger screen. */
export interface AssetHistory {
  asset: CivicAsset;
  /** Complaint IDs snapped to this asset, newest first. */
  complaintIds: string[];
  repairs: AssetRepair[];
  repeatFailures: RepeatFailure[];
  totalComplaints: number;
  totalRepairs: number;
  /** Repairs still inside their defect liability period. */
  underWarrantyCount: number;
  /** Days between the two most recent repairs, or null with fewer than two. */
  medianDaysBetweenRepairs: number | null;
  /** Sum of `recoverableEstimate` across in-warranty repeat failures. */
  recoverableTotal: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
}

/** Result of snapping a coordinate to the asset registry. */
export interface AssetSnapResult {
  asset: CivicAsset;
  distanceMetres: number;
}
