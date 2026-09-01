import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Complaint } from '../../../types';

import { explainPriority } from '../../../services/aiService';
import { computeSlaHealth } from '../../../services/slaService';
import { formatRelative } from '../../../services/timeService';

interface PriorityQueueProps {
  complaints: Complaint[];
  title?: string;
  subtitle?: string;
  /** Show the "view the whole queue" link. Off inside the queue page itself. */
  showViewAll?: boolean;
  /** Fixed row count, for the dashboard preview. Omit to paginate. */
  limit?: number;
  /**
   * Rows added per "show more". Set on the full queue page, where the
   * list is unbounded and every row carries a thumbnail, four pills and
   * a rationale line — a few hundred of those is a lot of DOM to build
   * for work nobody has scrolled to yet.
   */
  pageSize?: number;
  emptyTitle?: string;
  emptyDesc?: string;
}

export function PriorityQueue({
  complaints,
  title,
  subtitle,
  showViewAll = false,
  limit,
  pageSize,
  emptyTitle = 'Nothing in the queue',
  emptyDesc = 'Every complaint for this department is resolved or assigned.',
}: PriorityQueueProps) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(pageSize ?? limit ?? 6);

  // Changing a filter should start the list from the top again, not keep
  // showing however many pages the previous filter had been expanded to.
  useEffect(() => {
    setShown(pageSize ?? limit ?? 6);
  }, [pageSize, limit, complaints]);

  /* Operational ordering: SLA breach, then approaching, then a requested
     reinspection, then untriaged, then assessed severity, then age. Health is
     computed against the clock rather than read from the persisted
     `sla.status`, which is a snapshot from whenever the record was last
     written and drifts within hours. */
  const { sorted, healthById } = useMemo(() => {
    const now = Date.now();
    const health = new Map<string, ReturnType<typeof computeSlaHealth>>();
    complaints.forEach((c) => health.set(c.id, computeSlaHealth(c, now)));

    const list = complaints
      .filter((c) => c.status !== 'resolved')
      .sort((a, b) => {
        const weight = (c: Complaint) => {
          const status = health.get(c.id)?.status;
          let w = c.aiAnalysis?.priorityScore || 50;
          if (status === 'exceeded') w += 100;
          if (status === 'approaching') w += 40;
          if (c.feedback?.reinspectionRequested) w += 50;
          if (c.status === 'pending') w += 20;
          return w;
        };
        const diff = weight(b) - weight(a);
        if (diff !== 0) return diff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return { sorted: list, healthById: health };
  }, [complaints]);

  const openTotal = sorted.length;
  const visible = sorted.slice(0, shown);
  const hasMore = openTotal > visible.length;

  if (visible.length === 0) {
    return (
      <div className="dept-state dept-state--ok">
        <span className="dept-state__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h3 className="dept-state__title">{emptyTitle}</h3>
        <p className="dept-state__desc">{emptyDesc}</p>
      </div>
    );
  }

  return (
    <section className="dept-queue">
      {(title || showViewAll) && (
        <header className="dept-queue__head">
          <div className="dept-queue__head-text">
            {title && <h2 className="dept-queue__title">{title}</h2>}
            {subtitle && <p className="dept-queue__subtitle">{subtitle}</p>}
          </div>

          {showViewAll && (
            <button
              type="button"
              className="dept-action-btn dept-action-btn--ghost dept-action-btn--sm"
              onClick={() => navigate('/department/complaints')}
            >
              <span>All {openTotal} open</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </header>
      )}

      <ul className="dept-queue__list">
        {visible.map((complaint) => {
          const priority = explainPriority(complaint);
          const slaStatus = healthById.get(complaint.id)?.status;
          const photoUrl = complaint.photos[0];
          const urgent = priority.level === 'critical' || priority.level === 'high';
          const linkedCount = complaint.duplicate?.supportingCount || 2;

          return (
            <li key={complaint.id}>
              {/* A real link: keyboard-operable and middle-clickable. The
                  previous div[role=button] had no key handler at all. */}
              <Link
                to={`/department/complaints/${complaint.id}`}
                className={`dept-row dept-row--${priority.level}`}
              >
                <span className="dept-row__thumb">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="dept-row__thumb-fallback" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </span>
                  )}
                </span>

                <span className="dept-row__body">
                  <span className="dept-row__meta">
                    <span className="dept-row__id">{complaint.id}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatRelative(complaint.createdAt)}</span>
                    {complaint.duplicate?.isLinked && (
                      <span className="dept-row__linked">{linkedCount} linked reports</span>
                    )}
                  </span>

                  <span className="dept-row__title">{complaint.issue.title}</span>

                  <span className="dept-row__place">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {complaint.location.address || complaint.location.locality}, {complaint.location.city}
                  </span>

                  {/* The triage rationale, as one muted line rather than the
                      bordered panel it used to sit in. */}
                  <span className="dept-row__why">{priority.reasons.slice(0, 2).join(' · ')}</span>
                </span>

                <span className="dept-row__side">
                  <span className="dept-row__tags">
                    {urgent && (
                      <span className={`dept-priority-tag dept-priority-tag--${priority.level}`}>
                        {priority.level}
                      </span>
                    )}
                    <span className={`dept-status-pill dept-status-pill--${complaint.status}`}>
                      {complaint.status.replace('-', ' ')}
                    </span>
                    {slaStatus === 'exceeded' && (
                      <span className="dept-sla-pill dept-sla-pill--breached">SLA breached</span>
                    )}
                    {slaStatus === 'approaching' && (
                      <span className="dept-sla-pill dept-sla-pill--atrisk">SLA at risk</span>
                    )}
                  </span>

                  <span className="dept-row__owner">
                    {complaint.assignedOfficer?.name ? (
                      complaint.assignedOfficer.name
                    ) : (
                      <span className="dept-row__owner--none">Unassigned</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="dept-queue__more">
          <p className="dept-queue__more-text">
            Showing the {visible.length} most urgent of {openTotal} open complaints.
          </p>

          {/* The dashboard preview links onward instead; only the full
              queue grows in place. */}
          {pageSize !== undefined && (
            <button
              type="button"
              className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm"
              onClick={() => setShown((n) => n + pageSize)}
            >
              Show {Math.min(pageSize, openTotal - visible.length)} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}
