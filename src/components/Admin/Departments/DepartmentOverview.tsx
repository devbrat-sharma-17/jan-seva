// ============================================================
// Admin — department standings and comparison
// ============================================================

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllDepartmentRankings } from '../../../services/adminService';
import { useLiveData } from '../../../hooks/useLiveData';
import { AdminIcon } from '../AdminIcon';
import './DepartmentViews.css';

type SortKey = 'score' | 'sla' | 'resolution' | 'satisfaction' | 'backlog';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'score', label: 'Performance score' },
  { value: 'sla', label: 'SLA compliance' },
  { value: 'resolution', label: 'Resolution rate' },
  { value: 'satisfaction', label: 'Citizen rating' },
  { value: 'backlog', label: 'Smallest backlog' },
];

export function DepartmentOverview() {
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const rankings = useLiveData(useCallback(() => getAllDepartmentRankings(sortBy), [sortBy]));

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Departments</h1>
          <p className="admin-page-desc">
            All five municipal departments in Gwalior, ranked on the measure you choose.
          </p>
        </div>

        <div className="admin-sort">
          <label htmlFor="dept-sort">Rank by</label>
          <select
            id="dept-sort"
            className="admin-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Cards ----
           Four metrics, not six, and at most two notes. The card answers
           "how is this department doing and why"; the table below is where
           side-by-side comparison happens, so the card need not repeat it. */}
      <div className="dept-perf-grid">
        {rankings.map((dept) => (
          <Link
            key={dept.departmentId}
            to={`/admin/departments/${dept.departmentId}`}
            className="dept-perf-card"
          >
            <div className="dept-perf-card__header">
              <span className="dept-perf-card__rank">{dept.rank}</span>
              <span className="dept-perf-card__name">{dept.shortName}</span>
              <span className={`dept-perf-card__tier dept-perf-card__tier--${dept.tier}`}>
                {dept.tierBadge}
              </span>
            </div>

            <div className="dept-perf-card__score">
              {dept.performanceScore}
              <span className="dept-perf-card__score-max">/ 100</span>
            </div>

            <div className="dept-perf-card__metrics">
              <div className="dept-perf-card__metric">
                <span className="dept-perf-card__metric-label">Resolved</span>
                <span className="dept-perf-card__metric-value">{dept.resolutionRate}%</span>
              </div>
              <div className="dept-perf-card__metric">
                <span className="dept-perf-card__metric-label">On time</span>
                <span className="dept-perf-card__metric-value">{dept.slaCompliance}%</span>
              </div>
              <div className="dept-perf-card__metric">
                <span className="dept-perf-card__metric-label">Backlog</span>
                <span className="dept-perf-card__metric-value">{dept.backlogCount}</span>
              </div>
              <div className="dept-perf-card__metric">
                <span className="dept-perf-card__metric-label">Escalated</span>
                <span
                  className={`dept-perf-card__metric-value${dept.escalations > 0 ? ' is-bad' : ''}`}
                >
                  {dept.escalations}
                </span>
              </div>
            </div>

            <div className="dept-perf-card__reasons">
              {dept.recognitions.slice(0, 1).map((r, i) => (
                <span key={`r${i}`} className="dept-perf-card__reason dept-perf-card__reason--positive">
                  {r}
                </span>
              ))}
              {dept.reasons.slice(0, 2).map((r, i) => (
                <span key={`w${i}`} className="dept-perf-card__reason">
                  {r}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* ---- Side-by-side comparison ---- */}
      <section className="admin-card admin-compare-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">
            <AdminIcon name="performance" size={16} />
            Side-by-side comparison
          </h2>
        </div>

        <div className="admin-table-container">
          <table className="admin-complaints-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Department</th>
                <th scope="col">Tier</th>
                <th scope="col">Score</th>
                <th scope="col">Resolved</th>
                <th scope="col">On time</th>
                <th scope="col">Avg time</th>
                <th scope="col">Rating</th>
                <th scope="col">Backlog</th>
                <th scope="col">Escalated</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => (
                <tr key={r.departmentId}>
                  <td>{r.rank}</td>
                  <td>
                    <Link to={`/admin/departments/${r.departmentId}`} className="admin-table-link">
                      {r.departmentName}
                    </Link>
                  </td>
                  <td>
                    <span className={`dept-perf-card__tier dept-perf-card__tier--${r.tier}`}>
                      {r.tierLabel}
                    </span>
                  </td>
                  <td>
                    <strong>{r.performanceScore}</strong>
                  </td>
                  <td>{r.resolutionRate}%</td>
                  <td>{r.slaCompliance}%</td>
                  <td>{r.averageResolutionHours}h</td>
                  <td>{r.citizenSatisfaction > 0 ? `${r.citizenSatisfaction}★` : '—'}</td>
                  <td>{r.backlogCount}</td>
                  <td className={r.escalations > 0 ? 'is-bad' : undefined}>{r.escalations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
