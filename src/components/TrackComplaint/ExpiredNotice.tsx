import type { PublicComplaint } from '../../types';
import { formatDate } from '../../services/timeService';
import { IntegrityBadge } from '../proof/IntegrityBadge';

interface ExpiredNoticeProps {
  resolvedAt: string;
  /** The permanent civic record, which does NOT expire. */
  archived: PublicComplaint;
  onBack: () => void;
  onFindMine: () => void;
}

/**
 * Identity retention has lapsed. The record of the repair has not.
 *
 * Retention is split. The link between a complaint and the citizen who
 * reported it expires after 48 hours — that link is personal data and
 * there is no reason to keep it. What was broken, where, which
 * department answered for it and whether the evidence was verified is a
 * record about public infrastructure and public money, and it is
 * permanent.
 *
 * The previous version of this screen was a dead end: it told the
 * citizen tracking had ended and showed them nothing. That was also
 * what made the product unable to answer "has this been fixed before?"
 * — the single most important question in municipal maintenance.
 */
export function ExpiredNotice({ resolvedAt, archived, onBack, onFindMine }: ExpiredNoticeProps) {
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
        <path d="M21 8v13H3V8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>

      <h3 className="track-empty__title">Archived civic record</h3>

      <p className="track-empty__text">
        This complaint was resolved on {formatDate(resolvedAt)}. Your personal link to it expired
        48 hours later and has been removed — but the repair itself stays on the city&rsquo;s
        permanent record, which is what makes recurring failures detectable at all.
      </p>

      <dl className="track-archive">
        <div>
          <dt>Issue</dt>
          <dd>{archived.issue.title}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>
            {archived.area.locality}, {archived.area.city}
          </dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{archived.department.name}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>
            {archived.resolution?.citizenVerifiedResolved
              ? 'Confirmed fixed by the citizen who reported it'
              : 'Closed by the department without citizen confirmation'}
          </dd>
        </div>
        {archived.assetId && (
          <div>
            <dt>Asset</dt>
            <dd>
              <code>{archived.assetId}</code>
              {archived.isRepeatFailure && ' — this asset has failed again since'}
            </dd>
          </div>
        )}
        {archived.evidenceGrade && (
          <div>
            <dt>Evidence</dt>
            <dd>
              <IntegrityBadge grade={archived.evidenceGrade} size="sm" />
            </dd>
          </div>
        )}
      </dl>

      <div className="track-empty__actions">
        <button type="button" className="report-btn report-btn--secondary" onClick={onBack}>
          Track another
        </button>
        <button type="button" className="report-btn report-btn--primary" onClick={onFindMine}>
          Find my complaints
        </button>
      </div>

      <p className="track-empty__footnote">
        No name, number, photograph or exact location is held in this archived record.
      </p>
    </div>
  );
}
