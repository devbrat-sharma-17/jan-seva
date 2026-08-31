import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import { getComplaintsByDepartment, subscribeToComplaints } from '../../../services/complaintService';
import { explainPriority } from '../../../services/aiService';
import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './DepartmentMap.css';

type StatusFilter = 'all' | 'active' | 'resolved';

const GWALIOR_CENTRE = { lat: 26.2183, lng: 78.1828 };

const LEGEND = [
  { tone: 'critical', label: 'Critical' },
  { tone: 'high', label: 'High' },
  { tone: 'medium', label: 'Routine' },
  { tone: 'resolved', label: 'Resolved' },
] as const;

export function DepartmentMap() {
  const navigate = useNavigate();
  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const departmentId = user?.departmentId;

  useEffect(() => {
    if (!departmentId) return;
    const load = () => setComplaints(getComplaintsByDepartment(departmentId));
    load();
    return subscribeToComplaints(load);
  }, [departmentId]);

  // The route guard has already established the session.
  if (!user) return null;

  const deptConfig = getDepartmentConfig(user.departmentId);

  const filtered = complaints.filter((c) => {
    if (statusFilter === 'active') return c.status !== 'resolved';
    if (statusFilter === 'resolved') return c.status === 'resolved';
    return true;
  });

  // Selection is derived rather than stored as an object, so a pin cannot
  // keep showing a stale copy of a complaint after the store updates.
  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  const pinPosition = (lat: number, lng: number, index: number) => {
    const top = Math.min(86, Math.max(12, 50 - (lat - GWALIOR_CENTRE.lat) * 700 + (index % 3) * 4));
    const left = Math.min(88, Math.max(12, 50 + (lng - GWALIOR_CENTRE.lng) * 700 + (index % 4) * 3));
    return { top: `${top}%`, left: `${left}%` };
  };

  const filters: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'active', label: 'Active', count: complaints.filter((c) => c.status !== 'resolved').length },
    { id: 'resolved', label: 'Resolved', count: complaints.filter((c) => c.status === 'resolved').length },
    { id: 'all', label: 'All', count: complaints.length },
  ];

  return (
    <div className="dept-page">
      <div className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">City map</h1>
          <p className="dept-page-desc">
            {deptConfig.shortName} reports across the Gwalior municipal area.
          </p>
        </div>
      </div>

      <div className="dept-tabs-scroll" role="group" aria-label="Filter map pins">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={statusFilter === f.id}
            className={`dept-tab-btn${statusFilter === f.id ? ' dept-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className="dept-tab-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="dept-map-wrap">
        <div className="dept-map">
          <div className="dept-map__canvas" aria-hidden="true" />

        <ul className="dept-map__legend">
          {LEGEND.map((item) => (
            <li key={item.tone}>
              <span className={`dept-map__legend-dot dept-map__legend-dot--${item.tone}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>

        {filtered.map((c, index) => {
          const priority = explainPriority(c);
          const tone =
            c.status === 'resolved'
              ? 'resolved'
              : priority.level === 'critical'
              ? 'critical'
              : priority.level === 'high'
              ? 'high'
              : 'medium';

          return (
            <button
              key={c.id}
              type="button"
              className={`dept-map__pin${selectedId === c.id ? ' is-selected' : ''}`}
              style={pinPosition(c.location.latitude, c.location.longitude, index)}
              onClick={() => setSelectedId(c.id)}
              aria-label={`${c.id}: ${c.issue.title}`}
            >
              <span className={`dept-map__pin-badge dept-map__pin-badge--${tone}`} aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="dept-map__empty">No complaints match this filter.</p>
        )}
      </div>

      {/* Detail sits below the map on phones instead of covering the pins,
          and floats over the canvas once there is room for it. */}
      {selected && (
        <div className="dept-map__detail">
          <div className="dept-map__detail-top">
            <span className="dept-map__detail-id">{selected.id}</span>
            <span className={`dept-status-pill dept-status-pill--${selected.status}`}>
              {selected.status.replace('-', ' ')}
            </span>
            <button
              type="button"
              className="dept-map__detail-close"
              onClick={() => setSelectedId(null)}
              aria-label="Close pin details"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <p className="dept-map__detail-title">{selected.issue.title}</p>
          <p className="dept-map__detail-place">
            {selected.location.address || selected.location.locality}, {selected.location.city}
          </p>

          <div className="dept-map__detail-actions">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selected.location.latitude},${selected.location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm"
            >
              Directions
            </a>
            <button
              type="button"
              className="dept-action-btn dept-action-btn--primary dept-action-btn--sm"
              onClick={() => navigate(`/department/complaints/${selected.id}`)}
            >
              Open details
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
