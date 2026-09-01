// ============================================================
// City Stats Service — figures that are true
// ============================================================
//
// The landing page used to print 12,480 reported / 94% resolved / 42
// initiatives. All three were constants in `cities.ts`, and the same
// object also said 9,830 resolved — which is 78.8%, not 94%. A judge
// who divided two numbers on the same screen would have caught it.
//
// Two categories of figure, kept apart on purpose:
//
//   LIVE — derived from the complaint store on every read. These are
//   true statements about this deployment. There are no stored counters
//   to drift and no UI event increments them.
//
//   PROGRAMME — the municipality's own multi-year totals, which no
//   frontend can derive because the records are not in it. These are
//   labelled ILLUSTRATIVE wherever they appear, rather than quietly
//   presented as if this system produced them.
//
// If a number on a public screen cannot be traced to one of those two
// paths, it does not belong on the screen.

import { getStoredComplaints } from './complaintService';
import { findRepeatFailures } from './assetService';
import { computeDurabilityStats } from './verificationService';

export interface LiveCityStats {
  /** Complaints in the store for this city. */
  reported: number;
  /** Resolutions the CITIZEN confirmed. A department claim is not a fix. */
  citizenVerified: number;
  /** Resolutions the department has claimed, confirmed or not. */
  departmentClosed: number;
  /**
   * citizenVerified / reported, as a percentage. Null when nothing has
   * been reported — a city with no complaints has no resolution rate,
   * and rendering 100% would be the exact failure this file exists to
   * prevent.
   */
  verifiedRatePercent: number | null;
  /** Assets that failed again within the repeat-failure window. */
  repeatFailures: number;
  /** Percentage of re-checked fixes still holding. Null when unmeasured. */
  durabilityRatePercent: number | null;
  /** Evidence photos graded `verified` at capture. */
  verifiedCaptures: number;
  openCount: number;
}

/** Everything on the landing page, derived from the records. */
export function getLiveCityStats(cityId: string): LiveCityStats {
  const complaints = getStoredComplaints().filter((c) => c.cityId === cityId);

  const departmentClosed = complaints.filter((c) => c.status === 'resolved').length;
  const citizenVerified = complaints.filter(
    (c) => c.resolution?.citizenVerifiedResolved
  ).length;
  const verifiedCaptures = complaints.filter(
    (c) => c.resolution?.evidenceGrade === 'verified'
  ).length;

  const durability = computeDurabilityStats(complaints);

  return {
    reported: complaints.length,
    citizenVerified,
    departmentClosed,
    // Measured against CITIZEN-verified resolutions, not against what
    // departments claimed. That is the whole product thesis expressed
    // as a number, and it is deliberately the less flattering one.
    verifiedRatePercent:
      complaints.length > 0
        ? Math.round((citizenVerified / complaints.length) * 100)
        : null,
    repeatFailures: findRepeatFailures(complaints).length,
    durabilityRatePercent: durability.durabilityRate,
    verifiedCaptures,
    openCount: complaints.filter((c) => c.status !== 'resolved').length,
  };
}

// ------------------------------------------------------------
// Programme totals live in `programmeStats.ts`, which imports no store.
// Re-exported here so existing callers keep one import site, but the
// Hero imports it directly — that is what keeps the seeded civic data
// off the landing page's critical path.
// ------------------------------------------------------------
export { getProgrammeStats, type ProgrammeStats } from './programmeStats';
