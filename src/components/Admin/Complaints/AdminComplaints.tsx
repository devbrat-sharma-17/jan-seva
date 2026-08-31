// ============================================================
// Admin Complaints View — JAN-SEVA Phase 5
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFilteredComplaints } from '../../../services/adminService';
import { DEPARTMENTS } from '../../../data/departments';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { formatRelative } from '../../../services/timeService';
import type { AdminComplaintFilters } from '../../../types/admin';
import type { DepartmentId } from '../../../types/department';
import './AdminComplaints.css';
import { AdminIcon } from '../AdminIcon';

export function AdminComplaints() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<AdminComplaintFilters>({
    department: (searchParams.get('department') as DepartmentId) || undefined,
    status: searchParams.get('status') || undefined,
    priority: searchParams.get('priority') || undefined,
    category: searchParams.get('category') || undefined,
    locality: searchParams.get('locality') || undefined,
    slaStatus: searchParams.get('slaStatus') || undefined,
    search: searchParams.get('search') || '',
  });

  const complaints = useMemo(() => {
    return getFilteredComplaints(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof AdminComplaintFilters, value: string) => {
    const updated = { ...filters, [key]: value || undefined };
    setFilters(updated);

    // Sync to URL
    const params = new URLSearchParams();
    Object.entries(updated).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setFilters({ search: '' });
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="admin-complaints">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>City Grievance Monitor</h1>{' '}
          <p>Cross-department complaints across all Gwalior municipal zones</p>{' '}
        </div>{' '}
        <div className="admin-complaints__count-badge">
          {' '}
          <AdminIcon name="complaints" size={15} /> {complaints.length} complaints
        </div>{' '}
      </div>{' '}
      {/* Filters Bar */}
      <div className="admin-filters-bar">
        {' '}
        <div className="admin-filters-row">
          {' '}
          <div className="admin-filter-search">
            {' '}
            <span className="admin-filter-search-icon">
              <AdminIcon name="search" size={15} />
            </span>{' '}
            <input
              type="text"
              placeholder="Search by ID, title, description, or locality..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />{' '}
          </div>{' '}
          <select
            className="admin-filter-select"
            value={filters.department || ''}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            aria-label="Filter by department"
          >
            {' '}
            <option value="">All Departments</option>{' '}
            {Object.values(DEPARTMENTS).map((d) => (
              <option key={d.id} value={d.id}>
                {' '}
                {d.shortName}
              </option>
            ))}
          </select>{' '}
          <select
            className="admin-filter-select"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            aria-label="Filter by status"
          >
            {' '}
            <option value="">All Statuses</option> <option value="pending">Pending</option>{' '}
            <option value="assigned">Assigned</option>{' '}
            <option value="in-progress">In Progress</option>{' '}
            <option value="resolution-submitted">Resolution Submitted</option>{' '}
            <option value="resolved">Resolved</option>{' '}
            <option value="escalated">Escalated</option>{' '}
          </select>{' '}
          <select
            className="admin-filter-select"
            value={filters.priority || ''}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            aria-label="Filter by priority"
          >
            {' '}
            <option value="">All Priorities</option>{' '}
            <option value="critical">Critical Priority</option>{' '}
            <option value="high">High Priority</option>{' '}
            <option value="medium">Medium Priority</option>{' '}
            <option value="low">Low Priority</option>{' '}
          </select>{' '}
          <select
            className="admin-filter-select"
            value={filters.slaStatus || ''}
            onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
            aria-label="Filter by SLA status"
          >
            {' '}
            <option value="">All SLA States</option>{' '}
            <option value="normal">Within SLA Target</option>{' '}
            <option value="approaching">Approaching SLA Deadline</option>{' '}
            <option value="exceeded">SLA Breached / Exceeded</option>{' '}
          </select>{' '}
          {(filters.department ||
            filters.status ||
            filters.priority ||
            filters.slaStatus ||
            filters.search) && (
            <button className="admin-filter-reset-btn" type="button" onClick={handleResetFilters}>
              {' '}
              Reset Filters ✕
            </button>
          )}
        </div>{' '}
      </div>{' '}
      {/* Desktop Table View */}
      <div className="admin-table-container">
        {' '}
        {complaints.length === 0 ? (
          <div className="admin-empty-state">
            {' '}
            <div className="admin-empty-state-icon">
              <AdminIcon name="search" size={26} />
            </div>{' '}
            <h3>No complaints match the selected filters</h3>{' '}
            <p>Try clearing your search query or selecting "All Departments".</p>{' '}
          </div>
        ) : (
          <table className="admin-complaints-table">
            {' '}
            <thead>
              {' '}
              <tr>
                {' '}
                <th>Complaint ID</th> <th>Issue & Locality</th> <th>Department</th>{' '}
                <th>Priority</th> <th>Status</th> <th>SLA Due</th> <th>Created</th>{' '}
              </tr>{' '}
            </thead>{' '}
            <tbody>
              {' '}
              {complaints.map((c) => {
                const isBreached =
                  c.sla.status === 'exceeded' || new Date(c.sla.dueAt).getTime() < Date.now();
                const isApproaching = c.sla.status === 'approaching';
                const severity = c.aiAnalysis?.severity || 'medium';

                return (
                  <tr key={c.id} onClick={() => navigate(`/admin/complaints/${c.id}`)}>
                    {' '}
                    <td>
                      {' '}
                      <span className="admin-complaint-id-link">{c.id}</span>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                        {c.issue.title}
                      </div>{' '}
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                        {' '}
                        {c.location.locality}, {c.location.city}
                      </div>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span className="admin-dept-pill">
                        {' '}
                        {c.department.name.replace(/\(.*\)/, '').trim()}
                      </span>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span className={`admin-priority-badge admin-priority-badge--${severity}`}>
                        {' '}
                        {severity}
                      </span>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <StatusPill status={c.status} />{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span
                        className={`admin-sla-tag ${
                          isBreached
                            ? 'admin-sla-tag--breached'
                            : isApproaching
                              ? 'admin-sla-tag--approaching'
                              : 'admin-sla-tag--normal'
                        }`}
                      >
                        {' '}
                        {isBreached ? 'Breached' : isApproaching ? 'At risk' : 'On track'}
                      </span>{' '}
                    </td>{' '}
                    <td>
                      {' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {' '}
                        {formatRelative(c.createdAt)}
                      </span>{' '}
                    </td>{' '}
                  </tr>
                );
              })}
            </tbody>{' '}
          </table>
        )}
      </div>{' '}
      {/* Mobile Cards View */}
      <div className="admin-complaints-cards">
        {' '}
        {complaints.map((c) => {
          const isBreached =
            c.sla.status === 'exceeded' || new Date(c.sla.dueAt).getTime() < Date.now();
          const severity = c.aiAnalysis?.severity || 'medium';

          return (
            <div
              key={c.id}
              className="admin-complaint-card"
              onClick={() => navigate(`/admin/complaints/${c.id}`)}
            >
              {' '}
              <div className="admin-complaint-card__header">
                {' '}
                <span className="admin-complaint-id-link">{c.id}</span>{' '}
                <StatusPill status={c.status} />{' '}
              </div>{' '}
              <div className="admin-complaint-card__title">{c.issue.title}</div>{' '}
              <div className="admin-complaint-card__meta">
                {' '}
                <span className="admin-dept-pill">{c.department.name}</span>{' '}
                <span className={`admin-priority-badge admin-priority-badge--${severity}`}>
                  {' '}
                  {severity}
                </span>{' '}
                <span> {c.location.locality}</span>{' '}
                {isBreached && (
                  <span style={{ color: 'var(--red-600)', fontWeight: 700 }}>SLA Breached</span>
                )}
                <span> {formatRelative(c.createdAt)}</span>{' '}
              </div>{' '}
            </div>
          );
        })}
      </div>{' '}
    </div>
  );
}
