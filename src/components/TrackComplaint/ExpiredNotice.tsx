import { formatDate } from '../../services/timeService';

interface ExpiredNoticeProps {
  resolvedAt: string;
  onBack: () => void;
  onFindMine: () => void;
}

/**
 * A resolved complaint stays publicly trackable for 48 hours. Past that the
 * record is retained but no longer retrievable by ID.
 *
 * This deliberately does not reuse the "not found" state: telling a citizen
 * their complaint never existed, when it was in fact resolved, is both
 * wrong and alarming. Saying it was resolved and closed discloses nothing
 * further about them.
 */
export function ExpiredNotice({ resolvedAt, onBack, onFindMine }: ExpiredNoticeProps) {
  return (
    <div className="track-empty track-empty--muted" role="status">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="track-empty__icon track-empty__icon--muted"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
        <circle cx="12" cy="12" r="10" opacity="0.28" />
      </svg>

      <h3 className="track-empty__title">Complaint tracking ended</h3>

      <p className="track-empty__text">
        This complaint was resolved on {formatDate(resolvedAt)} and is no longer available for
        public tracking.
      </p>

      <div className="track-empty__actions">
        <button type="button" className="report-btn report-btn--secondary" onClick={onBack}>
          Track another
        </button>
        <button type="button" className="report-btn report-btn--primary" onClick={onFindMine}>
          Find my complaints
        </button>
      </div>

      <p className="track-empty__footnote">
        For assistance with a closed complaint, contact JAN-SEVA support.
      </p>
    </div>
  );
}
