import type { Complaint, PublicComplaint } from '../../types';

interface LocationCardProps {
  area: PublicComplaint['area'];
  /** Non-null only for the verified reporter. */
  exactLocation: Complaint['location'] | null;
  onVerify: () => void;
}

/**
 * Publicly this shows locality and city only.
 *
 * The exact coordinates the citizen confirmed at report time are stored and
 * used for routing and duplicate matching, but publishing them against a
 * Complaint ID would let anyone holding that ID place the reporter at a
 * precise spot — often their own street. Precision is a verified-only field.
 */
export function LocationCard({ area, exactLocation, onVerify }: LocationCardProps) {
  return (
    <div className="meta-card">
      <span className="review-card-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Location
      </span>

      {/* A schematic area plate, not a live map: an accurate pin would
          re-expose the precision the redaction just removed. */}
      <div className="area-plate" aria-hidden="true">
        <div className="area-plate__grid" />
        <div className="area-plate__pin">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <span className="area-plate__halo" />
      </div>

      {exactLocation ? (
        <>
          <p className="meta-card__value">{exactLocation.address}</p>
          <span className="meta-card__sub">
            {exactLocation.locality}, {exactLocation.city}, {exactLocation.state}
          </span>
          <span className="meta-card__badge">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Exact location you submitted
          </span>
        </>
      ) : (
        <>
          <p className="meta-card__value">
            {area.locality}, {area.city}
          </p>
          <span className="meta-card__sub">{area.state}</span>

          <button type="button" className="meta-card__unlock" onClick={onVerify}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Verify to see the exact location
          </button>
        </>
      )}
    </div>
  );
}
