// ============================================================
// Admin — one department, in detail
// ============================================================
// Answers three questions in order: how is it doing, why, and what would
// help. The recommendations are advisory — an administrator decides.

import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDepartmentDetail } from '../../../services/adminService';
import { computeSlaHealth } from '../../../services/slaService';
import { useLiveData } from '../../../hooks/useLiveData';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { formatRelative } from '../../../services/timeService';
import type { DepartmentId } from '../../../types/department';
import './DepartmentViews.css';
import '../Complaints/AdminComplaints.css';
import { AdminIcon } from '../AdminIcon';

export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deptId = (id as DepartmentId) || 'roads';

  const detail = useLiveData(useCallback(() => getDepartmentDetail(deptId), [deptId]));

  if (!detail) {
    return (
      <div className="admin-empty-state">
        <h2>Department not found</h2>
        <Link to="/admin/departments" className="admin-detail__back">
          &larr; Back to departments
        </Link>
      </div>
    );
  }

  const { config, metrics, score, ranking, complaints, whyAttention, recommendations } = detail;
  const noData = score.tier === 'no-data';

  return (
    <div className="admin-dept-detail">
      <Link to="/admin/departments" className="admin-detail__back">
        &larr; Back to all departments
      </Link>

      {/* ---------- Hero ---------- */}
      <div className="admin-dept-hero">
        <div>
          <span className="admin-dept-hero__eyebrow">Department drill-down</span>
          <h1 className="admin-dept-hero__title">{config.name}</h1>
          <p className="admin-dept-hero__sub">
            {config.hindiName} &middot; Helpline {config.helpline} &middot; Gwalior Municipal
            Corporation
          </p>
        </div>

        <div className="admin-dept-hero__score-badge">
          <div className="admin-dept-hero__score-label">Department score</div>
          <div className="admin-dept-hero__score-val">{noData ? '—' : score.totalScore}</div>
          <span className={`dept-perf-card__tier dept-perf-card__tier--${score.tier}`}>
            {score.tierBadge}
          </span>
        </div>
      </div>

      {/* ---------- Why ---------- */}
      {whyAttention.length > 0 && (
        <div className="admin-attention-box">
          <div className="admin-attention-box__title">
            <AdminIcon name="alert" size={15} /> Why this department needs attention
          </div>
          <ul>
            {whyAttention.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- What would help ---------- */}
      {recommendations.length > 0 && (
        <div className="admin-recommend-box">
          <div className="admin-recommend-box__title">
            <AdminIcon name="note" size={15} /> Suggested next steps
          </div>
          <ul>
            {recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
          <p className="admin-recommend-box__note">
            Advisory only, derived from the figures above. Operational decisions stay with the
            department.
          </p>
        </div>
      )}

      {ranking && ranking.recognitions.length > 0 && (
        <div className="admin-recognition-box">
          <div className="admin-recognition-box__title">
            <AdminIcon name="star" size={15} /> Strengths
          </div>
          <ul>
            {ranking.recognitions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Figures ---------- */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card__label">Total received</div>
          <div className="kpi-card__value">{metrics.totalReceived}</div>
          <div className="kpi-card__sub">Complaints filed</div>
        </div>

        <div className="kpi-card kpi-card--green">
          <div className="kpi-card__label">Resolved</div>
          <div className="kpi-card__value">{metrics.resolved}</div>
          <div className="kpi-card__sub">
            {metrics.totalReceived > 0 ? `${metrics.resolutionRatePercent}% resolution rate` : 'No complaints yet'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">SLA compliance</div>
          <div className="kpi-card__value">
            {score.components.slaCompliance.hasData ? `${metrics.slaCompliancePercent}%` : '—'}
          </div>
          <div className="kpi-card__sub">
            {score.components.slaCompliance.hasData ? 'Target above 85%' : 'No settled deadlines yet'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">Average turnaround</div>
          <div className="kpi-card__value">
            {metrics.resolved > 0 ? `${metrics.averageResolutionHours}h` : '—'}
          </div>
          <div className="kpi-card__sub">
            {metrics.resolved > 0 ? 'From report to resolution' : 'Nothing resolved yet'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card__label">Citizen rating</div>
          <div className="kpi-card__value">
            {metrics.totalRatingsCount > 0 ? `${metrics.citizenSatisfactionAverage} / 5` : '—'}
          </div>
          <div className="kpi-card__sub">
            {metrics.totalRatingsCount > 0
              ? `${metrics.totalRatingsCount} rating${metrics.totalRatingsCount === 1 ? '' : 's'}`
              : 'No ratings yet'}
          </div>
        </div>

        <div className="kpi-card kpi-card--red">
          <div className="kpi-card__label">Escalated</div>
          <div className="kpi-card__value">{metrics.escalated}</div>
          <div className="kpi-card__sub">Currently open</div>
        </div>
      </div>

      {/* ---------- Staff ---------- */}
      <div className="admin-panel">
        <div className="admin-panel__title">Officers and field units</div>

        <div className="admin-staff-grid">
          {config.mockStaff.map((staff) => (
            <div key={staff.id} className="admin-staff-card">
              <div className="admin-staff-card__name">{staff.name}</div>
              <div className="admin-staff-card__role">{staff.roleTitle}</div>
              <div className="admin-staff-card__desig">{staff.designation}</div>
              <div className="admin-staff-card__contact">{staff.phone}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Complaints ---------- */}
      <div className="admin-panel">
        <div className="admin-panel__title-row">
          <span className="admin-panel__title">
            {config.shortName} complaints ({complaints.length})
          </span>
          <Link to={`/admin/complaints?department=${config.id}`} className="admin-panel__link">
            Open in the grievance monitor &rarr;
          </Link>
        </div>

        {complaints.length === 0 ? (
          <p className="admin-panel__empty">No complaints are routed to this department yet.</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-complaints-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Issue</th>
                  <th>Locality</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => {
                  const health = computeSlaHealth(c);
                  const isBreached = health?.status === 'exceeded';

                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/complaints/${c.id}`} className="admin-complaint-id-link">
                          {c.id}
                        </Link>
                      </td>
                      <td>{c.issue.title}</td>
                      <td>{c.location.locality}</td>
                      <td>
                        <StatusPill status={c.status} />
                      </td>
                      <td>
                        <span
                          className={`admin-sla-flag${isBreached ? ' admin-sla-flag--breached' : ''}`}
                        >
                          {isBreached ? 'Breached' : health?.status === 'approaching' ? 'At risk' : 'On track'}
                        </span>
                      </td>
                      <td className="admin-cell-muted">{formatRelative(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
