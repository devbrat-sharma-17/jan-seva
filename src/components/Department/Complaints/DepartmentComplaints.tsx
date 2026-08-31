import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import { getComplaintsByDepartment, subscribeToComplaints } from '../../../services/complaintService';
import { computeSlaHealth } from '../../../services/slaService';
import { PriorityQueue } from '../Dashboard/PriorityQueue';
import { SkeletonQueue, LoadingAnnouncement } from '../../portal/Skeletons';
import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './DepartmentComplaints.css';

export function DepartmentComplaints() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  // The route guard has already established the session, so this reads
  // once rather than re-reading on every render pass.
  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const departmentId = user?.departmentId;

  useEffect(() => {
    if (!departmentId) return;
    const load = () => setComplaints(getComplaintsByDepartment(departmentId));
    load();
    return subscribeToComplaints(load);
  }, [departmentId]);

  /* SLA health is derived against the current clock, once per pass, and
     shared by the filters, the tab counts and the rows. Reading the
     persisted `sla.status` instead meant a complaint that breached an
     hour ago still filtered as "on track". */
  const health = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, ReturnType<typeof computeSlaHealth>>();
    (complaints ?? []).forEach((c) => map.set(c.id, computeSlaHealth(c, now)));
    return map;
  }, [complaints]);

  // A deep link from the dashboard changes the query string without
  // remounting, so the tab has to follow it.
  useEffect(() => {
    setActiveTab(searchParams.get('filter') || 'all');
  }, [searchParams]);

  const filteredList = useMemo(() => {
    return (complaints ?? []).filter((c) => {
      const sla = health.get(c.id)?.status;
      if (activeTab === 'new' && c.status !== 'pending') return false;
      if (activeTab === 'assigned' && c.status !== 'assigned') return false;
      if (activeTab === 'in-progress' && c.status !== 'in-progress') return false;
      if (activeTab === 'resolved' && c.status !== 'resolved') return false;
      if (activeTab === 'escalated' && c.status !== 'escalated' && sla !== 'exceeded') return false;
      if (activeTab === 'at-risk' && (sla !== 'approaching' || c.status === 'resolved')) return false;
      if (activeTab === 'unassigned' && (c.assignedOfficer?.name || c.status === 'resolved')) return false;
      if (activeTab === 'reinspection' && (!c.feedback?.reinspectionRequested || c.status === 'resolved')) return false;
      if (activeTab === 'high-priority') {
        const p = c.aiAnalysis?.priorityScore || 50;
        const s = c.aiAnalysis?.severity || 'medium';
        if (p < 75 && s !== 'high' && s !== 'critical') return false;
        if (c.status === 'resolved') return false;
      }

      if (categoryFilter !== 'all' && c.issue.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [
          c.id,
          c.issue.title,
          c.issue.description,
          c.location.address || c.location.locality || '',
          c.assignedOfficer?.name || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [complaints, health, activeTab, categoryFilter, searchQuery]);

  if (!user) return null;

  const deptConfig = getDepartmentConfig(user.departmentId);

  if (complaints === null) {
    return (
      <div className="dept-page">
        <LoadingAnnouncement label="the complaint queue" />
        <SkeletonQueue rows={5} />
      </div>
    );
  }

  const slaOf = (c: Complaint) => health.get(c.id)?.status;

  const tabs = [
    { id: 'all', label: 'All', count: complaints.length },
    { id: 'new', label: 'New', count: complaints.filter((c) => c.status === 'pending').length },
    { id: 'assigned', label: 'Assigned', count: complaints.filter((c) => c.status === 'assigned').length },
    { id: 'in-progress', label: 'In progress', count: complaints.filter((c) => c.status === 'in-progress').length },
    { id: 'at-risk', label: 'At risk', count: complaints.filter((c) => slaOf(c) === 'approaching' && c.status !== 'resolved').length },
    { id: 'escalated', label: 'Escalated', count: complaints.filter((c) => c.status === 'escalated' || slaOf(c) === 'exceeded').length },
    { id: 'resolved', label: 'Resolved', count: complaints.filter((c) => c.status === 'resolved').length },
  ];

  const isFiltered = activeTab !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '';

  const resetAll = () => {
    setActiveTab('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setSearchParams({});
  };

  const setTab = (id: string) => {
    setActiveTab(id);
    setSearchParams(id === 'all' ? {} : { filter: id });
  };

  return (
    <div className="dept-page">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">Complaint queue</h1>
          <p className="dept-page-desc">
            Every civic report routed to {deptConfig.name}.
          </p>
        </div>
      </div>

      {/* Search and category sat inside a bordered card that added a box
          around two controls without grouping anything. */}
      <div className="dept-queue-toolbar">
        <div className="dept-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="dept-search__input"
            placeholder="Search ID, location or officer"
            aria-label="Search complaints"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="dept-select dept-queue-toolbar__category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {deptConfig.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="dept-tabs-scroll" role="group" aria-label="Filter by status">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            className={`dept-tab-btn${activeTab === tab.id ? ' dept-tab-btn--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="dept-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="dept-results-info" aria-live="polite">
        <span>
          {filteredList.length} of {complaints.length} complaints
        </span>
        {isFiltered && (
          <button type="button" className="dept-results-info__reset" onClick={resetAll}>
            Clear filters
          </button>
        )}
      </div>

      <PriorityQueue
        complaints={filteredList}
        pageSize={20}
        emptyTitle="No matching complaints"
        emptyDesc={
          isFiltered
            ? 'Nothing in this department matches the current filters.'
            : 'Every complaint for this department is resolved.'
        }
      />
    </div>
  );
}
