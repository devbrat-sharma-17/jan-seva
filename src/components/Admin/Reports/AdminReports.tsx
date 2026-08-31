// ============================================================
// Admin Reports Generator — JAN-SEVA Phase 5
// ============================================================

import { useCallback, useState } from 'react';
import { useLiveData } from '../../../hooks/useLiveData';
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

  const report = useLiveData(
    useCallback(
      () => ({
        overview: getCityOverview(),
        health: getCivicHealthScore(),
        rankings: getAllDepartmentRankings(),
        escSummary: getEscalationSummary(),
        feedbackSummary: getFeedbackSummary(),
      }),
      []
    )
  );

  const { overview, health, rankings, escSummary, feedbackSummary } = report;

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
      <div className="admin-u-row">
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
      <div className="admin-panel admin-report-sheet">
        {' '}
        {/* Document Header */}
        <div
          className="admin-report-head"
        >
          {' '}
          <div>
            {' '}
            <div
              className="admin-report-brand"
            >
              {' '}
              <BrandMark size={26} />{' '}
              <span
                className="admin-report-wordmark"
              >
                {' '}
                JAN-SEVA CIVIC OPERATIONS
              </span>{' '}
            </div>{' '}
            <div className="admin-u-label">
              {' '}
              Gwalior Municipal Corporation, Madhya Pradesh
            </div>{' '}
          </div>{' '}
          <div className="admin-u-right">
            {' '}
            <div
              className="admin-report-meta-label"
            >
              {' '}
              Report Generated
            </div>{' '}
            <div className="admin-u-figure">
              {' '}
              {formatDate(new Date().toISOString())}
            </div>{' '}
            <div className="admin-u-sub">
              Platform Reference: JS-GWL-REP-2026
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Report Content */}
        {selectedReport === 'daily' && (
          <div>
            {' '}
            <h2
              className="admin-report-h2"
            >
              {' '}
              Executive Daily Civic Summary
            </h2>{' '}
            <p
              className="admin-report-intro"
            >
              {' '}
              This operational summary covers city-wide grievance ingestion, real-time resolution
              metrics, and platform health across all municipal divisions for the active period.
            </p>{' '}
            <div className="kpi-grid admin-u-gap-lg">
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
              className="admin-report-h2"
            >
              {' '}
              Department Ranking & Performance Evaluation
            </h2>{' '}
            <p
              className="admin-report-intro"
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
              className="admin-report-h2"
            >
              {' '}
              SLA Compliance & Escalation Audit
            </h2>{' '}
            <div className="kpi-grid admin-u-gap-lg">
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
              className="admin-report-h2"
            >
              {' '}
              Citizen Satisfaction & Quality Audit
            </h2>{' '}
            <div className="kpi-grid admin-u-gap-lg">
              {' '}
              <div className="kpi-card">
                {' '}
                <div className="kpi-card__label">City Average</div>{' '}
                <div className="kpi-card__value admin-u-warning">
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
        <div className="admin-report-foot">
          {' '}
          <span>JAN-SEVA Governance System · Official Administrative Use</span>{' '}
          <span>Single Source of Truth: Gwalior Civic Repository</span>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
