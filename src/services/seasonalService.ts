// ============================================================
// Seasonal Service — Pre-Monsoon Positioning
// ============================================================
//
// Indian civic failure is overwhelmingly seasonal. The drains that
// overflowed in July will overflow again in July, and everybody in the
// department already knows which ones — the knowledge just lives in one
// person's head and leaves when they transfer.
//
//   THIS IS A QUERY, NOT A FORECAST, AND THAT IS THE POINT.
//
// It says: "these drain nodes flooded last monsoon and have not been
// touched since." It makes no claim about the future, so it cannot be
// wrong in the way a forecast can be wrong.
//
// The alternative was tempting and was rejected on evidence. A
// Washington DC rat-infestation model performed well on held-out 311
// data and then failed against actual field inspections; the authors'
// conclusion was that the administrative data-generating process biases
// the model and that field validation, not a holdout set, is the only
// real test. Building a confident prediction on a prototype with fifteen
// seeded complaints and no field-validation capability would be the
// worst possible outcome for a product whose thesis is proof.
//
// So: a statement about last year's recorded events, and nothing more.

import type { Complaint } from '../types';
import type { CivicAsset } from '../types/asset';
import { assetForComplaint, getRepairsForAsset } from './assetService';

/** Monsoon months in Madhya Pradesh, 0-indexed. June to September. */
const MONSOON_MONTHS = [5, 6, 7, 8];

/** Categories whose failures are monsoon-driven. */
const SEASONAL_CATEGORIES = ['water', 'roads', 'garbage'];

export interface SeasonalCandidate {
  asset: CivicAsset;
  category: string;
  /** Complaints recorded against this asset during past monsoon months. */
  monsoonComplaints: number;
  /** The most recent monsoon complaint. */
  lastMonsoonReport: string;
  /** Days since the last recorded repair, or null if never repaired. */
  daysSinceRepair: number | null;
  /** True when nothing has been done since the last monsoon failure. */
  untouchedSinceFailure: boolean;
  /** The plain sentence this row exists to say. */
  statement: string;
}

/**
 * The pre-monsoon work list, derived entirely from what was recorded.
 *
 * Ordered by monsoon failure count, then by how long the asset has gone
 * untouched. Assets repaired since their last monsoon failure fall down
 * the list rather than off it — the repair may not have held, and the
 * ledger will say so next season.
 */
export function getPreMonsoonWorklist(
  complaints: Complaint[],
  now: number = Date.now()
): SeasonalCandidate[] {
  const byAsset = new Map<string, { asset: CivicAsset; category: string; reports: Complaint[] }>();

  for (const complaint of complaints) {
    if (!SEASONAL_CATEGORIES.includes(complaint.issue.category)) continue;

    const month = new Date(complaint.createdAt).getMonth();
    if (!MONSOON_MONTHS.includes(month)) continue;

    const asset = assetForComplaint(complaint);
    if (!asset) continue;

    const key = `${asset.id}:${complaint.issue.category}`;
    const row = byAsset.get(key) ?? { asset, category: complaint.issue.category, reports: [] };
    row.reports.push(complaint);
    byAsset.set(key, row);
  }

  const candidates: SeasonalCandidate[] = [];

  for (const { asset, category, reports } of byAsset.values()) {
    reports.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastReport = reports[0];
    const lastReportMs = new Date(lastReport.createdAt).getTime();

    const lastRepair = getRepairsForAsset(asset.id).find((r) => r.category === category);
    const lastRepairMs = lastRepair ? new Date(lastRepair.completedAt).getTime() : null;

    const untouched = lastRepairMs === null || lastRepairMs < lastReportMs;

    candidates.push({
      asset,
      category,
      monsoonComplaints: reports.length,
      lastMonsoonReport: lastReport.createdAt,
      daysSinceRepair:
        lastRepairMs === null ? null : Math.floor((now - lastRepairMs) / 86_400_000),
      untouchedSinceFailure: untouched,
      statement: buildStatement(asset, reports.length, untouched, lastRepairMs, now),
    });
  }

  return candidates.sort(
    (a, b) =>
      Number(b.untouchedSinceFailure) - Number(a.untouchedSinceFailure) ||
      b.monsoonComplaints - a.monsoonComplaints
  );
}

/**
 * The sentence is the feature.
 *
 * No model output, no confidence score, no "predicted risk". A record of
 * what happened and what was done about it, phrased so a works engineer
 * can act on it without translating anything.
 */
function buildStatement(
  asset: CivicAsset,
  count: number,
  untouched: boolean,
  lastRepairMs: number | null,
  now: number
): string {
  const failures = `${count} monsoon complaint${count === 1 ? '' : 's'}`;

  if (untouched && lastRepairMs === null) {
    return `${asset.name}: ${failures} on record, and no repair has ever been logged against it.`;
  }
  if (untouched) {
    return `${asset.name}: ${failures} on record, and nothing has been done since the most recent one.`;
  }

  const days = Math.floor((now - (lastRepairMs ?? now)) / 86_400_000);
  return `${asset.name}: ${failures} on record. Last repaired ${days} days ago — worth re-checking before the season.`;
}

/** Weeks until the monsoon window opens, for the banner's framing. */
export function weeksToMonsoon(now: number = Date.now()): number {
  const today = new Date(now);
  const year = today.getFullYear();
  let onset = new Date(year, MONSOON_MONTHS[0], 15);
  if (onset.getTime() < now) onset = new Date(year + 1, MONSOON_MONTHS[0], 15);
  return Math.max(0, Math.round((onset.getTime() - now) / (7 * 86_400_000)));
}

/** Honest framing, rendered above the list. */
export const SEASONAL_CAVEAT =
  'This is a query over the recorded complaint history, not a prediction. It reports what failed in past monsoon months and what has been done since — nothing about what will happen.';
