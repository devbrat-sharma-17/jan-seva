// ============================================================
// Admin Department Detail View — JAN-SEVA Phase 5
// ============================================================

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDepartmentDetail } from '../../../services/adminService';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { formatRelative } from '../../../services/timeService';
import type { DepartmentId } from '../../../types/department';
import './DepartmentViews.css';
import '../Complaints/AdminComplaints.css';
import { AdminIcon } from '../AdminIcon';

export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deptId = (id as DepartmentId) || 'roads';

  const detail = useMemo(() => {
    return getDepartmentDetail(deptId);
  }, [deptId]);

  if (!detail) {
    return (
      <div className="admin-empty-state">
        {' '}
        <h2>Department Not Found</h2>{' '}
        <Link to="/admin/departments" className="admin-detail__back">
          {' '}
          ← Back to Departments
        </Link>{' '}
      </div>
    );
  }

  const { config, metrics, score, ranking, complaints, whyAttention } = detail;

  return (
    <div className="admin-dept-detail">
      {' '}
      <Link to="/admin/departments" className="admin-detail__back">
        {' '}
        ← Back to All Departments
      </Link>{' '}
      {/* Hero Header */}
      <div className="admin-dept-hero">
        {' '}
        <div>
          {' '}
          <span
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--slate-400)',
            }}
          >
            {' '}
            Municipal Operations Drill-down
          </span>{' '}
          <h1 className="admin-dept-hero__title">{config.name}</h1>{' '}
          <p className="admin-dept-hero__sub">
            {' '}
            {config.hindiName} · Helpline: {config.helpline} · Division: Gwalior Municipal
            Corporation
          </p>{' '}
        </div>{' '}
        <div className="admin-dept-hero__score-badge">
          {' '}
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: 'var(--slate-400)',
              marginBottom: '4px',
            }}
          >
            {' '}
            Department Score
          </div>{' '}
          <div className="admin-dept-hero__score-val">{score.totalScore}</div>{' '}
          <span className={`dept-perf-card__tier dept-perf-card__tier--${score.tier}`}>
            {' '}
            {score.tierBadge}
          </span>{' '}
        </div>{' '}
      </div>{' '}
      {/* Why Underperforming (if any issues exist) */}
      {whyAttention.length > 0 && (
        <div className="admin-attention-box">
          {' '}
          <div className="admin-attention-box__title">
            {' '}
            <AdminIcon name="alert" size={15} /> Areas needing attention
          </div>{' '}
          <ul>
            {' '}
            {whyAttention.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>{' '}
        </div>
      )}
      {/* Recognitions */}
      {ranking && ranking.recognitions.length > 0 && (
        <div className="admin-recognition-box">
          {' '}
          <div className="admin-recognition-box__title">
            {' '}
            <AdminIcon name="star" size={15} /> Strengths
          </div>{' '}
          <ul>
            {' '}
            {ranking.recognitions.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>{' '}
        </div>
      )}
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {' '}
        <div className="kpi-card">
          {' '}
          <div className="kpi-card__label">Total Received</div>{' '}
          <div className="kpi-card__value">{metrics.totalReceived}</div>{' '}
          <div className="kpi-card__sub">Complaints filed</div>{' '}
        </div>{' '}
        <div className="kpi-card kpi-card--green">
          {' '}
          <div className="kpi-card__label">Resolved</div>{' '}
          <div className="kpi-card__value">{metrics.resolved}</div>{' '}
          <div className="kpi-card__sub">{metrics.resolutionRatePercent}% resolution rate</div>{' '}
        </div>{' '}
        <div className="kpi-card">
          {' '}
          <div className="kpi-card__label">SLA Compliance</div>{' '}
          <div className="kpi-card__value">{metrics.slaCompliancePercent}%</div>{' '}
          <div className="kpi-card__sub">Target: &gt;90%</div>{' '}
        </div>{' '}
        <div className="kpi-card">
          {' '}
          <div className="kpi-card__label">Avg Turnaround</div>{' '}
          <div className="kpi-card__value">{metrics.averageResolutionHours}h</div>{' '}
          <div className="kpi-card__sub">Resolution speed</div>{' '}
        </div>{' '}
        <div className="kpi-card">
          {' '}
          <div className="kpi-card__label">Citizen Rating</div>{' '}
          <div className="kpi-card__value">
            {' '}
            {metrics.citizenSatisfactionAverage > 0
              ? `${metrics.citizenSatisfactionAverage}★`
              : '—'}
          </div>{' '}
          <div className="kpi-card__sub">From verified citizens</div>{' '}
        </div>{' '}
        <div className="kpi-card kpi-card--red">
          {' '}
          <div className="kpi-card__label">Escalated / Breached</div>{' '}
          <div className="kpi-card__value">{metrics.escalated}</div>{' '}
          <div className="kpi-card__sub">Active escalations</div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Assigned Staff & Teams */}
      <div className="admin-panel">
        {' '}
        <div className="admin-panel__title">Officers and field units</div>{' '}
        <div
          className="dept-perf-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          {' '}
          {config.mockStaff.map((staff) => (
            <div
              key={staff.id}
              style={{
                background: 'var(--color-bg)',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--color-border)',
              }}
            >
              {' '}
              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{staff.name}</div>{' '}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-civic-blue-dark)', fontWeight: 600 }}>
                {staff.roleTitle}
              </div>{' '}
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {staff.designation}
              </div>{' '}
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                {' '}
                {staff.phone}
              </div>{' '}
            </div>
          ))}
        </div>{' '}
      </div>{' '}
      {/* Complaints for this Department */}
      <div className="admin-panel">
        {' '}
        <div
          className="admin-panel__title"
          style={{ display: 'flex', justifyContent: 'space-between' }}
        >
          {' '}
          <span>
            {' '}
            {config.shortName} Complaints ({complaints.length})
          </span>{' '}
          <Link
            to={`/admin/complaints?department=${config.id}`}
            style={{ fontSize: '0.75rem', color: 'var(--color-civic-blue-dark)', textTransform: 'none' }}
          >
            {' '}
            View in Grievance Monitor →
          </Link>{' '}
        </div>{' '}
        <div className="admin-table-container">
          {' '}
          <table className="admin-complaints-table">
            {' '}
            <thead>
              {' '}
              <tr>
                {' '}
                <th>ID</th> <th>Issue</th> <th>Locality</th> <th>Status</th> <th>SLA Due</th>{' '}
                <th>Reported</th>{' '}
              </tr>{' '}
            </thead>{' '}
            <tbody>
              {' '}
              {complaints.map((c) => {
                const isBreached =
                  c.sla.status === 'exceeded' || new Date(c.sla.dueAt).getTime() < Date.now();
                return (
                  <tr key={c.id}>
                    {' '}
                    <td>
                      {' '}
                      <Link to={`/admin/complaints/${c.id}`} className="admin-complaint-id-link">
                        {' '}
                        {c.id}
                      </Link>{' '}
                    </td>{' '}
                    <td>{c.issue.title}</td> <td> {c.location.locality}</td>{' '}
                    <td>
                      {' '}
                      <StatusPill status={c.status} />{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span
                        style={{
                          color: isBreached ? 'var(--red-600)' : 'var(--green-500)',
                          fontWeight: isBreached ? 700 : 400,
                        }}
                      >
                        {' '}
                        {isBreached ? 'Breached' : 'On track'}
                      </span>{' '}
                    </td>{' '}
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatRelative(c.createdAt)}</td>{' '}
                  </tr>
                );
              })}
            </tbody>{' '}
          </table>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
