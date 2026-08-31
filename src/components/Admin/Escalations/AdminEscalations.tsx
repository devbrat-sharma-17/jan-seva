// ============================================================
// Admin SLA & Escalations Center — JAN-SEVA Phase 5
// ============================================================

import { useCallback, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStoredComplaints } from '../../../services/complaintService';
import { computeSlaHealth } from '../../../services/slaService';
import { useLiveData } from '../../../hooks/useLiveData';
import { formatStamp, formatRelative } from '../../../services/timeService';
import type { Complaint } from '../../../types';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';
import { AdminIcon } from '../AdminIcon';
import { NotificationPanel } from '../Notifications/NotificationPanel';

export function AdminEscalations() {
  const [activeTab, setActiveTab] = useState<
    'all' | 'breached' | 'atRisk' | 'escalated' | 'reinspection'
  >('all');

  // Re-derives whenever a department writes, in this tab or another.
  const allComplaints = useLiveData(useCallback(() => getStoredComplaints(), []));

  /* Health from `dueAt` against the clock. Reading the persisted
     `sla.status` classified a complaint by whatever was true when it was
     last written, so the escalations page missed anything that breached
     since. */
  const buckets = useMemo(() => {
    const now = Date.now();
    const breachedList: Complaint[] = [];
    const atRiskList: Complaint[] = [];

    for (const c of allComplaints) {
      if (c.status === 'resolved') continue;
      const health = computeSlaHealth(c, now);
      if (health?.status === 'exceeded') breachedList.push(c);
      else if (health?.status === 'approaching') atRiskList.push(c);
    }

    return { breachedList, atRiskList };
  }, [allComplaints]);

  const breached = buckets.breachedList;
  const atRisk = buckets.atRiskList;

  const escalated = useMemo(() => {
    return allComplaints.filter((c) => c.status === 'escalated');
  }, [allComplaints]);

  const reinspection = useMemo(() => {
    return allComplaints.filter((c) => c.feedback?.reinspectionRequested);
  }, [allComplaints]);

  const displayList: Complaint[] = useMemo(() => {
    switch (activeTab) {
      case 'breached':
        return breached;
      case 'atRisk':
        return atRisk;
      case 'escalated':
        return escalated;
      case 'reinspection':
        return reinspection;
      default:
        // Combined unique
        const set = new Set<string>();
        const list: Complaint[] = [];
        [...breached, ...atRisk, ...escalated, ...reinspection].forEach((c) => {
          if (!set.has(c.id)) {
            set.add(c.id);
            list.push(c);
          }
        });
        return list;
    }
  }, [activeTab, breached, atRisk, escalated, reinspection]);

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>SLA Compliance & Escalation Center</h1>{' '}
          <p>
            Real-time oversight of delayed tickets, critical breaches, and citizen reinspection
            requests
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {/* Operational alerts. Deduplicated and read-tracked, so the same
          breach is not re-announced on every visit. */}
      <NotificationPanel />
      {/* KPI Overview */}
      <div className="kpi-grid">
        {' '}
        <button
          type="button"
          className={`kpi-card ${activeTab === 'breached' ? 'kpi-card--red' : ''} kpi-card--clickable`}
          aria-pressed={activeTab === 'breached'}
          onClick={() => setActiveTab('breached')}
        >
          {' '}
          <div className="kpi-card__label">SLA Breached</div>{' '}
          <div className="kpi-card__value admin-u-danger">
            {breached.length}
          </div>{' '}
          <div className="kpi-card__sub">Exceeded target deadline</div>{' '}
        </button>{' '}
        <button
          type="button"
          className={`kpi-card ${activeTab === 'atRisk' ? 'kpi-card--amber' : ''} kpi-card--clickable`}
          aria-pressed={activeTab === 'atRisk'}
          onClick={() => setActiveTab('atRisk')}
        >
          {' '}
          <div className="kpi-card__label">SLA at Risk</div>{' '}
          <div className="kpi-card__value admin-u-warning">
            {atRisk.length}
          </div>{' '}
          <div className="kpi-card__sub">&lt;8h remaining</div>{' '}
        </button>{' '}
        <button
          type="button"
          className={`kpi-card ${activeTab === 'escalated' ? 'kpi-card--red' : ''} kpi-card--clickable`}
          aria-pressed={activeTab === 'escalated'}
          onClick={() => setActiveTab('escalated')}
        >
          {' '}
          <div className="kpi-card__label">Active Escalations</div>{' '}
          <div className="kpi-card__value">{escalated.length}</div>{' '}
          <div className="kpi-card__sub">Level 2 intervention</div>{' '}
        </button>{' '}
        <button
          type="button"
          className={`kpi-card ${activeTab === 'reinspection' ? 'kpi-card--amber' : ''} kpi-card--clickable`}
          aria-pressed={activeTab === 'reinspection'}
          onClick={() => setActiveTab('reinspection')}
        >
          {' '}
          <div className="kpi-card__label">Reinspection Requested</div>{' '}
          <div className="kpi-card__value">{reinspection.length}</div>{' '}
          <div className="kpi-card__sub">Rejected by citizen</div>{' '}
        </button>{' '}
      </div>{' '}
      {/* Filter Tabs */}
      <div className="admin-u-row">
        {' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${activeTab === 'all' ? 'admin-filter-select' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {' '}
          All Attention Items (
          {breached.length + atRisk.length + escalated.length + reinspection.length})
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${activeTab === 'breached' ? 'admin-filter-select' : ''}`}
          onClick={() => setActiveTab('breached')}
        >
          {' '}
          Breached ({breached.length})
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${activeTab === 'atRisk' ? 'admin-filter-select' : ''}`}
          onClick={() => setActiveTab('atRisk')}
        >
          {' '}
          At Risk ({atRisk.length})
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${activeTab === 'escalated' ? 'admin-filter-select' : ''}`}
          onClick={() => setActiveTab('escalated')}
        >
          {' '}
          Escalated ({escalated.length})
        </button>{' '}
        <button
          type="button"
          className={`admin-filter-reset-btn ${activeTab === 'reinspection' ? 'admin-filter-select' : ''}`}
          onClick={() => setActiveTab('reinspection')}
        >
          {' '}
          Reinspection ({reinspection.length})
        </button>{' '}
      </div>{' '}
      {/* Table */}
      <div className="admin-table-container">
        {' '}
        {displayList.length === 0 ? (
          <div className="admin-empty-state">
            {' '}
            <div className="admin-empty-state-icon">
              <AdminIcon name="check" size={26} />
            </div> <h3>No complaints in this category</h3>{' '}
            <p>
              All service delivery timelines are currently within standard operating limits.
            </p>{' '}
          </div>
        ) : (
          <table className="admin-complaints-table">
            {' '}
            <thead>
              {' '}
              <tr>
                {' '}
                <th>Complaint ID</th> <th>Issue</th> <th>Department</th> <th>Attention Type</th>{' '}
                <th>SLA Due Time</th> <th>Officer</th> <th>Action</th>{' '}
              </tr>{' '}
            </thead>{' '}
            <tbody>
              {' '}
              {displayList.map((c) => {
                const isBreachedItem = computeSlaHealth(c)?.status === 'exceeded';
                const isReinspect = !!c.feedback?.reinspectionRequested;

                return (
                  <tr key={c.id}>
                    {' '}
                    <td>
                      {' '}
                      <Link to={`/admin/complaints/${c.id}`} className="admin-complaint-id-link">
                        {' '}
                        {c.id}
                      </Link>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <div className="admin-u-strong">{c.issue.title}</div>{' '}
                      <div className="admin-u-sub">
                        {' '}
                        {c.location.locality}
                      </div>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span className="admin-dept-pill">{c.department.name}</span>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      {isReinspect ? (
                        <span className="admin-u-warning">
                          {' '}
                          Reinspection Flagged
                        </span>
                      ) : isBreachedItem ? (
                        <span className="admin-u-danger">SLA Breached</span>
                      ) : (
                        <span className="admin-u-warning">SLA at Risk</span>
                      )}
                    </td>{' '}
                    <td>
                      {' '}
                      <div>{formatStamp(c.sla.dueAt)}</div>{' '}
                      <div className="admin-u-sub">
                        ({formatRelative(c.sla.dueAt)})
                      </div>{' '}
                    </td>{' '}
                    <td>
                      {c.assignedOfficer?.name || <em className="admin-cell-empty">Unassigned</em>}
                    </td>{' '}
                    <td>
                      {' '}
                      <Link className="admin-table-link"
                        to={`/admin/complaints/${c.id}`}
                      >
                        {' '}
                        Inspect →
                      </Link>{' '}
                    </td>{' '}
                  </tr>
                );
              })}
            </tbody>{' '}
          </table>
        )}
      </div>{' '}
    </div>
  );
}
