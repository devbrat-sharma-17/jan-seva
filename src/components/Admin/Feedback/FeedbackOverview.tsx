// ============================================================
// Admin Citizen Feedback Center — JAN-SEVA Phase 5
// ============================================================

import { useMemo } from 'react';
import { getFeedbackSummary } from '../../../services/adminService';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';

export function FeedbackOverview() {
  const summary = useMemo(() => getFeedbackSummary(), []);

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>Citizen Feedback & Resolution Quality</h1>{' '}
          <p>
            Analyzing citizen sentiment, rating trends, and resolution verification across Gwalior
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {/* Top Level KPIs */}
      <div className="kpi-grid">
        {' '}
        <div className="kpi-card">
          {' '}
          <div className="kpi-card__label">Overall Rating</div>{' '}
          <div className="kpi-card__value" style={{ color: 'var(--color-warning)' }}>
            {' '}
            {summary.overallRating > 0 ? `${summary.overallRating} ★` : '—'}
          </div>{' '}
          <div className="kpi-card__sub">{summary.totalRatings} citizen ratings</div>{' '}
        </div>{' '}
        <div className="kpi-card kpi-card--green">
          {' '}
          <div className="kpi-card__label">Verification Rate</div>{' '}
          <div className="kpi-card__value">{summary.resolutionVerificationRate}%</div>{' '}
          <div className="kpi-card__sub">
            {summary.citizenVerified} of {summary.totalResolved} verified
          </div>{' '}
        </div>{' '}
        <div className="kpi-card kpi-card--amber">
          {' '}
          <div className="kpi-card__label">Awaiting Verification</div>{' '}
          <div className="kpi-card__value">{summary.awaitingVerification}</div>{' '}
          <div className="kpi-card__sub">Pending citizen review</div>{' '}
        </div>{' '}
        <div className="kpi-card kpi-card--red">
          {' '}
          <div className="kpi-card__label">Reinspections</div>{' '}
          <div className="kpi-card__value">{summary.reinspectionRequested}</div>{' '}
          <div className="kpi-card__sub">Work rejected by citizen</div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Resolution Quality & Sentiment Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {' '}
        {/* Rating Breakdown */}
        <div className="admin-panel">
          {' '}
          <div className="admin-panel__title">Rating distribution</div>{' '}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {' '}
            <div>
              {' '}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8125rem',
                  marginBottom: '4px',
                }}
              >
                {' '}
                <span style={{ fontWeight: 600, color: 'var(--green-500)' }}>Positive (4–5 Stars)</span>{' '}
                <span>{summary.positive} ratings</span>{' '}
              </div>{' '}
              <div
                style={{
                  height: '8px',
                  background: 'var(--color-surface-sunken)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                {' '}
                <div
                  style={{
                    height: '100%',
                    width: `${summary.totalRatings >0 ? Math.round((summary.positive / summary.totalRatings) * 100) : 0}%`,
                    background: 'var(--green-500)',
                  }}
                />{' '}
              </div>{' '}
            </div>{' '}
            <div>
              {' '}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8125rem',
                  marginBottom: '4px',
                }}
              >
                {' '}
                <span style={{ fontWeight: 600, color: 'var(--amber-600)' }}>Neutral (3 Stars)</span>{' '}
                <span>{summary.neutral} ratings</span>{' '}
              </div>{' '}
              <div
                style={{
                  height: '8px',
                  background: 'var(--color-surface-sunken)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                {' '}
                <div
                  style={{
                    height: '100%',
                    width: `${summary.totalRatings >0 ? Math.round((summary.neutral / summary.totalRatings) * 100) : 0}%`,
                    background: 'var(--amber-600)',
                  }}
                />{' '}
              </div>{' '}
            </div>{' '}
            <div>
              {' '}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8125rem',
                  marginBottom: '4px',
                }}
              >
                {' '}
                <span style={{ fontWeight: 600, color: 'var(--red-600)' }}>Critical (1–2 Stars)</span>{' '}
                <span>{summary.negative} ratings</span>{' '}
              </div>{' '}
              <div
                style={{
                  height: '8px',
                  background: 'var(--color-surface-sunken)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                {' '}
                <div
                  style={{
                    height: '100%',
                    width: `${summary.totalRatings >0 ? Math.round((summary.negative / summary.totalRatings) * 100) : 0}%`,
                    background: 'var(--red-600)',
                  }}
                />{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Common Feedback Themes */}
        <div className="admin-panel">
          {' '}
          <div className="admin-panel__title">Feedback themes</div>{' '}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {' '}
            {summary.themes.map((theme) => (
              <div
                key={theme.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background:
                    theme.sentiment === 'positive'
                      ? 'var(--color-success-bg)'
                      : theme.sentiment === 'negative'
                        ? 'var(--color-error-bg)'
                        : 'var(--color-bg)',
                  border: `1px solid ${
                    theme.sentiment === 'positive'
                      ? 'var(--color-success-border)'
                      : theme.sentiment === 'negative'
                        ? 'var(--color-error-border)'
                        : 'var(--color-border)'
                  }`,
                  color:
                    theme.sentiment === 'positive'
                      ? 'var(--color-success-fg)'
                      : theme.sentiment === 'negative'
                        ? 'var(--red-700)'
                        : 'var(--color-text-secondary)',
                }}
              >
                {' '}
                <span>{theme.icon}</span> <span>{theme.label}</span>{' '}
                <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({theme.count})</span>{' '}
              </div>
            ))}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Department Breakdown */}
      <div className="admin-panel">
        {' '}
        <div className="admin-panel__title">Satisfaction by department</div>{' '}
        <div className="admin-table-container">
          {' '}
          <table className="admin-complaints-table">
            {' '}
            <thead>
              {' '}
              <tr>
                {' '}
                <th>Department</th> <th>Average Rating</th> <th>Total Ratings</th>{' '}
                <th>Status</th>{' '}
              </tr>{' '}
            </thead>{' '}
            <tbody>
              {' '}
              {summary.departmentBreakdown.map((dept) => (
                <tr key={dept.departmentId}>
                  {' '}
                  <td>
                    {' '}
                    <strong>{dept.departmentName}</strong>{' '}
                  </td>{' '}
                  <td>
                    {' '}
                    <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>
                      {' '}
                      {dept.rating > 0 ? `${dept.rating} ★` : '—'}
                    </span>{' '}
                  </td>{' '}
                  <td>{dept.totalRatings}</td>{' '}
                  <td>
                    {' '}
                    {dept.rating >= 4.5 ? (
                      <span style={{ color: 'var(--green-500)', fontWeight: 600 }}>High Satisfaction</span>
                    ) : dept.rating >= 4.0 ? (
                      <span style={{ color: 'var(--color-civic-blue-dark)', fontWeight: 600 }}>✓ Good Standing</span>
                    ) : dept.rating > 0 ? (
                      <span style={{ color: 'var(--amber-600)', fontWeight: 600 }}>Needs Improvement</span>
                    ) : (
                      <span style={{ color: 'var(--slate-400)' }}>Awaiting ratings</span>
                    )}
                  </td>{' '}
                </tr>
              ))}
            </tbody>{' '}
          </table>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
