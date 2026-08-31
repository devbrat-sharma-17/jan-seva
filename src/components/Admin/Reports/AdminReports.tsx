// ============================================================
// Admin Reports Generator — JAN-SEVA Phase 5
// ============================================================

import { useState, useMemo } from 'react';
import {
  getCityOverview,
  getCivicHealthScore,
  getAllDepartmentRankings,
  getEscalationSummary,
  getFeedbackSummary,
} from '../../../services/adminService';
import { formatDate } from '../../../services/timeService';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';
import { BrandMark } from '../../ui/BrandMark';

export function AdminReports() {
  const [selectedReport, setSelectedReport] = useState<'daily' | 'sla' | 'department' | 'feedback'>(
    'daily',
  );

  const overview = useMemo(() => getCityOverview(), []);
  const health = useMemo(() => getCivicHealthScore(), []);
  const rankings = useMemo(() => getAllDepartmentRankings(), []);
  const escSummary = useMemo(() => getEscalationSummary(), []);
  const feedbackSummary = useMemo(() => getFeedbackSummary(), []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>Municipal Operations Reports</h1>{' '}
          <p>Generate authoritative printable summaries and governance performance digests</p>{' '}
        </div>{' '}
        <button
          type="button"
          className="admin-action-btn admin-action-btn--reassign"
          onClick={handlePrint}
        >
          {' '}
          Print / Export PDF
        </button>{' '}
      </div>{' '}
      {/* Report Type Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${selectedReport === 'daily' ? 'admin-filter-select' : ''}`}
          onClick={() => setSelectedReport('daily')}
        >
          {' '}
          Daily Civic Summary
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${selectedReport === 'department' ? 'admin-filter-select' : ''}`}
          onClick={() => setSelectedReport('department')}
        >
          {' '}
          Department Ranking Digest
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${selectedReport === 'sla' ? 'admin-filter-select' : ''}`}
          onClick={() => setSelectedReport('sla')}
        >
          {' '}
          SLA & Escalation Audit
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${selectedReport === 'feedback' ? 'admin-filter-select' : ''}`}
          onClick={() => setSelectedReport('feedback')}
        >
          {' '}
          Citizen Satisfaction Audit
        </button>{' '}
      </div>{' '}
      {/* Report Preview Document */}
      <div
        className="admin-panel"
        style={{
          border: '2px solid var(--color-border-strong)',
          padding: '2.5rem',
          background: 'var(--color-surface)',
          borderRadius: '1rem',
          maxWidth: '900px',
        }}
      >
        {' '}
        {/* Document Header */}
        <div
          style={{
            borderBottom: '2px solid var(--color-navy)',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {' '}
          <div>
            {' '}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.25rem',
              }}
            >
              {' '}
              <BrandMark size={26} />{' '}
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '0.04em',
                }}
              >
                {' '}
                JAN-SEVA CIVIC OPERATIONS
              </span>{' '}
            </div>{' '}
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {' '}
              Gwalior Municipal Corporation, Madhya Pradesh
            </div>{' '}
          </div>{' '}
          <div style={{ textAlign: 'right' }}>
            {' '}
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                fontWeight: 700,
              }}
            >
              {' '}
              Report Generated
            </div>{' '}
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {' '}
              {formatDate(new Date().toISOString())}
            </div>{' '}
            <div style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>
              Platform Reference: JS-GWL-REP-2026
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Report Content */}
        {selectedReport === 'daily' && (
          <div>
            {' '}
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: '1rem',
              }}
            >
              {' '}
              Executive Daily Civic Summary
            </h2>{' '}
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--slate-700)',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              {' '}
              This operational summary covers city-wide grievance ingestion, real-time resolution
              metrics, and platform health across all municipal divisions for the active period.
            </p>{' '}
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              {' '}
              <div className="kpi-card">
                {' '}
                <div className="kpi-card__label">Civic Health</div>{' '}
                <div className="kpi-card__value">{health.totalScore} / 100</div>{' '}
                <div className="kpi-card__sub">{health.tierBadge}</div>{' '}
              </div>{' '}
              <div className="kpi-card">
                {' '}
                <div className="kpi-card__label">Total Influx</div>{' '}
                <div className="kpi-card__value">{overview.totalComplaints}</div>{' '}
                <div className="kpi-card__sub">All recorded tickets</div>{' '}
              </div>{' '}
              <div className="kpi-card kpi-card--green">
                {' '}
                <div className="kpi-card__label">Total Resolved</div>{' '}
                <div className="kpi-card__value">{overview.resolvedComplaints}</div>{' '}
                <div className="kpi-card__sub">
                  {overview.resolutionVerificationRate}% verified by citizens
                </div>{' '}
              </div>{' '}
              <div className="kpi-card kpi-card--red">
                {' '}
                <div className="kpi-card__label">SLA Breaches</div>{' '}
                <div className="kpi-card__value">{escSummary.slaBreached}</div>{' '}
                <div className="kpi-card__sub">
                  {overview.slaCompliancePercent}% compliance
                </div>{' '}
              </div>{' '}
            </div>{' '}
          </div>
        )}
        {selectedReport === 'department' && (
          <div>
            {' '}
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: '1rem',
              }}
            >
              {' '}
              Department Ranking & Performance Evaluation
            </h2>{' '}
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--slate-700)',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              {' '}
              Standardized weighted evaluation across all 5 municipal departments covering
              resolution rate, SLA compliance, resolution speed, and citizen satisfaction.
            </p>{' '}
            <div className="admin-table-container">
              {' '}
              <table className="admin-complaints-table">
                {' '}
                <thead>
                  {' '}
                  <tr>
                    {' '}
                    <th>Rank</th> <th>Department</th> <th>Score</th> <th>Resolution %</th>{' '}
                    <th>SLA %</th> <th>Avg Hours</th>{' '}
                  </tr>{' '}
                </thead>{' '}
                <tbody>
                  {' '}
                  {rankings.map((r) => (
                    <tr key={r.departmentId}>
                      {' '}
                      <td>
                        <strong>#{r.rank}</strong>
                      </td>{' '}
                      <td>{r.departmentName}</td>{' '}
                      <td>
                        <strong>{r.performanceScore}/100</strong>
                      </td>{' '}
                      <td>{r.resolutionRate}%</td> <td>{r.slaCompliance}%</td>{' '}
                      <td>{r.averageResolutionHours}h</td>{' '}
                    </tr>
                  ))}
                </tbody>{' '}
              </table>{' '}
            </div>{' '}
          </div>
        )}
        {selectedReport === 'sla' && (
          <div>
            {' '}
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: '1rem',
              }}
            >
              {' '}
              SLA Compliance & Escalation Audit
            </h2>{' '}
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              {' '}
              <div className="kpi-card kpi-card--red">
                {' '}
                <div className="kpi-card__label">Breached Complaints</div>{' '}
                <div className="kpi-card__value">{escSummary.slaBreached}</div>{' '}
              </div>{' '}
              <div className="kpi-card kpi-card--amber">
                {' '}
                <div className="kpi-card__label">At Risk (&lt;8h)</div>{' '}
                <div className="kpi-card__value">{escSummary.slaAtRisk}</div>{' '}
              </div>{' '}
              <div className="kpi-card">
                {' '}
                <div className="kpi-card__label">Level 2 Escalations</div>{' '}
                <div className="kpi-card__value">{escSummary.escalated}</div>{' '}
              </div>{' '}
            </div>{' '}
          </div>
        )}
        {selectedReport === 'feedback' && (
          <div>
            {' '}
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: '1rem',
              }}
            >
              {' '}
              Citizen Satisfaction & Quality Audit
            </h2>{' '}
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              {' '}
              <div className="kpi-card">
                {' '}
                <div className="kpi-card__label">City Average</div>{' '}
                <div className="kpi-card__value" style={{ color: 'var(--color-warning)' }}>
                  {' '}
                  {feedbackSummary.overallRating} ★
                </div>{' '}
              </div>{' '}
              <div className="kpi-card kpi-card--green">
                {' '}
                <div className="kpi-card__label">Verification Rate</div>{' '}
                <div className="kpi-card__value">
                  {feedbackSummary.resolutionVerificationRate}%
                </div>{' '}
              </div>{' '}
              <div className="kpi-card kpi-card--red">
                {' '}
                <div className="kpi-card__label">Reinspections</div>{' '}
                <div className="kpi-card__value">{feedbackSummary.reinspectionRequested}</div>{' '}
              </div>{' '}
            </div>{' '}
          </div>
        )}
        {/* Document Footer */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '1.25rem',
            marginTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.6875rem',
            color: 'var(--slate-400)',
          }}
        >
          {' '}
          <span>JAN-SEVA Governance System · Official Administrative Use</span>{' '}
          <span>Single Source of Truth: Gwalior Civic Repository</span>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
