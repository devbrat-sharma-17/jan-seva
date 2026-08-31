import { useNavigate } from 'react-router-dom';
import type { Complaint } from '../../../types';

interface NeedsAttentionProps {
  attentionData: {
    breached: Complaint[];
    atRisk: Complaint[];
    unassigned: Complaint[];
    reinspection: Complaint[];
  };
}

/**
 * Only the two queues the KPI tiles do not already count.
 *
 * This bar used to repeat "SLA breached" and "SLA at risk" directly under
 * the tiles carrying the same two numbers, which made the same fact
 * compete with itself for attention. Escalations and at-risk are read
 * from the tiles; what is left is work with no owner.
 */
export function NeedsAttention({ attentionData }: NeedsAttentionProps) {
  const navigate = useNavigate();
  const { breached, atRisk, unassigned, reinspection } = attentionData;

  const actionable = [
    unassigned.length > 0 && {
      key: 'unassigned',
      count: unassigned.length,
      label: unassigned.length === 1 ? 'complaint has no officer' : 'complaints have no officer',
      to: '/department/complaints?filter=unassigned',
      tone: 'warning' as const,
    },
    reinspection.length > 0 && {
      key: 'reinspection',
      count: reinspection.length,
      label: reinspection.length === 1 ? 'reinspection requested' : 'reinspections requested',
      to: '/department/complaints?filter=reinspection',
      tone: 'info' as const,
    },
  ].filter(Boolean) as Array<{
    key: string;
    count: number;
    label: string;
    to: string;
    tone: 'warning' | 'info';
  }>;

  // Nothing outstanding anywhere — worth one quiet line of confirmation.
  if (actionable.length === 0) {
    if (breached.length > 0 || atRisk.length > 0) return null;

    return (
      <p className="dept-allclear">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        Every complaint is assigned and inside its SLA window.
      </p>
    );
  }

  return (
    <div className="dept-attention" role="group" aria-label="Needs attention">
      {actionable.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`dept-attention__item dept-attention__item--${item.tone}`}
          onClick={() => navigate(item.to)}
        >
          <span className="dept-attention__count">{item.count}</span>
          <span className="dept-attention__label">{item.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}
