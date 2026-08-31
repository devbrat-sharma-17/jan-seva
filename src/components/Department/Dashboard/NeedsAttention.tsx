import { Link } from 'react-router-dom';
import type { Complaint } from '../../../types';

interface NeedsAttentionProps {
  attentionData: {
    breached: Complaint[];
    atRisk: Complaint[];
    unassigned: Complaint[];
    reinspection: Complaint[];
  };
}

type Tone = 'critical' | 'warning' | 'info';

/**
 * The "what do I do next" panel.
 *
 * Four conditions, ordered by how much trouble they represent, each a
 * link into the queue filtered to exactly what the number counts. Rows
 * with a count of zero are dropped rather than shown as a reassuring
 * zero — a list of four zeroes is scanned past, and the one row that
 * matters loses its place in the eye.
 */
export function NeedsAttention({ attentionData }: NeedsAttentionProps) {
  const { breached, atRisk, unassigned, reinspection } = attentionData;

  const items = [
    {
      key: 'breached',
      count: breached.length,
      label: 'SLA breached',
      hint: 'Past the resolution deadline',
      to: '/department/complaints?filter=escalated',
      tone: 'critical' as Tone,
    },
    {
      key: 'at-risk',
      count: atRisk.length,
      label: 'SLA at risk',
      hint: 'Under 8 hours remaining',
      to: '/department/complaints?filter=at-risk',
      tone: 'warning' as Tone,
    },
    {
      key: 'unassigned',
      count: unassigned.length,
      label: 'Unassigned',
      hint: 'No officer allocated yet',
      to: '/department/complaints?filter=unassigned',
      tone: 'warning' as Tone,
    },
    {
      key: 'reinspection',
      count: reinspection.length,
      label: reinspection.length === 1 ? 'Reinspection request' : 'Reinspection requests',
      hint: 'A citizen asked for another look',
      to: '/department/complaints?filter=reinspection',
      tone: 'info' as Tone,
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <p className="dept-allclear">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        You&rsquo;re all caught up — every complaint is assigned and inside its SLA window.
      </p>
    );
  }

  return (
    <section className="dept-attention" aria-labelledby="dept-attention-title">
      <h2 className="dept-attention__title" id="dept-attention-title">
        Needs attention
      </h2>

      <ul className="dept-attention__list">
        {items.map((item) => (
          <li key={item.key}>
            <Link to={item.to} className={`dept-attention__item dept-attention__item--${item.tone}`}>
              <span className="dept-attention__dot" aria-hidden="true" />
              <span className="dept-attention__count">{item.count}</span>
              <span className="dept-attention__text">
                <span className="dept-attention__label">{item.label}</span>
                <span className="dept-attention__hint">{item.hint}</span>
              </span>
              <svg className="dept-attention__go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
