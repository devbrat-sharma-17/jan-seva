import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentDepartmentUser } from '../../../services/authService';
import {
  getMyWorkComplaints,
  startWorkOnComplaint,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { formatRelative } from '../../../services/timeService';
import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './MyWorkView.css';

export function MyWorkView() {
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [tasks, setTasks] = useState<Complaint[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => setTasks(getMyWorkComplaints(user.departmentId, user.name));
    load();
    const unsubscribe = subscribeToComplaints(load);
    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return <div className="dept-loading">Loading tasks</div>;
  }

  const handleStartTask = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStarting(id);
    try {
      await startWorkOnComplaint(id, user.name);
    } finally {
      setStarting(null);
    }
  };

  const initials = user.name
    .replace(/^(Er\.|Dr\.)\s*/, '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="dept-page dept-page--narrow">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">My work</h1>
          <p className="dept-page-desc">
            Site inspections, repair logs and resolution evidence assigned to you.
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
          <strong>{tasks.length}</strong>
          <span>{tasks.length === 1 ? 'open task' : 'open tasks'}</span>
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="dept-state dept-state--ok">
          <span className="dept-state__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <h2 className="dept-state__title">Nothing on your list</h2>
          <p className="dept-state__desc">No tasks are assigned to you in this department right now.</p>
        </div>
      ) : (
        <ul className="dept-mywork-list">
          {tasks.map((task) => {
            const isWorking = task.status === 'in-progress';
            const breached = task.sla.status === 'exceeded';

            return (
              <li key={task.id}>
                <Link to={`/department/complaints/${task.id}`} className="dept-mywork-card">
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

                  <span className="dept-mywork-card__desc">{task.issue.description}</span>

                  <span className="dept-mywork-card__foot">
                    <span className={`dept-mywork-card__sla${breached ? ' is-breached' : ''}`}>
                      {breached ? 'Past SLA deadline' : `Due ${formatRelative(task.sla.dueAt)}`}
                    </span>

                    {!isWorking && (
                      <button
                        type="button"
                        className="dept-action-btn dept-action-btn--primary dept-action-btn--sm"
                        onClick={(e) => handleStartTask(task.id, e)}
                        disabled={starting === task.id}
                      >
                        {starting === task.id ? 'Starting…' : 'Start work'}
                      </button>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
