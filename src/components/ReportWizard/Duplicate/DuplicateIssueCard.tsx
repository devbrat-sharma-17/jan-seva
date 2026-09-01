import type { DuplicateMatch } from '../../../types/report';
import './DuplicateIssueCard.css';

interface DuplicateIssueCardProps {
  match: DuplicateMatch;
  onJoin: () => void;
  onReportNew: () => void;
}

export function DuplicateIssueCard({ match, onJoin, onReportNew }: DuplicateIssueCardProps) {
  return (
    <div className="dup-container">
      <div className="dup-banner-alert">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <h3 className="dup-banner-title">We found a similar report nearby.</h3>
          <p className="dup-banner-desc">
            An issue at this location is already being handled by municipal authorities.
          </p>
        </div>
      </div>

      <div className="dup-card">
        <div className="dup-card-top">
          <span className="dup-ticket-id">Ticket #{match.id}</span>
          <span className="dup-status-badge">Status: {match.status.replace('-', ' ')}</span>
        </div>

        <h4 className="dup-card-title">{match.title}</h4>

        <div className="dup-card-meta">
          <div className="dup-meta-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{match.location} ({match.distanceMeters}m away)</span>
          </div>

          <div className="dup-meta-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Reported {match.reportedAt}</span>
          </div>
        </div>

        <div className="dup-supporting-count">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{match.supportingCount} citizens confirmed this problem</span>
        </div>
      </div>

      <div className="dup-actions">
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={onJoin}
          id="btn-join-duplicate"
        >
          JOIN EXISTING REPORT
        </button>

        <p className="dup-join-explainer">
          {/* The old copy promised a priority boost that never happened —
              `priorityScore` was written once and never recomputed. It is
              recomputed now, from independence-weighted spread, so this
              says what the citizen actually gets: their own ticket and
              their own vote on the outcome. */}
          You get your own ticket and your own say. The work is done once, but it cannot be
          closed until you agree it is fixed — you are not represented by anyone else&rsquo;s
          complaint.
        </p>

        <button
          type="button"
          className="report-btn report-btn--secondary"
          onClick={onReportNew}
          id="btn-report-as-new"
          style={{ marginTop: '8px' }}
        >
          REPORT AS NEW ISSUE
        </button>
      </div>
    </div>
  );
}
