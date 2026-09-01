// ============================================================
// Department dashboard
// ============================================================
// Reads top to bottom as a shift starts: who and where, then how the
// department is doing, then what needs a decision now, then the queue,
// then your own work. A field officer gets a different opening screen —
// their day is a task list, not a triage board.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import {
  getComplaintsByDepartment,
  getDepartmentMetrics,
  getDepartmentNeedsAttention,
  getMyWorkComplaints,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { formatRelative } from '../../../services/timeService';
import { KPICards } from './KPICards';
import { NeedsAttention } from './NeedsAttention';
import { PriorityQueue } from './PriorityQueue';
import { SkeletonKpiRow, SkeletonQueue, LoadingAnnouncement } from '../../portal/Skeletons';
import type { Complaint } from '../../../types';
import type { DepartmentMetrics, DepartmentUser } from '../../../types/department';
import './DepartmentDashboard.css';

interface DashboardData {
  complaints: Complaint[];
  metrics: DepartmentMetrics;
  attention: {
    breached: Complaint[];
    atRisk: Complaint[];
    unassigned: Complaint[];
    reinspection: Complaint[];
  };
  myTasks: Complaint[];
}

export function DepartmentDashboard() {
  const navigate = useNavigate();
  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setData({
      complaints: getComplaintsByDepartment(user.departmentId),
      metrics: getDepartmentMetrics(user.departmentId),
      attention: getDepartmentNeedsAttention(user.departmentId),
      myTasks: getMyWorkComplaints(user.departmentId, user.staffId, user.name),
    });
  }, [user]);

  /* One subscription, one recompute. Four separate effects each doing
     their own full pass over the store meant a single status change
     re-read and re-scanned it four times. */
  useEffect(() => {
    load();
    return subscribeToComplaints(load);
  }, [load]);

  const openCount = useMemo(
    () => data?.complaints.filter((c) => c.status !== 'resolved').length ?? 0,
    [data]
  );

  if (!user) return null;

  // A field officer's home is their task list. Sending them to a triage
  // board they cannot act on wastes the first screen of their shift.
  if (user.role === 'field') {
    return <Navigate to="/department/my-work" replace />;
  }

  const deptConfig = getDepartmentConfig(user.departmentId);

  if (!data) {
    return (
      <div className="dept-page">
        <LoadingAnnouncement label="the department dashboard" />
        <SkeletonKpiRow count={4} />
        <SkeletonQueue rows={4} />
      </div>
    );
  }

  const { metrics, attention, complaints, myTasks } = data;

  return (
    <div className="dept-page">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">{deptConfig.shortName} operations</h1>
          <p className="dept-page-desc">
            {openCount} open {openCount === 1 ? 'complaint' : 'complaints'} &middot; {user.division}
          </p>
        </div>

        <span className="dept-live-tag">
          <span className="dept-live-tag__dot" aria-hidden="true" />
          Live intake
        </span>
      </div>

      {/* ---- Health summary ---- */}
      <KPICards
        metrics={metrics}
        onFilterClick={(filterId) => {
          if (filterId === 'escalated') navigate('/department/escalations');
          else if (filterId === 'at-risk') navigate('/department/complaints?filter=at-risk');
          else if (filterId === 'high-priority') navigate('/department/complaints?filter=high-priority');
          else navigate('/department/complaints');
        }}
      />

      {/* ---- What needs a decision now ---- */}
      <NeedsAttention attentionData={attention} />

      {/* ---- The queue ---- */}
      <PriorityQueue
        complaints={complaints}
        title="Priority queue"
        subtitle="Ranked by SLA risk, assessed severity and independent report spread."
        showViewAll
      />

      {/* ---- Your own work. A nodal officer or head still carries
           complaints; this is the reminder that they do. ---- */}
      {myTasks.length > 0 && (
        <section className="dept-mine">
          <header className="dept-queue__head">
            <div className="dept-queue__head-text">
              <h2 className="dept-queue__title">Assigned to you</h2>
              <p className="dept-queue__subtitle">
                {myTasks.length} open {myTasks.length === 1 ? 'task' : 'tasks'} in your name.
              </p>
            </div>

            <Link
              to="/department/my-work"
              className="dept-action-btn dept-action-btn--ghost dept-action-btn--sm"
            >
              Open my work
            </Link>
          </header>

          <ul className="dept-mine__list">
            {myTasks.slice(0, 3).map((task) => (
              <li key={task.id}>
                <Link to={`/department/complaints/${task.id}`} className="dept-mine__row">
                  <span className="dept-mine__id">{task.id}</span>
                  <span className="dept-mine__title">{task.issue.title}</span>
                  <span className="dept-mine__when">{formatRelative(task.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
