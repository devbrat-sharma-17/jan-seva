// ============================================================
// Ward Service — the Ward Reality Index and Silent Wards
// ============================================================
//
// `getCivicHotspots` sorted localities by raw complaint count and
// presented that as intelligence. It is the biased metric.
//
// There is a substantial literature showing the propensity to complain
// varies systematically with income, education, language and civic
// engagement, so complaint-derived hotspots systematically over-serve
// the already-served. A "most complained-about area" ranking does not
// show where problems are. It shows where complainers are.
//
// This module reports TWO numbers instead of one: what was observed, and
// what would be expected at the city's average propensity given the
// ward's population and access. The interesting output is not the loud
// ward. It is the SILENT one — an area reporting far below expectation,
// flagged as an attention item rather than as good performance.
//
//   THIS INDEX IS ILLUSTRATIVE AND EVERY SURFACE THAT RENDERS IT SAYS SO.
//   Real ward covariates (census tables, device penetration, prior
//   reporting rates) and a proper reporting-bias estimator are what turn
//   this from a demonstration of the correction into a measurement. A
//   confident, wrong equity claim is worse than no equity claim, which
//   is why the uncertainty is displayed rather than buried.

import type { WardProfile, WardReality } from '../types/field';
import type { Complaint } from '../types';
import { GWALIOR_WARDS, wardForLocality } from '../data/wards';
import { computeSlaHealth } from './slaService';

/**
 * Estimated propensity to report a given problem, 0-1.
 *
 * Connectivity dominates because filing on JAN-SEVA requires a data
 * connection and a camera at all; literacy weights the rest. This is a
 * stand-in for a fitted model, and is deliberately simple enough that
 * anyone reading the code can see exactly what it does and does not
 * claim.
 */
export function propensityOf(ward: WardProfile): number {
  return Number((0.65 * ward.connectivityIndex + 0.35 * ward.literacyIndex).toFixed(3));
}

/** Wards ranked by how far reporting departs from expectation. */
export function getWardReality(complaints: Complaint[]): WardReality[] {
  const now = Date.now();

  // Observed volume per ward.
  const observed = new Map<string, Complaint[]>();
  for (const c of complaints) {
    const ward = wardForLocality(c.location.locality);
    if (!ward) continue;
    const list = observed.get(ward.id) ?? [];
    list.push(c);
    observed.set(ward.id, list);
  }

  // Expected volume: distribute the city's total across wards in
  // proportion to population x propensity. A ward with half the city's
  // propensity is expected to report half as much for the same problem
  // load — which is the whole correction.
  const exposure = GWALIOR_WARDS.map((w) => ({
    ward: w,
    weight: w.population * propensityOf(w),
  }));
  const totalWeight = exposure.reduce((sum, e) => sum + e.weight, 0);
  const totalObserved = [...observed.values()].reduce((sum, list) => sum + list.length, 0);

  return exposure
    .map(({ ward, weight }) => {
      const list = observed.get(ward.id) ?? [];
      const expected =
        totalWeight > 0 ? Number(((weight / totalWeight) * totalObserved).toFixed(2)) : 0;

      // Guard the divide: a ward expected to produce nothing cannot be
      // said to be under-reporting, and must not become Infinity.
      const ratio = expected > 0 ? Number((list.length / expected).toFixed(2)) : 1;

      return {
        ward,
        observedComplaints: list.length,
        expectedComplaints: expected,
        reportingRatio: ratio,
        propensity: propensityOf(ward),
        signal: classify(ratio, expected),
        interpretation: interpret(ward, list.length, expected, ratio),
        resolvedCount: list.filter((c) => c.status === 'resolved').length,
        slaBreachedCount: list.filter(
          (c) => c.status !== 'resolved' && computeSlaHealth(c, now)?.status === 'exceeded'
        ).length,
      };
    })
    .sort((a, b) => a.reportingRatio - b.reportingRatio);
}

function classify(ratio: number, expected: number): WardReality['signal'] {
  // Too little expected volume to say anything. Reported as "expected"
  // rather than as a finding, because one complaint against an expected
  // 0.4 is noise, not a signal.
  if (expected < 1) return 'expected';
  if (ratio < 0.35) return 'silent';
  if (ratio < 0.7) return 'under-reported';
  if (ratio > 1.4) return 'over-reported';
  return 'expected';
}

function interpret(
  ward: WardProfile,
  observed: number,
  expected: number,
  ratio: number
): string {
  if (expected < 1) {
    return 'Too few reports city-wide to say anything about this ward yet.';
  }
  if (ratio < 0.35) {
    return `Reporting at ${Math.round(ratio * 100)}% of expectation. Low reporting in a ward of ${ward.population.toLocaleString('en-IN')} is a reason to send an inspection, not evidence that conditions are good.`;
  }
  if (ratio < 0.7) {
    return `Below expectation — ${observed} reports against roughly ${Math.round(expected)}. Worth checking whether the channel is reaching this ward.`;
  }
  if (ratio > 1.4) {
    return `Above expectation — ${observed} reports against roughly ${Math.round(expected)}. High engagement, not necessarily worse conditions.`;
  }
  return `Reporting close to expectation for this ward's population and access.`;
}

/** The screen nobody builds: wards that are too quiet. */
export function getSilentWards(complaints: Complaint[]): WardReality[] {
  return getWardReality(complaints).filter(
    (w) => w.signal === 'silent' || w.signal === 'under-reported'
  );
}

/** Honest caveat text, rendered wherever this index appears. */
export const WARD_INDEX_CAVEAT =
  'Illustrative. Ward population and access indices are seeded estimates, not census data. This demonstrates the correction for reporting bias — it does not measure Gwalior.';
