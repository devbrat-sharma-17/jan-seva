// ============================================================
// Admin Performance Analytics — JAN-SEVA Phase 5
// ============================================================

import { useState, useMemo } from 'react';
import { getTrendData, getAllDepartmentRankings } from '../../../services/adminService';
import type { TrendPeriod } from '../../../types/admin';
import './AdminPerformance.css';

export function AdminPerformance() {
  const [period, setPeriod] = useState<TrendPeriod>('7d');

  const trendSeries = useMemo(() => {
    return getTrendData(period);
  }, [period]);

  const rankings = useMemo(() => {
    return getAllDepartmentRankings();
  }, []);

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
        <div style={{ display: 'flex', gap: '0.375rem' }}>
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
                <span className="admin-chart-legend-dot" style={{ background: 'var(--color-civic-blue)' }} />{' '}
                <span>Received</span>{' '}
              </div>{' '}
              <div className="admin-chart-legend-item">
                {' '}
                <span className="admin-chart-legend-dot" style={{ background: 'var(--color-success)' }} />{' '}
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
                        className="admin-bar-fill"
                        style={{ height: `${recHeight}%`, background: 'var(--color-civic-blue)' }}
                        title={`${item.label}: ${item.value} received`}
                      />{' '}
                      <div
                        className="admin-bar-fill"
                        style={{ height: `${resHeight}%`, background: 'var(--color-success)' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {' '}
            {rankings.map((dept) => (
              <div key={dept.departmentId}>
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
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{dept.shortName}</span>{' '}
                  <span
                    style={{
                      fontWeight: 700,
                      color: dept.slaCompliance >= 90 ? 'var(--green-500)' : 'var(--amber-600)',
                    }}
                  >
                    {' '}
                    {dept.slaCompliance}%
                  </span>{' '}
                </div>{' '}
                <div
                  style={{
                    height: '8px',
                    background: 'var(--color-surface-sunken)',
                    borderRadius: '4px',
                    position: 'relative',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      height: '100%',
                      width: `${dept.slaCompliance}%`,
                      background: dept.slaCompliance >= 90 ? 'var(--green-500)' : 'var(--color-warning)',
                      borderRadius: '4px',
                    }}
                  />{' '}
                  {/* 90% benchmark indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '90%',
                      top: '-2px',
                      bottom: '-2px',
                      width: '2px',
                      background: 'var(--color-text)',
                      opacity: 0.3,
                    }}
                    title="90% Target Benchmark"
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
