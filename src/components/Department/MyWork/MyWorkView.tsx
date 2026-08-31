// ============================================================
// My work — the field officer's day
// ============================================================
// A field officer's screen is a phone held in one hand at a work site.
// The questions are: what is on me today, where is it, how long have I
// got, and how do I log what I did. Everything else belongs elsewhere.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentDepartmentUser } from '../../../services/authService';
import { getMyWorkComplaints, subscribeToComplaints, startWorkOnComplaint } from '../../../services/complaintService';
import { computeSlaHealth } from '../../../services/slaService';
import { explainPriority } from '../../../services/aiService';
import { useComplaintMutation } from '../../../hooks/useComplaintMutation';
import { SkeletonQueue, LoadingAnnouncement } from '../../portal/Skeletons';
import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './MyWorkView.css';

function NavigateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

export function MyWorkView() {
  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [tasks, setTasks] = useState<Complaint[] | null>(null);
  const mutation = useComplaintMutation();

  const load = useCallback(() => {
    if (!user) return;
    setTasks(getMyWorkComplaints(user.departmentId, user.staffId, user.name));
  }, [user]);

  useEffect(() => {
    load();
    return subscribeToComplaints(load);
  }, [load]);

  /* Ordering is the whole value of this screen: a breached job outranks a
     high-priority one that still has a day left. */
  const ordered = useMemo(() => {
    if (!tasks) return [];
    const now = Date.now();

    return [...tasks].sort((a, b) => {
      const weight = (c: Complaint) => {
        const health = computeSlaHealth(c, now);
        let w = c.aiAnalysis?.priorityScore ?? 50;
        if (health?.status === 'exceeded') w += 200;
        else if (health?.status === 'approaching') w += 80;
        if (c.feedback?.reinspectionRequested) w += 60;
        return w;
      };
      return weight(b) - weight(a);
    });
  }, [tasks]);

  if (!user) return null;

  if (tasks === null) {
    return (
      <div className="dept-page dept-page--narrow">
        <LoadingAnnouncement label="your tasks" />
        <SkeletonQueue rows={3} />
      </div>
    );
  }

  const handleStartTask = (id: string, version: number | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void mutation.run(id, () => startWorkOnComplaint(id, version), {
      successMessage: 'Marked as on-site work in progress.',
    });
  };

  const initials = user.name
    .replace(/^(Er\.|Dr\.)\s*/, '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const breachedCount = ordered.filter(
    (t) => computeSlaHealth(t)?.status === 'exceeded'
  ).length;

  return (
    <div className="dept-page dept-page--narrow">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">My work</h1>
          <p className="dept-page-desc">
            Site visits, repair logs and resolution evidence assigned to you.
          </p>
        </div>
      </div>

      <div className="dept-mywork-banner">
        <span className="dept-mywork-avatar" aria-hidden="true">{initials}</span>
        <span className="dept-mywork-who">
          <span className="dept-mywork-name">{user.name}</span>
          <span className="dept-mywork-role">{user.designation} &middot; {user.division}</span>
        </span>
        <span className="dept-mywork-count">
          <strong>{ordered.length}</strong>
          <span>{ordered.length === 1 ? 'open task' : 'open tasks'}</span>
        </span>
      </div>

      {breachedCount > 0 && (
        <p className="dept-alert dept-alert--error" role="status">
          <span>
            {breachedCount} of your {breachedCount === 1 ? 'tasks is' : 'tasks are'} past the
            SLA deadline. These are at the top of the list.
          </span>
        </p>
      )}

      {ordered.length === 0 ? (
        <div className="dept-state dept-state--ok">
          <span className="dept-state__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h2 className="dept-state__title">You&rsquo;re all caught up</h2>
          <p className="dept-state__desc">
            Nothing is assigned to you right now. New tasks appear here as soon as your nodal
            officer assigns them.
          </p>
        </div>
      ) : (
        <ul className="dept-mywork-list">
          {ordered.map((task) => {
            const health = computeSlaHealth(task);
            const priority = explainPriority(task);
            const notStarted = task.status !== 'in-progress';
            const busy = mutation.pendingAction === task.id;
            const mapsHref = `https://www.google.com/maps/search/?api=1&query=${task.location.latitude},${task.location.longitude}`;

            const slaLabel =
              health?.status === 'exceeded'
                ? `Breached · over by ${health.label}`
                : health?.status === 'approaching'
                ? `At risk · ${health.label} left`
                : health
                ? `On track · ${health.label} left`
                : 'No deadline set';

            return (
              <li key={task.id}>
                <article className={`dept-mywork-card dept-mywork-card--${priority.level}`}>
                  <Link to={`/department/complaints/${task.id}`} className="dept-mywork-card__link">
                    <span className="dept-mywork-card__top">
                      <span className="dept-mywork-card__id">{task.id}</span>
                      <span className={`dept-status-pill dept-status-pill--${task.status}`}>
                        {task.status.replace('-', ' ')}
                      </span>
                    </span>

                    <span className="dept-mywork-card__title">{task.issue.title}</span>

                    <span className="dept-mywork-card__place">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {task.location.address || task.location.locality}, {task.location.city}
                    </span>

                    <span className="dept-mywork-card__meta">
                      <span className={`dept-mywork-card__sla dept-mywork-card__sla--${health?.status ?? 'normal'}`}>
                        {slaLabel}
                      </span>
                      {(priority.level === 'critical' || priority.level === 'high') && (
                        <span className={`dept-priority-tag dept-priority-tag--${priority.level}`}>
                          {priority.level}
                        </span>
                      )}
                    </span>
                  </Link>

                  {/* Actions sit outside the link so a thumb can reach
                      them without opening the task first. */}
                  <div className="dept-mywork-card__actions">
                    <Link
                      to={`/department/complaints/${task.id}`}
                      className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm"
                    >
                      Open task
                    </Link>

                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dept-action-btn dept-action-btn--ghost dept-action-btn--sm"
                    >
                      <NavigateIcon />
                      <span>Navigate</span>
                    </a>

                    {notStarted && (
                      <button
                        type="button"
                        className="dept-action-btn dept-action-btn--primary dept-action-btn--sm"
                        onClick={(e) => handleStartTask(task.id, task.version, e)}
                        disabled={mutation.isBusy}
                      >
                        {busy ? 'Updating…' : 'Start work'}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
