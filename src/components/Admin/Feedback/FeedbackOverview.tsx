// ============================================================
// Admin — citizen feedback and resolution quality
// ============================================================
// The distinction this screen exists to make: a department submitting a
// resolution is not a citizen agreeing the work is done. The pipeline at
// the top keeps those apart, and nothing here moves until a citizen acts.

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getFeedbackSummary } from '../../../services/adminService';
import { useLiveData } from '../../../hooks/useLiveData';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';
import './FeedbackOverview.css';

export function FeedbackOverview() {
  const summary = useLiveData(useCallback(() => getFeedbackSummary(), []));

  const hasRatings = summary.totalRatings > 0;

  const sentiment = [
    {
      key: 'positive',
      label: 'Positive',
      detail: '4–5 stars',
      count: summary.positive,
      tone: 'good' as const,
    },
    {
      key: 'neutral',
      label: 'Neutral',
      detail: '3 stars',
      count: summary.neutral,
      tone: 'neutral' as const,
    },
    {
      key: 'negative',
      label: 'Negative',
      detail: '1–2 stars',
      count: summary.negative,
      tone: 'bad' as const,
    },
  ];

  const pipeline = [
    { label: 'Resolved by a department', value: summary.totalResolved, tone: 'neutral' as const },
    { label: 'Awaiting citizen verification', value: summary.awaitingVerification, tone: 'warning' as const },
    { label: 'Verified by the citizen', value: summary.citizenVerified, tone: 'good' as const },
    { label: 'Reinspection requested', value: summary.reinspectionRequested, tone: 'bad' as const },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Citizen feedback</h1>
          <p className="admin-page-desc">
            What citizens said after a department closed their complaint.
          </p>
        </div>

        <span className="demo-tag">Demo data</span>
      </div>

      {/* ---- Headline figures ---- */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card__label">Overall rating</div>
          <div className="kpi-card__value">
            {hasRatings ? `${summary.overallRating} / 5` : '—'}
          </div>
          <div className="kpi-card__sub">
            {hasRatings
              ? `${summary.totalRatings} citizen rating${summary.totalRatings === 1 ? '' : 's'}`
              : 'No ratings yet'}
          </div>
        </div>

        <div className="kpi-card kpi-card--green">
          <div className="kpi-card__label">Verification rate</div>
          <div className="kpi-card__value">
            {summary.totalResolved > 0 ? `${summary.resolutionVerificationRate}%` : '—'}
          </div>
          <div className="kpi-card__sub">
            {summary.citizenVerified} of {summary.totalResolved} confirmed
          </div>
        </div>

        <div className="kpi-card kpi-card--amber">
          <div className="kpi-card__label">Awaiting verification</div>
          <div className="kpi-card__value">{summary.awaitingVerification}</div>
          <div className="kpi-card__sub">Closed but not yet confirmed</div>
        </div>

        <div className="kpi-card kpi-card--red">
          <div className="kpi-card__label">Reinspections</div>
          <div className="kpi-card__value">{summary.reinspectionRequested}</div>
          <div className="kpi-card__sub">Work the citizen rejected</div>
        </div>
      </div>

      {/* ---- Resolution quality pipeline ---- */}
      <div className="admin-panel">
        <div className="admin-panel__title">Resolution quality</div>
        <p className="admin-panel__note">
          Each step needs the citizen to act. A resolved count on its own says only that a
          department believes it is finished.
        </p>

        <ol className="fb-pipeline">
          {pipeline.map((step) => (
            <li key={step.label} className={`fb-pipeline__step fb-pipeline__step--${step.tone}`}>
              <span className="fb-pipeline__value">{step.value}</span>
              <span className="fb-pipeline__label">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="fb-columns">
        {/* ---- Sentiment ---- */}
        <div className="admin-panel">
          <div className="admin-panel__title">Rating spread</div>

          {!hasRatings ? (
            <p className="admin-panel__empty">
              No citizen feedback has been recorded yet. Ratings appear here once citizens confirm
              a resolution on their tracking page.
            </p>
          ) : (
            <ul className="fb-bars">
              {sentiment.map((band) => {
                const pct = Math.round((band.count / summary.totalRatings) * 100);
                return (
                  <li key={band.key} className={`fb-bar fb-bar--${band.tone}`}>
                    <div className="fb-bar__head">
                      <span className="fb-bar__label">
                        {band.label} <span className="fb-bar__detail">{band.detail}</span>
                      </span>
                      <span className="fb-bar__count">
                        {band.count} ({pct}%)
                      </span>
                    </div>

                    <div
                      className="fb-bar__track"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${band.label} ratings`}
                    >
                      <span className="fb-bar__fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ---- Themes ---- */}
        <div className="admin-panel">
          <div className="admin-panel__title-row">
            <span className="admin-panel__title">Common themes</span>
            <span className="demo-tag">Illustrative</span>
          </div>

          {/* These are apportioned from the rating spread, not extracted
              from what citizens actually wrote. Labelling them as
              illustrative keeps a stand-in for text analysis from being
              read as text analysis. */}
          <p className="admin-panel__note">
            Placeholder groupings derived from the rating spread. Real themes need analysis of the
            comments citizens leave, which this build does not do.
          </p>

          {summary.themes.length === 0 ? (
            <p className="admin-panel__empty">Not enough feedback to group yet.</p>
          ) : (
            <ul className="fb-themes">
              {summary.themes.map((theme) => (
                <li key={theme.id} className={`fb-theme fb-theme--${theme.sentiment}`}>
                  <span aria-hidden="true">{theme.icon}</span>
                  <span className="fb-theme__label">{theme.label}</span>
                  <span className="fb-theme__count">{theme.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- By department ---- */}
      <div className="admin-panel">
        <div className="admin-panel__title">Satisfaction by department</div>

        <div className="admin-table-container">
          <table className="admin-complaints-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Average rating</th>
                <th>Ratings</th>
                <th>Standing</th>
              </tr>
            </thead>
            <tbody>
              {summary.departmentBreakdown.map((dept) => (
                <tr key={dept.departmentId}>
                  <td>
                    <Link
                      to={`/admin/departments/${dept.departmentId}`}
                      className="admin-complaint-id-link"
                    >
                      {dept.departmentName}
                    </Link>
                  </td>
                  <td>
                    <span className="fb-rating">
                      {dept.totalRatings > 0 ? `${dept.rating} / 5` : '—'}
                    </span>
                  </td>
                  <td>{dept.totalRatings}</td>
                  <td>
                    {/* A department nobody has rated is not "needs
                        improvement" — it is unrated, and says so. */}
                    {dept.totalRatings === 0 ? (
                      <span className="fb-standing fb-standing--none">Awaiting ratings</span>
                    ) : dept.rating >= 4.5 ? (
                      <span className="fb-standing fb-standing--high">High satisfaction</span>
                    ) : dept.rating >= 4.0 ? (
                      <span className="fb-standing fb-standing--good">Good standing</span>
                    ) : (
                      <span className="fb-standing fb-standing--low">Needs improvement</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
