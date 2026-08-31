// ============================================================
// Network status — banner and inline indicator
// ============================================================
// Shared by both portals so "offline" looks and reads the same whether
// you are a field officer on mobile data or an administrator on a desk.

import { useState } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncPendingOperations } from '../../services/syncService';
import './portal.css';

/**
 * Top-of-shell banner. Renders only when there is something to say:
 * a connected portal with an empty queue shows nothing at all.
 */
export function NetworkBanner() {
  const status = useNetworkStatus();
  const [expanded, setExpanded] = useState(false);

  const quiet = status.state === 'online' && status.pendingCount === 0;
  if (quiet) return null;

  const canRetry = status.state === 'error' && status.isOnline;

  return (
    <div className={`net-banner net-banner--${status.tone}`} role="status" aria-live="polite">
      <span className={`net-banner__dot net-banner__dot--${status.state}`} aria-hidden="true" />

      <span className="net-banner__text">
        <strong className="net-banner__label">{status.label}</strong>
        <span className="net-banner__detail">{status.detail}</span>
      </span>

      {status.pendingCount > 0 && (
        <button
          type="button"
          className="net-banner__action"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide' : `${status.pendingCount} pending`}
        </button>
      )}

      {canRetry && (
        <button
          type="button"
          className="net-banner__action net-banner__action--primary"
          onClick={() => void syncPendingOperations()}
        >
          Retry
        </button>
      )}

      {expanded && status.pending.length > 0 && (
        <ul className="net-banner__list">
          {status.pending.map((op) => (
            <li key={op.id}>
              <span className="net-banner__op">{op.summary}</span>
              <span className="net-banner__op-id">{op.entityId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compact dot + word, for a header bar. */
export function NetworkStatusIndicator() {
  const status = useNetworkStatus();

  return (
    <span
      className={`net-chip net-chip--${status.tone}`}
      title={status.detail}
      aria-label={`Connection: ${status.label}. ${status.detail}`}
    >
      <span className={`net-chip__dot net-chip__dot--${status.state}`} aria-hidden="true" />
      <span className="net-chip__label">{status.label}</span>
    </span>
  );
}
