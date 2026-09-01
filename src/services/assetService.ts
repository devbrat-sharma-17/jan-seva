// ============================================================
// Asset Service — Civic Asset Memory & Repeat-Failure Ledger
// ============================================================
//
// JAN-SEVA used to model complaints floating on coordinates. It could say
// "a pothole was reported at 26.2052, 78.1924" and could not say "this
// fifty metres of road has been repaired three times in eight months".
//
// This module anchors complaints to infrastructure and keeps the repair
// history on the infrastructure, where it belongs. Two consequences
// follow, and they are the whole point:
//
//   1. RECURRENCE becomes visible. A new complaint on a recently
//      repaired asset is a repeat failure, routed differently from a
//      first-time report.
//   2. RECURRENCE becomes MONEY. Indian municipal road contracts carry
//      defect liability periods of roughly 1-3 years. A repeat failure
//      inside that window is a warranty claim against the contractor,
//      not a new municipal expense.
//
//   ON ATTRIBUTION — read before exposing any of this.
//   `contractorId` is recorded and is visible to the Command Centre only.
//   It is never published, never shown to a citizen, and never included
//   in the Open311 projection. Getting attribution wrong is a defamation
//   problem and a procurement dispute, not a UI bug. A real deployment
//   requires a human confirmation step before attributing a failure to a
//   named contractor, and records disputes alongside failures.

import type {
  AssetHistory,
  AssetRepair,
  AssetSnapResult,
  CivicAsset,
  RepeatFailure,
} from '../types/asset';
import type { Complaint } from '../types';
import type { LatLng } from './geoService';
import { distanceMetres, distanceToSegmentMetres } from './geoService';
import { CIVIC_ASSETS } from '../data/civicAssets';
import { buildSeedAssetRepairs, DEFAULT_DLP_MONTHS } from '../data/assetLedger';
import { readJSON, writeJSON, subscribeToKey } from './storage';

const REPAIRS_KEY = 'jan_seva_asset_repairs_v1';

/**
 * A complaint of the same category arriving within this window of a
 * completed repair is treated as a repeat failure rather than a new job.
 *
 * 180 days is chosen against the physical failure mode, not the contract:
 * a patch that fails inside six months failed as workmanship. The
 * warranty question is separate and is answered by the recorded DLP.
 */
export const REPEAT_FAILURE_WINDOW_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------

export function getAssets(): CivicAsset[] {
  return CIVIC_ASSETS;
}

export function getAssetById(assetId: string): CivicAsset | undefined {
  return CIVIC_ASSETS.find((a) => a.id === assetId);
}

export function getAssetsInLocality(locality: string): CivicAsset[] {
  const needle = locality.trim().toLowerCase();
  return CIVIC_ASSETS.filter((a) => a.locality.toLowerCase() === needle);
}

/** Distance from a point to an asset — to the segment for linear assets. */
function distanceToAsset(point: LatLng, asset: CivicAsset): number {
  if (asset.endpoints) {
    return distanceToSegmentMetres(point, asset.endpoints[0], asset.endpoints[1]);
  }
  return distanceMetres(point, asset.centroid);
}

/**
 * Finds the asset a complaint belongs to.
 *
 * Category matters as much as distance: a garbage complaint standing on
 * a road segment belongs to the bin point twelve metres away, not to the
 * road it is standing on. Assets that do not accept the category are not
 * candidates at all, which is why this is not a plain nearest-neighbour.
 *
 * Returns null when nothing is close enough — an honest "not on a known
 * asset" is better than snapping to whatever happens to be nearest.
 */
export function snapToAsset(point: LatLng, category: string): AssetSnapResult | null {
  let best: AssetSnapResult | null = null;

  for (const asset of CIVIC_ASSETS) {
    if (!asset.categories.includes(category)) continue;

    const distance = distanceToAsset(point, asset);
    if (distance > asset.snapRadiusMetres) continue;

    if (!best || distance < best.distanceMetres) best = { asset, distanceMetres: distance };
  }

  return best;
}

/** Convenience: the asset a complaint sits on, or null. */
export function assetForComplaint(complaint: Complaint): CivicAsset | null {
  if (complaint.assetId) {
    const explicit = getAssetById(complaint.assetId);
    if (explicit) return explicit;
  }
  const snapped = snapToAsset(
    { latitude: complaint.location.latitude, longitude: complaint.location.longitude },
    complaint.issue.category
  );
  return snapped?.asset ?? null;
}

