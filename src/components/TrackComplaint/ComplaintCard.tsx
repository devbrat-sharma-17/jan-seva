import type { Complaint } from '../../types';
import { StatusPill } from './StatusPill';
import { displayRelative } from '../../services/timeService';
import { getCityById } from '../../data/cities';
import { timeUntilExpiry } from '../../services/privacyService';
import { formatDuration } from '../../services/timeService';

interface ComplaintCardProps {
  complaint: Complaint;
  onSelect: (complaintId: string) => void;
}

/**
 * One complaint in the verified citizen's list.
 *
 * A real `<button>`, not a `div` with `role="button"` — the latter is
 * focusable but silently unactivatable from the keyboard.
 */
export function ComplaintCard({ complaint, onSelect }: ComplaintCardProps) {
  const city = getCityById(complaint.cityId);
  const isResolved = complaint.status === 'resolved';

  const updated = displayRelative(complaint.latestUpdate?.timestamp || complaint.updatedAt);
  const expiresIn = timeUntilExpiry(complaint);

  return (
    <button
      type="button"
      className="complaint-card"
      onClick={() => onSelect(complaint.id)}
      aria-label={`Open complaint ${complaint.id}: ${complaint.issue.title}`}
    >
      <span className="complaint-card__top">
        <span className="complaint-card__id">{complaint.id}</span>
        <StatusPill status={complaint.status} />
      </span>

      <span className="complaint-card__title">{complaint.issue.title}</span>

      <span className="complaint-card__place">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span>
          {complaint.location.locality}
          {/* City is always shown: one citizen may hold complaints across
              several cities, and hiding that makes the list confusing. */}
          {city ? `, ${city.name}` : ''}
        </span>
      </span>

      <span className="complaint-card__foot">
        <span className="complaint-card__updated">
          {isResolved ? 'Resolved' : 'Updated'} {updated}
        </span>
        <span className="complaint-card__cta">
          View complaint
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </span>

      {/* Resolved complaints leave the list at 48 hours. Warning while it
          is still visible beats it vanishing without explanation. */}
      {isResolved && expiresIn !== null && expiresIn < 12 * 60 * 60 * 1000 && (
        <span className="complaint-card__expiry">
          Tracking ends in {formatDuration(expiresIn)}
        </span>
      )}
    </button>
  );
}
