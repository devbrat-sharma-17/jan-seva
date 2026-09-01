import { useMemo } from 'react';
import type { Complaint } from '../../../types';
import {
  getPreMonsoonWorklist,
  weeksToMonsoon,
  SEASONAL_CAVEAT,
} from '../../../services/seasonalService';
import './pre-monsoon.css';

interface PreMonsoonPanelProps {
  complaints: Complaint[];
}

/**
 * The pre-monsoon work list.
 *
 * Indian civic failure is overwhelmingly seasonal. The drains that
 * overflowed in July will overflow again in July, and the department
 * already knows which ones — the knowledge just lives in one person's
 * head and leaves when they transfer.
 *
 *   THIS IS A QUERY, NOT A FORECAST, AND THE UI SAYS SO.
 *   It reports what failed in past monsoon months and what has been
 *   done since. It makes no claim about the future, so it cannot be
 *   wrong the way a forecast can. A Washington DC rat-infestation model
 *   validated well on held-out 311 data and then failed against actual
 *   field inspections — building a confident prediction on a prototype
 *   would be the worst possible outcome for a product whose thesis is
 *   proof.
 */
export function PreMonsoonPanel({ complaints }: PreMonsoonPanelProps) {
  const candidates = useMemo(() => getPreMonsoonWorklist(complaints), [complaints]);
  const weeks = useMemo(() => weeksToMonsoon(), []);

  const untouched = candidates.filter((c) => c.untouchedSinceFailure);

  if (candidates.length === 0) return null;

  return (
    <section className="pm-panel">
      <header className="pm-panel__head">
        <div>
          <h2 className="pm-panel__title">Pre-monsoon positioning</h2>
          <p className="pm-panel__lead">
            {untouched.length} asset{untouched.length === 1 ? '' : 's'} flooded or failed in past
            monsoon months and have not been touched since. Monsoon onset is roughly {weeks}{' '}
            week{weeks === 1 ? '' : 's'} away.
          </p>
        </div>
        <span className="pm-panel__badge">Retrospective</span>
      </header>

      <ul className="pm-list">
        {candidates.slice(0, 8).map((candidate) => (
          <li
            key={`${candidate.asset.id}-${candidate.category}`}
            className={`pm-item${candidate.untouchedSinceFailure ? ' pm-item--untouched' : ''}`}
          >
            <span className="pm-item__count" aria-hidden="true">
              {candidate.monsoonComplaints}
            </span>
            <div className="pm-item__body">
              <p className="pm-item__statement">{candidate.statement}</p>
              <p className="pm-item__meta">
                <code>{candidate.asset.id}</code> · {candidate.asset.locality} ·{' '}
                {candidate.category}
                {candidate.daysSinceRepair !== null &&
                  ` · last repaired ${candidate.daysSinceRepair} days ago`}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="pm-panel__caveat">{SEASONAL_CAVEAT}</p>
    </section>
  );
}
