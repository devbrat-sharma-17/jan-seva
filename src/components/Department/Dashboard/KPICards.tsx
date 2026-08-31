import type { DepartmentMetrics } from '../../../types/department';

interface KPICardsProps {
  metrics: DepartmentMetrics;
  onFilterClick?: (filter: string) => void;
}

/**
 * Four numbers, each a link into the queue filtered to exactly what the
 * number counts. Anything that is not a count someone acts on today
 * belongs on the performance page, not here.
 */
export function KPICards({ metrics, onFilterClick }: KPICardsProps) {
  const cards = [
    {
      id: 'active',
      title: 'Active',
      value: metrics.active,
      sub: `${metrics.pending} awaiting triage`,
      tone: 'neutral',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: 'high-priority',
      title: 'High priority',
      value: metrics.highPriority + metrics.criticalPriority,
      sub: `${metrics.criticalPriority} critical`,
      tone: 'warning',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'at-risk',
      title: 'SLA at risk',
      value: metrics.slaAtRisk,
      sub: 'Under 6 hours left',
      tone: 'warning',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'escalated',
      title: 'Escalated',
      value: metrics.escalated,
      sub: 'Past the SLA deadline',
      tone: 'danger',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dept-kpi-grid">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          className={`dept-kpi-card dept-kpi-card--${card.tone}${card.value === 0 ? ' is-zero' : ''}`}
          onClick={() => onFilterClick?.(card.id)}
        >
          <span className="dept-kpi-card__top">
            <span className="dept-kpi-card__title">{card.title}</span>
            <span className="dept-kpi-card__icon" aria-hidden="true">{card.icon}</span>
          </span>
          <span className="dept-kpi-card__value">{card.value}</span>
          <span className="dept-kpi-card__sub">{card.sub}</span>
        </button>
      ))}
    </div>
  );
}
