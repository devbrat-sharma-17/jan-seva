// ============================================================
// Admin Command Centre — city overview
// ============================================================
// Reads as an answer to one question at a time: how is the city doing,
// what needs attention, who is behind, is resolution actually landing,
// and what has just happened.

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getCivicHealthScore,
  getCityOverview,
  getCityNeedsAttention,
  getAllDepartmentRankings,
  getRecentActivity,
} from '../../../services/adminService';
import { useLiveData } from '../../../hooks/useLiveData';
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
  /* One derivation, one subscription. Each figure below used to be its
     own `useMemo(..., [])`, so the page never reflected a department
     update without a full reload. */
  const data = useLiveData(
    useCallback(
      () => ({
        health: getCivicHealthScore(),
        overview: getCityOverview(),
        attention: getCityNeedsAttention(),
        rankings: getAllDepartmentRankings(),
        activity: getRecentActivity(6),
      }),
      []
    )
  );

  const { health, overview, attention, rankings, activity } = data;

  /* Four numbers someone acts on today. Totals, turnaround and the
     verification rate describe the record rather than the shift, so they
     sit in the summary line and the pipeline card instead. */
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
      value: overview.slaCompliancePercent > 0 ? `${overview.slaCompliancePercent}%` : '—',
      note: 'of settled deadlines',
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

  /* Resolution quality. "Resolved" on its own overstates the outcome:
     a department closing a job is not a citizen agreeing it is fixed. */
  const pipeline = [
    { label: 'Resolved', value: overview.resolvedComplaints, tone: 'neutral' as const },
    {
      label: 'Awaiting citizen verification',
      value: overview.pendingCitizenVerification,
      tone: 'warning' as const,
    },
    {
      label: 'Citizen verified',
      value: overview.resolvedComplaints - overview.pendingCitizenVerification,
      tone: 'good' as const,
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

        <span className="demo-tag">Demo data</span>
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
          {/* Not an official rating. This is a composite this product
              computes from its own records, and says so. */}
          <p className="civic-health__caveat">
            A JAN-SEVA composite of the figures below — not an official municipal rating.
          </p>
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
        {overview.averageResolutionHours > 0 && (
          <>
            {' '}
            &middot; <strong>{overview.averageResolutionHours}h</strong> average turnaround
          </>
        )}
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
                      {item.description}
                    </span>
                  </span>
                  <AdminIcon name="arrow-right" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Department standings ---- */}
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
                  {dept.tier === 'no-data' ? '—' : dept.performanceScore}
                  <span>/100</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Resolution quality ---- */}
      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">
            <AdminIcon name="check" size={16} />
            Resolution quality
          </h2>
          <Link to="/admin/feedback" className="admin-btn admin-btn--ghost admin-btn--sm">
            Feedback
            <AdminIcon name="arrow-right" size={14} />
          </Link>
        </div>

        <div className="admin-pipeline">
          {pipeline.map((step) => (
            <div key={step.label} className={`admin-pipeline__step admin-pipeline__step--${step.tone}`}>
              <span className="admin-pipeline__value">{step.value}</span>
              <span className="admin-pipeline__label">{step.label}</span>
            </div>
          ))}
        </div>

        <p className="admin-pipeline__note">
          A department submitting a resolution is not the same as a citizen confirming it.
          Verification moves only when the citizen responds on their tracking page.
          {overview.resolvedComplaints > 0 && (
            <> Currently {overview.resolutionVerificationRate}% verified.</>
          )}
        </p>
      </section>

      {/* ---- Recent activity ---- */}
      <section className="admin-card">
        <h2 className="admin-card__title">Recent activity</h2>

        {activity.length === 0 ? (
          <p className="admin-empty-line">No recorded activity yet.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
