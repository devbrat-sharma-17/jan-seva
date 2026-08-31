import { displayRelative, displayStamp } from '../../services/timeService';

interface LatestUpdateProps {
  title: string;
  description: string;
  timestamp: string;
}

export function LatestUpdateCard({ title, description, timestamp }: LatestUpdateProps) {
  return (
    <div className="latest-update-card">
      <div className="latest-update-header">
        <span className="latest-update-tag">
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Latest update
        </span>
        {/* Relative reads faster on a status page; the absolute stamp stays
            available on hover and to assistive tech. */}
        <time className="latest-update-time" dateTime={timestamp} title={displayStamp(timestamp)}>
          {displayRelative(timestamp)}
        </time>
      </div>

      <h4 className="latest-update-title">{title}</h4>
      <p className="latest-update-desc">{description}</p>
    </div>
  );
}
