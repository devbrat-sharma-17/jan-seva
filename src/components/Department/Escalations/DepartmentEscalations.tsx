import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import { getDepartmentEscalations, subscribeToComplaints } from '../../../services/complaintService';

import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './DepartmentEscalations.css';

export function DepartmentEscalations() {
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [escalations, setEscalations] = useState<Complaint[]>([]);

  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = () => setEscalations(getDepartmentEscalations(user.departmentId));
    load();
    const unsubscribe = subscribeToComplaints(load);
    return () => unsubscribe();
  }, [user?.departmentId]);

  if (!user) {
    return <div className="dept-loading">Loading escalations</div>;
  }

  const deptConfig = getDepartmentConfig(user.departmentId);

  return (
    <div className="dept-page dept-page--narrow">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">Escalations</h1>
          <p className="dept-page-desc">
            Complaints past their SLA deadline. These have been raised to the Executive Engineer and
            the City Commissioner&rsquo;s office, and need dispatch today.
          </p>
        </div>

        {escalations.length > 0 && (
          <span className="dept-escalation-count">
            {escalations.length} open
          </span>
        )}
      </div>

      {escalations.length === 0 ? (
        <div className="dept-state dept-state--ok">
          <span className="dept-state__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <h2 className="dept-state__title">No escalations</h2>
          <p className="dept-state__desc">
            {deptConfig.name} is inside its SLA targets on every open complaint.
          </p>
        </div>
      ) : (
        <ul className="dept-escalations-list">
          {escalations.map((complaint) => {
            const overdueHours = Math.max(
              1,
              Math.round((Date.now() - new Date(complaint.sla.dueAt).getTime()) / 3_600_000)
            );

            return (
              <li key={complaint.id}>
                <Link to={`/department/complaints/${complaint.id}`} className="dept-escalation-card">
                  <span className="dept-escalation-card__top">
                    <span className="dept-escalation-card__id">{complaint.id}</span>
                    <span className="dept-sla-pill dept-sla-pill--breached">
                      {overdueHours}h overdue
                    </span>
                  </span>

                  <span className="dept-escalation-card__title">{complaint.issue.title}</span>

                  <span className="dept-escalation-card__place">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {complaint.location.address || complaint.location.locality}, {complaint.location.city}
                  </span>

                  <span className="dept-escalation-card__foot">
                    <span className="dept-escalation-card__owner">
                      {complaint.assignedOfficer?.name ? (
                        <>Assigned to {complaint.assignedOfficer.name}</>
                      ) : (
                        <strong>No officer assigned</strong>
                      )}
                    </span>
                    <span className="dept-escalation-card__cta">
                      Open and resolve
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
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
