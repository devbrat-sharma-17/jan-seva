// ============================================================
// Admin Command Centre — city overview
// ============================================================

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getCivicHealthScore,
  getCityOverview,
  getCityNeedsAttention,
  getAllDepartmentRankings,
  getRecentActivity,
} from '../../../services/adminService';
import { formatRelative } from '../../../services/timeService';
import { AdminIcon, type AdminIconName } from '../AdminIcon';
import './AdminDashboard.css';

const ACTIVITY_ICON: Record<string, AdminIconName> = {
  resolution: 'check',
  escalation: 'escalations',
  assignment: 'user',
  feedback: 'star',
};

export function AdminDashboard() {
  const health = useMemo(() => getCivicHealthScore(), []);
  const overview = useMemo(() => getCityOverview(), []);
  const attention = useMemo(() => getCityNeedsAttention(), []);
  const rankings = useMemo(() => getAllDepartmentRankings(), []);
  const activity = useMemo(() => getRecentActivity(6), []);

  /* Four numbers someone acts on today. The other four the service
     returns — total filed, total resolved, average turnaround and the
     verification rate — describe the record rather than the shift, so
     they sit in the summary line below instead of taking a tile each. */
  const kpis = [
    {
      label: 'Active',
      value: String(overview.activeComplaints),
      note: 'awaiting resolution',
      tone: 'neutral' as const,
      to: '/admin/complaints',
    },
    {
      label: 'Escalated',
      value: String(overview.escalatedComplaints),
      note: 'past SLA deadline',
      tone: 'danger' as const,
      to: '/admin/escalations',
    },
    {
      label: 'SLA compliance',
      value: `${overview.slaCompliancePercent}%`,
      note: 'city-wide',
      tone: overview.slaCompliancePercent < 75 ? ('warning' as const) : ('good' as const),
      to: '/admin/performance',
    },
    {
      label: 'Satisfaction',
      value:
        overview.citizenSatisfactionAverage > 0 ? `${overview.citizenSatisfactionAverage}/5` : '—',
      note: 'citizen rating',
      tone: 'good' as const,
      to: '/admin/feedback',
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">City overview</h1>
          <p className="admin-page-desc">
            Service delivery across all five departments in Gwalior.
          </p>
        </div>
      </div>

      {/* ---- Civic health ---- */}
      <section className={`civic-health civic-health--${health.tier}`}>
        <div className="civic-health__figure">
          <span className="civic-health__score">{health.totalScore}</span>
          <span className="civic-health__max">/ 100</span>
        </div>

        <div className="civic-health__meta">
          <p className="civic-health__label">Civic health score</p>
          <span className="civic-health__tier">{health.tierBadge}</span>
        </div>

        <dl className="civic-health__parts">
          {Object.values(health.components).map((c) => {
            const pct = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
            return (
              <div key={c.label} className="civic-health__part">
                <dt>{c.label}</dt>
                <dd>
                  <span className="civic-health__bar">
                    <span className="civic-health__fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="civic-health__value">{c.value}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* ---- Four live numbers ---- */}
      <div className="admin-kpis">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className={`admin-kpi admin-kpi--${k.tone}`}>
            <span className="admin-kpi__label">{k.label}</span>
            <span className="admin-kpi__value">{k.value}</span>
            <span className="admin-kpi__note">{k.note}</span>
          </Link>
        ))}
      </div>

      <p className="admin-summary">
        <strong>{overview.totalComplaints.toLocaleString()}</strong> complaints filed to date
        &middot; <strong>{overview.resolvedComplaints}</strong> resolved
        {overview.averageResolutionHours > 0 && (
          <>
            {' '}
            &middot; <strong>{overview.averageResolutionHours}h</strong> average turnaround
          </>
        )}{' '}
        &middot; <strong>{overview.pendingCitizenVerification}</strong> awaiting citizen
        verification ({overview.resolutionVerificationRate}% verified)
      </p>

      {/* ---- Needs attention ---- */}
      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">
            <AdminIcon name="alert" size={16} />
            Needs attention
          </h2>
          {attention.length > 5 && (
            <Link to="/admin/escalations" className="admin-btn admin-btn--ghost admin-btn--sm">
              All {attention.length}
              <AdminIcon name="arrow-right" size={14} />
            </Link>
          )}
        </div>

        {attention.length === 0 ? (
          <p className="admin-empty-line">
            <AdminIcon name="check" size={16} />
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="attention-list">
            {attention.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link to={item.drillDownPath || '/admin/escalations'} className="attention-item">
                  <span
                    className={`attention-item__dot attention-item__dot--${item.severity}`}
                    aria-hidden="true"
                  />
                  <span className="attention-item__text">
                    <span className="attention-item__title">{item.title}</span>
                    <span className="attention-item__meta">
                      {item.department ? `${item.department} · ` : ''}
                      {item.severity} priority
                    </span>
                  </span>
                  <AdminIcon name="arrow-right" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Department standings ----
           Five cards each carrying four metrics and four reason lines was
           twenty-plus data points competing at one glance. A ranked row
           per department answers the actual question: who is behind. */}
      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">
            <AdminIcon name="departments" size={16} />
            Department standings
          </h2>
          <Link to="/admin/departments" className="admin-btn admin-btn--ghost admin-btn--sm">
            Details
            <AdminIcon name="arrow-right" size={14} />
          </Link>
        </div>

        <ol className="dept-rank">
          {rankings.map((dept, i) => (
            <li key={dept.departmentId}>
              <Link to={`/admin/departments/${dept.departmentId}`} className="dept-rank__row">
                <span className="dept-rank__pos">{i + 1}</span>

                <span className="dept-rank__text">
                  <span className="dept-rank__name">{dept.shortName}</span>
                  <span className="dept-rank__stats">
                    {dept.resolutionRate}% resolved &middot; {dept.slaCompliance}% on time
                    {dept.escalations > 0 && ` · ${dept.escalations} escalated`}
                  </span>
                </span>

                <span className={`dept-rank__tier dept-rank__tier--${dept.tier}`}>
                  {dept.tierLabel}
                </span>

                <span className="dept-rank__score">
                  {dept.performanceScore}
                  <span>/100</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Recent activity ---- */}
      <section className="admin-card">
        <h2 className="admin-card__title">Recent activity</h2>

        <ul className="activity-list">
          {activity.map((evt) => (
            <li key={evt.id} className="activity-item">
              <span
                className={`activity-item__icon activity-item__icon--${evt.type}`}
                aria-hidden="true"
              >
                <AdminIcon name={ACTIVITY_ICON[evt.type] ?? 'note'} size={15} />
              </span>
              <span className="activity-item__text">
                <span className="activity-item__title">{evt.title}</span>
                <span className="activity-item__meta">
                  {evt.department}
                  {evt.complaintId && ` · ${evt.complaintId}`}
                </span>
              </span>
              <time className="activity-item__time">{formatRelative(evt.timestamp)}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
