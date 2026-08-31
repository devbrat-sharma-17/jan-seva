// ============================================================
// Loading skeletons
// ============================================================
// A centred spinner tells the citizen only that something is happening.
// These hold the real layout, so the shape of what is coming is legible
// and nothing shifts under a thumb when the data lands.

export function ComplaintRowSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-line skeleton-line--short" />
      <div className="skeleton skeleton-line skeleton-line--title" />
      <div className="skeleton skeleton-line skeleton-line--mid" />
    </div>
  );
}

export function ComplaintListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="track-stack" role="status" aria-label="Loading your complaints">
      {Array.from({ length: rows }, (_, i) => (
        <ComplaintRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function ComplaintDetailSkeleton() {
  return (
    <div className="track-stack" role="status" aria-label="Searching for complaint">
      <div className="skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton-line skeleton-line--short" />
        <div className="skeleton skeleton-line skeleton-line--title" />
        <div className="skeleton skeleton-line skeleton-line--mid" />
        <div className="skeleton skeleton-line" />
      </div>

      <div className="skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton-line skeleton-line--short" />
        <div className="skeleton skeleton-line skeleton-line--mid" />
      </div>

      <div className="skeleton-card" aria-hidden="true">
        <div className="skeleton skeleton-line skeleton-line--title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-line--mid" />
        <div className="skeleton skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}
