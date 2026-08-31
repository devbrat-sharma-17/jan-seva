// ============================================================
// Admin Performance Analytics — JAN-SEVA Phase 5
// ============================================================

import { useCallback, useState, useMemo } from 'react';
import { getTrendData, getAllDepartmentRankings } from '../../../services/adminService';
import { useLiveData } from '../../../hooks/useLiveData';
import type { TrendPeriod } from '../../../types/admin';
import './AdminPerformance.css';

export function AdminPerformance() {
  const [period, setPeriod] = useState<TrendPeriod>('7d');

  // Both re-derive when a department writes; `useMemo(..., [])` left the
  // standings frozen at whatever they were when the page mounted.
  const trendSeries = useLiveData(useCallback(() => getTrendData(period), [period]));
  const rankings = useLiveData(useCallback(() => getAllDepartmentRankings(), []));

  const receivedSeries = trendSeries.find((s) => s.id === 'received');
  const resolvedSeries = trendSeries.find((s) => s.id === 'resolved');

  const maxBarValue = useMemo(() => {
    let max = 1;
    trendSeries.forEach((s) => {
      s.data.forEach((p) => {
        if (p.value > max) max = p.value;
      });
    });
    return max + 1;
  }, [trendSeries]);

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>City Operations Performance Trends</h1>{' '}
          <p>
            Longitudinal analytics across grievance influx, resolution velocity, and department SLAs
          </p>{' '}
        </div>{' '}
        {/* Time Period Selector */}
        <div className="admin-u-row-tight">
          {' '}
          {(['7d', '30d', '90d'] as TrendPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`admin-filter-reset-btn ${period === p ? 'admin-filter-select' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {' '}
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last Quarter (90d)'}
            </button>
          ))}
        </div>{' '}
      </div>{' '}
      {/* Grid of Analytics Charts */}
      <div className="admin-perf-charts-grid">
        {' '}
        {/* Chart 1: Grievance Influx vs Resolution */}
        <div className="admin-chart-panel">
          {' '}
          <div className="admin-chart-header">
            {' '}
            <h3 className="admin-chart-title">Complaint Influx vs. Resolutions</h3>{' '}
            <div className="admin-chart-legend">
              {' '}
              <div className="admin-chart-legend-item">
                {' '}
                <span className="admin-chart-legend-dot admin-swatch--received" />{' '}
                <span>Received</span>{' '}
              </div>{' '}
              <div className="admin-chart-legend-item">
                {' '}
                <span className="admin-chart-legend-dot admin-swatch--resolved" />{' '}
                <span>Resolved</span>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          <div className="admin-chart-box">
            {' '}
            <div className="admin-chart-bars-container">
              {' '}
              {receivedSeries?.data.map((item, idx) => {
                const resItem = resolvedSeries?.data[idx];
                const recHeight = Math.max(8, (item.value / maxBarValue) * 100);
                const resHeight = Math.max(8, ((resItem?.value || 0) / maxBarValue) * 100);

                return (
                  <div key={idx} className="admin-chart-bar-group">
                    {' '}
                    <div className="admin-chart-bars-pair">
                      {' '}
                      <div
                        className="admin-bar-fill admin-bar-fill--received"
                        style={{ height: `${recHeight}%` }}
                        title={`${item.label}: ${item.value} received`}
                      />{' '}
                      <div
                        className="admin-bar-fill admin-bar-fill--resolved"
                        style={{ height: `${resHeight}%` }}
                        title={`${item.label}: ${resItem?.value || 0} resolved`}
                      />{' '}
                    </div>{' '}
                    <div className="admin-chart-bar-label">{item.label}</div>{' '}
                  </div>
                );
              })}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Chart 2: Department SLA Compliance Comparison */}
        <div className="admin-chart-panel">
          {' '}
          <div className="admin-chart-header">
            {' '}
            <h3 className="admin-chart-title">Department SLA Compliance vs 90% Benchmark</h3>{' '}
          </div>{' '}
          <div className="admin-u-stack">
            {' '}
            {rankings.map((dept) => (
              <div key={dept.departmentId}>
                {' '}
                <div
                  className="admin-sla-bar__head"
                >
                  {' '}
                  <span className="admin-u-strong">{dept.shortName}</span>{' '}
                  <span
                    className={
                      dept.slaCompliance >= 90 ? 'admin-u-good' : 'admin-u-warning'
                    }
                  >
                    {' '}
                    {dept.slaCompliance}%
                  </span>{' '}
                </div>{' '}
                <div
                  className="admin-sla-bar__track"
                >
                  {' '}
                  <div
                    className={`admin-sla-bar__fill${
                      dept.slaCompliance >= 90 ? ' is-met' : ' is-short'
                    }`}
                    style={{ width: `${dept.slaCompliance}%` }}
                  />{' '}
                  {/* 90% benchmark indicator */}
                  <div
                    className="admin-sla-bar__benchmark"
                    title="90% target benchmark"
                  />{' '}
                </div>{' '}
              </div>
            ))}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Summary Scorecard Table */}
      <div className="admin-panel">
        {' '}
        <div className="admin-panel__title">Efficiency scorecard</div>{' '}
        <div className="admin-table-container">
          {' '}
          <table className="admin-complaints-table">
            {' '}
            <thead>
              {' '}
              <tr>
                {' '}
                <th>Department</th> <th>Overall Score</th> <th>Avg Resolution Time</th>{' '}
                <th>SLA Compliance</th> <th>Citizen Rating</th> <th>Backlog Count</th>{' '}
              </tr>{' '}
            </thead>{' '}
            <tbody>
              {' '}
              {rankings.map((r) => (
                <tr key={r.departmentId}>
                  {' '}
                  <td>
                    {' '}
                    <strong>{r.departmentName}</strong>{' '}
                  </td>{' '}
                  <td>
                    {' '}
                    <span className={`dept-perf-card__tier dept-perf-card__tier--${r.tier}`}>
                      {' '}
                      {r.performanceScore} / 100
                    </span>{' '}
                  </td>{' '}
                  <td>{r.averageResolutionHours} hours</td> <td>{r.slaCompliance}%</td>{' '}
                  <td>{r.citizenSatisfaction > 0 ? `${r.citizenSatisfaction} ★` : '—'}</td>{' '}
                  <td>{r.backlogCount} active</td>{' '}
                </tr>
              ))}
            </tbody>{' '}
          </table>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
