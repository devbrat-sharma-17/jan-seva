// ============================================================
// Admin SLA & Escalations Center — JAN-SEVA Phase 5
// ============================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStoredComplaints } from '../../../services/complaintService';
import { formatStamp, formatRelative } from '../../../services/timeService';
import type { Complaint } from '../../../types';
import '../admin-shared.css';
import '../Complaints/AdminComplaints.css';
import { AdminIcon } from '../AdminIcon';

export function AdminEscalations() {
  const [activeTab, setActiveTab] = useState<
    'all' | 'breached' | 'atRisk' | 'escalated' | 'reinspection'
  >('all');

  const allComplaints = useMemo(() => getStoredComplaints(), []);
  const now = Date.now();

  const breached = useMemo(() => {
    return allComplaints.filter((c) => {
      if (c.status === 'resolved') return false;
      const due = new Date(c.sla.dueAt).getTime();
      return c.sla.status === 'exceeded' || due < now;
    });
  }, [allComplaints, now]);

  const atRisk = useMemo(() => {
    return allComplaints.filter((c) => {
      if (c.status === 'resolved') return false;
      const due = new Date(c.sla.dueAt).getTime();
      return c.sla.status === 'approaching' || (due - now < 8 * 3600 * 1000 && due > now);
    });
  }, [allComplaints, now]);

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
      {/* KPI Overview */}
      <div className="kpi-grid">
        {' '}
        <div
          className={`kpi-card ${activeTab === 'breached' ? 'kpi-card--red' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('breached')}
        >
          {' '}
          <div className="kpi-card__label">SLA Breached</div>{' '}
          <div className="kpi-card__value" style={{ color: 'var(--red-600)' }}>
            {breached.length}
          </div>{' '}
          <div className="kpi-card__sub">Exceeded target deadline</div>{' '}
        </div>{' '}
        <div
          className={`kpi-card ${activeTab === 'atRisk' ? 'kpi-card--amber' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('atRisk')}
        >
          {' '}
          <div className="kpi-card__label">SLA at Risk</div>{' '}
          <div className="kpi-card__value" style={{ color: 'var(--amber-600)' }}>
            {atRisk.length}
          </div>{' '}
          <div className="kpi-card__sub">&lt;8h remaining</div>{' '}
        </div>{' '}
        <div
          className={`kpi-card ${activeTab === 'escalated' ? 'kpi-card--red' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('escalated')}
        >
          {' '}
          <div className="kpi-card__label">Active Escalations</div>{' '}
          <div className="kpi-card__value">{escalated.length}</div>{' '}
          <div className="kpi-card__sub">Level 2 intervention</div>{' '}
        </div>{' '}
        <div
          className={`kpi-card ${activeTab === 'reinspection' ? 'kpi-card--amber' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('reinspection')}
        >
          {' '}
          <div className="kpi-card__label">Reinspection Requested</div>{' '}
          <div className="kpi-card__value">{reinspection.length}</div>{' '}
          <div className="kpi-card__sub">Rejected by citizen</div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                const isBreachedItem =
                  c.sla.status === 'exceeded' || new Date(c.sla.dueAt).getTime() < now;
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
                      <div style={{ fontWeight: 700 }}>{c.issue.title}</div>{' '}
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
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
                        <span style={{ color: 'var(--amber-600)', fontWeight: 700 }}>
                          {' '}
                          Reinspection Flagged
                        </span>
                      ) : isBreachedItem ? (
                        <span style={{ color: 'var(--red-600)', fontWeight: 700 }}>SLA Breached</span>
                      ) : (
                        <span style={{ color: 'var(--amber-600)', fontWeight: 700 }}>SLA at Risk</span>
                      )}
                    </td>{' '}
                    <td>
                      {' '}
                      <div>{formatStamp(c.sla.dueAt)}</div>{' '}
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                        ({formatRelative(c.sla.dueAt)})
                      </div>{' '}
                    </td>{' '}
                    <td>
                      {c.assignedOfficer?.name || <em style={{ color: 'var(--slate-400)' }}>Unassigned</em>}
                    </td>{' '}
                    <td>
                      {' '}
                      <Link
                        to={`/admin/complaints/${c.id}`}
                        style={{ color: 'var(--color-civic-blue-dark)', fontWeight: 700, textDecoration: 'none' }}
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
