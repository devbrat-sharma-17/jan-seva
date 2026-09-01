// ============================================================
// Programme Stats — the municipality's own totals
// ============================================================
//
// Deliberately kept in its own module, with NO import of the complaint
// store.
//
// These figures come from city configuration, so they can render in the
// first paint. The live figures cannot: deriving them means reading the
// complaint store, which pulls in the seeded asset registry, the repair
// ledger and eighteen months of history — roughly 68 kB that has no
// business blocking a landing page. Splitting the two here is what lets
// the Hero load one immediately and defer the other.
//
// See `cityStatsService` for the live half, and `useDeferredCityStats`
// for how it is loaded.

import type { CityConfig } from '../types';

export interface ProgrammeStats {
  reported: number;
  resolved: number;
  /** Computed from the two figures above. Never asserted separately. */
  resolutionRatePercent: number;
  activeInitiatives: number;
  /** Rendered next to the figures, not hidden in a tooltip. */
  disclaimer: string;
}

/**
 * The municipality's own programme totals.
 *
 * The resolution rate is DIVIDED, not declared. The landing page used to
 * print 94% next to a stored 9,830 of 12,480 — which is 79% — because
 * the rate was a third constant that could drift away from the two it
 * described. Deriving it makes that contradiction impossible rather than
 * merely fixed once.
 */
export function getProgrammeStats(city: CityConfig): ProgrammeStats {
  const { issuesReported, issuesResolved, activeInitiatives } = city.statistics;

  return {
    reported: issuesReported,
    resolved: issuesResolved,
    resolutionRatePercent:
      issuesReported > 0 ? Math.round((issuesResolved / issuesReported) * 100) : 0,
    activeInitiatives,
    disclaimer:
      'Municipal programme totals, illustrative. Figures below the fold are live and derived from this system.',
  };
}
