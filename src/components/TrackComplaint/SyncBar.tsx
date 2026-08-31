import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { formatRelative } from '../../services/timeService';

interface SyncBarProps {
  refreshing: boolean;
  lastSyncedAt: number | null;
  onRefresh: () => void;
}

/**
 * Says when the data on screen was last read, and lets the citizen force a
 * re-read. Without this the page looks identical whether it is live or
 * twenty minutes stale — and on a complaint that may have just been
 * escalated, that difference matters.
 */
export function SyncBar({ refreshing, lastSyncedAt, onRefresh }: SyncBarProps) {
  const isOnline = useOnlineStatus();
  const [, setTick] = useState(0);

  // Re-render each half minute so "just now" ages into "2 min ago".
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const syncedLabel = lastSyncedAt
    ? `Updated ${formatRelative(new Date(lastSyncedAt).toISOString())}`
    : 'Not yet updated';

  return (
    <div className={`sync-bar ${isOnline ? '' : 'sync-bar--offline'}`.trim()}>
      <span className="sync-bar__status">
        <span className="sync-bar__dot" aria-hidden="true" />
        <span>{isOnline ? syncedLabel : 'Offline — showing saved data'}</span>
      </span>

      <button
        type="button"
        className={`sync-bar__refresh ${refreshing ? 'sync-bar__refresh--spinning' : ''}`.trim()}
        onClick={onRefresh}
        disabled={refreshing}
      >
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
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
      </button>
    </div>
  );
}
