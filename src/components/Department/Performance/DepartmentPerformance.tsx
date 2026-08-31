// ============================================================
// Department performance
// ============================================================
// The score is the headline, but the breakdown is the point: a number
// nobody can take apart is a number nobody can act on. The recognition
// badge is deliberately quieter than the six metrics beneath it.

import { useCallback, useEffect, useState } from 'react';
import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import {
  getDepartmentMetrics,
  getDepartmentRank,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { calculatePerformanceScore } from '../../../services/performanceService';
import { SkeletonCard, LoadingAnnouncement } from '../../portal/Skeletons';
import type {
  DepartmentMetrics,
  DepartmentUser,
  PerformanceScoreBreakdown,
} from '../../../types/department';
import './DepartmentPerformance.css';

interface PerfData {
  metrics: DepartmentMetrics;
  scorecard: PerformanceScoreBreakdown;
  rank: { rank: number; total: number } | null;
}

export function DepartmentPerformance() {
  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [data, setData] = useState<PerfData | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    const metrics = getDepartmentMetrics(user.departmentId);
    setData({
      metrics,
      scorecard: calculatePerformanceScore(metrics),
      rank: getDepartmentRank(user.departmentId),
    });
  }, [user]);

  useEffect(() => {
    load();
    return subscribeToComplaints(load);
  }, [load]);

  if (!user) return null;

  if (!data) {
    return (
      <div className="dept-page dept-page--narrow">
        <LoadingAnnouncement label="performance" />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  const { metrics, scorecard, rank } = data;
  const deptConfig = getDepartmentConfig(user.departmentId);
  const noData = scorecard.tier === 'no-data';

  return (
    <div className="dept-page dept-page--narrow">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">Performance</h1>
          <p className="dept-page-desc">
            Calculated from this department&rsquo;s own complaint records — resolution, SLA,
            turnaround, citizen ratings, backlog and escalations.
          </p>
        </div>

        <span className="demo-tag">Demo data</span>
      </div>

      <section className="dept-score">
        <div className="dept-score__figure">
          <span className="dept-score__value">{noData ? '—' : scorecard.totalScore}</span>
          <span className="dept-score__max">/ 100</span>
        </div>

        <div className="dept-score__meta">
          <span className={`dept-score__tier dept-score__tier--${scorecard.tier}`}>
            {scorecard.tierBadge}
          </span>
          <p className="dept-score__dept">{deptConfig.name}</p>

          {/* Position only. The other departments' figures are the
              Command Centre's to show, not this portal's. */}
          {rank && (
            <p className="dept-score__rank">
              Ranked {rank.rank} of {rank.total} departments in Gwalior
            </p>
          )}
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

      {scorecard.dataCoverage < 100 && !noData && (
        <p className="dept-alert dept-alert--info" role="note">
          <span>
            Scored over the {scorecard.dataCoverage} of 100 points that have data behind them.
            Dimensions with nothing to measure are excluded rather than assumed.
          </span>
        </p>
      )}

      <div className="dept-breakdown">
        {Object.entries(scorecard.components).map(([key, item]) => {
          const pct = item.hasData ? Math.round((item.score / item.max) * 100) : 0;

          return (
            <div
              key={key}
              className={`dept-breakdown__card${item.hasData ? '' : ' dept-breakdown__card--nodata'}`}
            >
              <div className="dept-breakdown__top">
                <span className="dept-breakdown__label">{item.label}</span>
                <span className="dept-breakdown__value">{item.value}</span>
              </div>

              {item.hasData ? (
                <>
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
                </>
              ) : (
                <span className="dept-breakdown__pts">Not scored — no data yet</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Satisfaction and verification move only when a citizen acts.
          Saying so here stops the resolution count being read as
          approval. */}
      <p className="dept-card__hint dept-perf-note">
        Citizen satisfaction and verification change only when a citizen responds on their tracking
        page — submitting a resolution does not move them.
      </p>
    </div>
  );
}