// ------------------------------------------------------------
// The repair ledger
// ------------------------------------------------------------

function readRepairs(): AssetRepair[] {
  const stored = readJSON<AssetRepair[] | null>(REPAIRS_KEY, null);
  if (!Array.isArray(stored)) {
    const seed = buildSeedAssetRepairs();
    try {
      writeJSON(REPAIRS_KEY, seed);
    } catch {
      // Seeding is best-effort; callers still receive usable history.
    }
    return seed;
  }
  return stored;
}

export function getAllRepairs(): AssetRepair[] {
  return readRepairs();
}

export function getRepairsForAsset(assetId: string): AssetRepair[] {
  return readRepairs()
    .filter((r) => r.assetId === assetId)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function subscribeToRepairs(onChange: () => void): () => void {
  return subscribeToKey(REPAIRS_KEY, onChange);
}

/**
 * Appends a completed repair to an asset's permanent record.
 *
 * This is the write that makes the ledger accumulate. It is called from
 * the resolution path, so a repair is recorded exactly when a department
 * says the work is done — not when a citizen later confirms it. The
 * durability of the fix is a separate question, answered by deferred
 * verification and by the next repeat failure.
 */
export function recordRepair(repair: Omit<AssetRepair, 'id'> & { id?: string }): AssetRepair {
  const entry: AssetRepair = {
    ...repair,
    id: repair.id ?? `REP-${repair.assetId.slice(-4)}-${Date.now().toString(36)}`,
    defectLiabilityMonths:
      repair.defectLiabilityMonths ?? DEFAULT_DLP_MONTHS[repair.category] ?? 0,
  };

  const next = [entry, ...readRepairs()];
  try {
    writeJSON(REPAIRS_KEY, next);
  } catch {
    // A full store loses the ledger entry, not the resolution itself.
    // The caller has already persisted the complaint.
  }
  return entry;
}

/** When the defect liability on a repair expires. Null when none was recorded. */
export function warrantyExpiryOf(repair: AssetRepair): string | null {
  const months = repair.defectLiabilityMonths ?? 0;
  if (months <= 0) return null;

  const expiry = new Date(repair.completedAt);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString();
}

export function isUnderWarranty(repair: AssetRepair, at: number = Date.now()): boolean {
  const expiry = warrantyExpiryOf(repair);
  return expiry !== null && new Date(expiry).getTime() > at;
}

// ------------------------------------------------------------
// Repeat failure detection
// ------------------------------------------------------------

/**
 * Whether this complaint is a fresh problem or the same one coming back.
 *
 * Matched on asset + category + recency. The category test matters: a
 * streetlight failing on a road segment that was resurfaced last month
 * is not a failed resurfacing, and calling it one would put a false
 * warranty claim in front of a contractor.
 */
export function detectRepeatFailure(complaint: Complaint): RepeatFailure | null {
  const asset = assetForComplaint(complaint);
  if (!asset) return null;

  const reportedAt = new Date(complaint.createdAt).getTime();

  // The most recent repair of this category that PRECEDES the report.
  // A repair completed after the complaint was filed is the response to
  // it, not the thing it failed against.
  const priorRepair = getRepairsForAsset(asset.id)
    .filter((r) => r.category === complaint.issue.category)
    .find((r) => new Date(r.completedAt).getTime() < reportedAt);

  if (!priorRepair) return null;

  const daysSince = Math.floor(
    (reportedAt - new Date(priorRepair.completedAt).getTime()) / DAY_MS
  );
  if (daysSince > REPEAT_FAILURE_WINDOW_DAYS) return null;

  const warrantyExpiresAt = warrantyExpiryOf(priorRepair);
  const withinWarranty =
    warrantyExpiresAt !== null && new Date(warrantyExpiresAt).getTime() > reportedAt;

  return {
    assetId: asset.id,
    assetName: asset.name,
    category: complaint.issue.category,
    repair: priorRepair,
    complaintId: complaint.id,
    reportedAt: complaint.createdAt,
    daysSinceRepair: Math.max(0, daysSince),
    withinWarranty,
    warrantyExpiresAt,
    // Only claimable when the warranty holds AND a cost was recorded.
    // A recoverable figure without both is a number we made up.
    recoverableEstimate: withinWarranty ? priorRepair.costEstimate ?? null : null,
  };
}

/** Every repeat failure currently visible across a set of complaints. */
export function findRepeatFailures(complaints: Complaint[]): RepeatFailure[] {
  return complaints
    .map((c) => detectRepeatFailure(c))
    .filter((f): f is RepeatFailure => f !== null)
    .sort((a, b) => a.daysSinceRepair - b.daysSinceRepair);
}

/**
 * What the city could recover if every in-warranty repeat failure were
 * pursued as a contractual claim.
 *
 * Deliberately conservative: failures without a recorded cost contribute
 * nothing rather than an assumed average. An inflated recoverable figure
 * is the fastest way to lose the finance conversation this whole feature
 * exists to start.
 */
export function getWarrantyExposure(complaints: Complaint[]): {
  failures: RepeatFailure[];
  inWarranty: RepeatFailure[];
  recoverableTotal: number;
  /** Failures inside warranty with no recorded cost — the unpriced tail. */
  unpricedCount: number;
} {
  const failures = findRepeatFailures(complaints);
  const inWarranty = failures.filter((f) => f.withinWarranty);

  return {
    failures,
    inWarranty,
    recoverableTotal: inWarranty.reduce((sum, f) => sum + (f.recoverableEstimate ?? 0), 0),
    unpricedCount: inWarranty.filter((f) => f.recoverableEstimate === null).length,
  };
}

// ------------------------------------------------------------
// Asset history — what the ledger screen renders
// ------------------------------------------------------------

export function getAssetHistory(assetId: string, complaints: Complaint[]): AssetHistory | null {
  const asset = getAssetById(assetId);
  if (!asset) return null;

  const onAsset = complaints
    .filter((c) => assetForComplaint(c)?.id === assetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const repairs = getRepairsForAsset(assetId);
  const repeatFailures = findRepeatFailures(onAsset);
  const now = Date.now();

  // Gap between consecutive repairs, in days. A short median on an asset
  // with several repairs is the strongest recurring-failure signal the
  // ledger produces.
  const gaps: number[] = [];
  for (let i = 0; i < repairs.length - 1; i += 1) {
    const newer = new Date(repairs[i].completedAt).getTime();
    const older = new Date(repairs[i + 1].completedAt).getTime();
    gaps.push(Math.round((newer - older) / DAY_MS));
  }
  gaps.sort((a, b) => a - b);
  const medianDaysBetweenRepairs =
    gaps.length === 0
      ? null
      : gaps.length % 2 === 1
      ? gaps[(gaps.length - 1) / 2]
      : Math.round((gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2);

  const stamps = [
    ...onAsset.map((c) => c.createdAt),
    ...repairs.map((r) => r.completedAt),
  ].sort();

  return {
    asset,
    complaintIds: onAsset.map((c) => c.id),
    repairs,
    repeatFailures,
    totalComplaints: onAsset.length,
    totalRepairs: repairs.length,
    underWarrantyCount: repairs.filter((r) => isUnderWarranty(r, now)).length,
    medianDaysBetweenRepairs,
    recoverableTotal: repeatFailures
      .filter((f) => f.withinWarranty)
      .reduce((sum, f) => sum + (f.recoverableEstimate ?? 0), 0),
    firstRecordedAt: stamps[0] ?? null,
    lastRecordedAt: stamps[stamps.length - 1] ?? null,
  };
}

/** Assets with the most recorded activity, for the ledger index screen. */
export function getAssetsByActivity(
  complaints: Complaint[],
  limit = 12
): Array<{ asset: CivicAsset; complaints: number; repairs: number; repeatFailures: number }> {
  const counts = new Map<string, { complaints: number; repairs: number; repeatFailures: number }>();

  const bump = (id: string, key: 'complaints' | 'repairs' | 'repeatFailures') => {
    const row = counts.get(id) ?? { complaints: 0, repairs: 0, repeatFailures: 0 };
    row[key] += 1;
    counts.set(id, row);
  };

  for (const c of complaints) {
    const asset = assetForComplaint(c);
    if (asset) bump(asset.id, 'complaints');
  }
  for (const r of readRepairs()) bump(r.assetId, 'repairs');
  for (const f of findRepeatFailures(complaints)) bump(f.assetId, 'repeatFailures');

  return [...counts.entries()]
    .map(([id, row]) => ({ asset: getAssetById(id)!, ...row }))
    .filter((row) => Boolean(row.asset))
    .sort(
      (a, b) =>
        b.repeatFailures - a.repeatFailures ||
        b.repairs + b.complaints - (a.repairs + a.complaints)
    )
    .slice(0, limit);
}
