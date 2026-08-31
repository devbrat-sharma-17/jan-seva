import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import {
  getComplaintsByDepartment,
  getDepartmentMetrics,
  getDepartmentNeedsAttention,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { KPICards } from './KPICards';
import { NeedsAttention } from './NeedsAttention';
import { PriorityQueue } from './PriorityQueue';
import type { Complaint } from '../../../types';
import type { DepartmentMetrics, DepartmentUser } from '../../../types/department';
import './DepartmentDashboard.css';

export function DepartmentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [metrics, setMetrics] = useState<DepartmentMetrics | null>(null);
  const [attentionData, setAttentionData] = useState<{
    breached: Complaint[];
    atRisk: Complaint[];
    unassigned: Complaint[];
    reinspection: Complaint[];
  }>({ breached: [], atRisk: [], unassigned: [], reinspection: [] });

  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, []);

  useEffect(() => {
    if (!user) return;

    const load = () => {
      setComplaints(getComplaintsByDepartment(user.departmentId));
      setMetrics(getDepartmentMetrics(user.departmentId));
      setAttentionData(getDepartmentNeedsAttention(user.departmentId));
    };

    load();
    const unsubscribe = subscribeToComplaints(load);
    return () => unsubscribe();
  }, [user?.departmentId]);

  if (!user || !metrics) {
    return <div className="dept-loading">Loading dashboard</div>;
  }

  const deptConfig = getDepartmentConfig(user.departmentId);
  const openCount = complaints.filter((c) => c.status !== 'resolved').length;

  return (
    <div className="dept-page">
      {/* The greeting card this replaces carried a name, a role and a
          motto — all three already sit in the header. What a shift
          actually opens with is the size of the open queue. */}
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

      <KPICards
        metrics={metrics}
        onFilterClick={(filterId) => {
          if (filterId === 'escalated') navigate('/department/escalations');
          else if (filterId === 'at-risk') navigate('/department/complaints?filter=at-risk');
          else if (filterId === 'high-priority') navigate('/department/complaints?filter=high-priority');
          else navigate('/department/complaints');
        }}
      />

      <NeedsAttention attentionData={attentionData} />

      <PriorityQueue
        complaints={complaints}
        title="Priority queue"
        subtitle="Ranked by AI severity, SLA risk and report volume."
        showViewAll
      />
    </div>
  );
}
