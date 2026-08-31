import { useEffect, useMemo, useState } from 'react';
import { getCurrentDepartmentUser } from '../../../services/authService';

import { getDepartmentConfig, getAllDepartments } from '../../../data/departments';
import { getDepartmentMetrics, subscribeToComplaints } from '../../../services/complaintService';
import { calculatePerformanceScore } from '../../../services/performanceService';
import type { DepartmentMetrics, DepartmentUser, PerformanceScoreBreakdown } from '../../../types/department';
import './DepartmentPerformance.css';

export function DepartmentPerformance() {
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [metrics, setMetrics] = useState<DepartmentMetrics | null>(null);
  const [scorecard, setScorecard] = useState<PerformanceScoreBreakdown | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const m = getDepartmentMetrics(user.departmentId);
      setMetrics(m);
      setScorecard(calculatePerformanceScore(m));
      setTick((t) => t + 1);
    };
    load();
    const unsubscribe = subscribeToComplaints(load);
    return () => unsubscribe();
  }, [user?.departmentId]);

  const isHead = user?.role === 'head';

  // Ranked, not just listed — a benchmark that is not ordered by score
  // makes the reader do the comparison themselves.
  const benchmark = useMemo(() => {
    if (!isHead) return [];
    return getAllDepartments()
      .map((dept) => {
        const m = getDepartmentMetrics(dept.id);
        return { dept, metrics: m, score: calculatePerformanceScore(m).totalScore };
      })
      .sort((a, b) => b.score - a.score);
    // `tick` re-runs this whenever the complaint store changes.
  }, [isHead, tick]);

  if (!user || !metrics || !scorecard) {
    return <div className="dept-loading">Calculating performance</div>;
  }

  const deptConfig = getDepartmentConfig(user.departmentId);

  return (
    <div className="dept-page dept-page--narrow">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">Performance</h1>
          <p className="dept-page-desc">
            Scored on resolution rate, SLA compliance, turnaround speed, citizen satisfaction,
            backlog and escalations.
          </p>
        </div>
      </div>

      <section className="dept-score">
        <div className="dept-score__figure">
          <span className="dept-score__value">{scorecard.totalScore}</span>
          <span className="dept-score__max">/ 100</span>
        </div>

        <div className="dept-score__meta">
          <span className={`dept-score__tier dept-score__tier--${scorecard.tier}`}>
            {scorecard.tierBadge}
          </span>
          <p className="dept-score__dept">{deptConfig.name}</p>
        </div>

        <dl className="dept-score__stats">
          <div>
            <dt>Resolved</dt>
            <dd>{metrics.resolved}</dd>
          </div>
          <div>
            <dt>Citizen verified</dt>
            <dd>{metrics.citizenVerified}</dd>
          </div>
          <div>
            <dt>Backlog</dt>
            <dd>{metrics.backlogCount}</dd>
          </div>
        </dl>
      </section>

      <div className="dept-breakdown">
        {Object.entries(scorecard.components).map(([key, item]) => {
          const pct = Math.round((item.score / item.max) * 100);
          return (
            <div key={key} className="dept-breakdown__card">
              <div className="dept-breakdown__top">
                <span className="dept-breakdown__label">{item.label}</span>
                <span className="dept-breakdown__value">{item.value}</span>
              </div>

              <div
                className="dept-breakdown__bar"
                role="progressbar"
                aria-valuenow={item.score}
                aria-valuemin={0}
                aria-valuemax={item.max}
                aria-label={item.label}
              >
                <span
                  className={`dept-breakdown__fill${pct < 50 ? ' is-low' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className="dept-breakdown__pts">
                {item.score} of {item.max} points
              </span>
            </div>
          );
        })}
      </div>

      {isHead && (
        <section className="dept-card">
          <h2 className="dept-card__title">Across Gwalior departments</h2>

          <ol className="dept-benchmark">
            {benchmark.map((row, i) => {
              const isCurrent = row.dept.id === user.departmentId;
              return (
                <li
                  key={row.dept.id}
                  className={`dept-benchmark__row${isCurrent ? ' is-current' : ''}`}
                >
                  <span className="dept-benchmark__rank">{i + 1}</span>
                  <span className="dept-benchmark__text">
                    <span className="dept-benchmark__name">{row.dept.name}</span>
                    <span className="dept-benchmark__sub">
                      {row.metrics.resolved} resolved &middot; {row.metrics.backlogCount} active
                    </span>
                  </span>
                  <span className="dept-benchmark__score">
                    {row.score}
                    <span>/ 100</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
