// ============================================================
// Loading skeletons — shaped like the content they stand in for
// ============================================================
// A skeleton that matches the final layout keeps the page from jumping
// when data lands. A centred spinner does the opposite, and tells the
// reader nothing about what is coming.

import './portal.css';

export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return <span className="pskel pskel--line" style={{ width }} aria-hidden="true" />;
}

/** Stands in for the KPI tile row. */
export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="pskel-kpis" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pskel-kpi">
          <SkeletonLine width="45%" />
          <span className="pskel pskel--figure" />
          <SkeletonLine width="65%" />
        </div>
      ))}
    </div>
  );
}

/** Stands in for a complaint queue. */
export function SkeletonQueue({ rows = 4 }: { rows?: number }) {
  return (
    <div className="pskel-queue" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="pskel-row">
          <span className="pskel pskel--thumb" />
          <span className="pskel-row__body">
            <SkeletonLine width="35%" />
            <SkeletonLine width="80%" />
            <SkeletonLine width="55%" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="pskel-card" aria-hidden="true">
      <SkeletonLine width="40%" />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/**
 * The live region that goes with any of the above. Screen readers get a
 * spoken "Loading" while sighted users get the shapes.
 */
export function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      Loading {label}
    </span>
  );
}
