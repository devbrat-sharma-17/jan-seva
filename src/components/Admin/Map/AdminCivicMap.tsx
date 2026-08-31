// ============================================================
// Admin City-Wide Civic Map & Hotspots — JAN-SEVA Phase 5
// ============================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStoredComplaints } from '../../../services/complaintService';
import { getCivicHotspots } from '../../../services/adminService';
import { DEPARTMENTS } from '../../../data/departments';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import type { Complaint } from '../../../types';
import type { DepartmentId } from '../../../types/department';
import type { CivicHotspot } from '../../../types/admin';
import './AdminCivicMap.css';

const GWALIOR_CENTRE = { lat: 26.2183, lng: 78.1828 };

export function AdminCivicMap() {
  const [selectedDept, setSelectedDept] = useState<DepartmentId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<CivicHotspot | null>(null);

  const allComplaints = useMemo(() => getStoredComplaints(), []);
  const hotspots = useMemo(() => getCivicHotspots(), []);

  const filteredComplaints = useMemo(() => {
    return allComplaints.filter((c) => {
      if (
        selectedHotspot &&
        c.location.locality.toLowerCase() !== selectedHotspot.locality.toLowerCase()
      ) {
        return false;
      }

      if (selectedDept !== 'all') {
        const dId = c.department.id || '';
        const aiDept = c.aiAnalysis?.department || '';
        const deptCfg = DEPARTMENTS[selectedDept];
        const matches =
          dId === selectedDept ||
          aiDept === deptCfg.aiDeptId ||
          c.department.name.toLowerCase().includes(deptCfg.shortName.toLowerCase());
        if (!matches) return false;
      }

      if (statusFilter === 'active' && c.status === 'resolved') return false;
      if (statusFilter === 'resolved' && c.status !== 'resolved') return false;

      return true;
    });
  }, [allComplaints, selectedHotspot, selectedDept, statusFilter]);

  const selectedComplaint = useMemo(() => {
    return allComplaints.find((c) => c.id === selectedComplaintId) || null;
  }, [allComplaints, selectedComplaintId]);

  const pinPosition = (lat: number, lng: number, index: number) => {
    const top = Math.min(88, Math.max(12, 50 - (lat - GWALIOR_CENTRE.lat) * 650 + (index % 3) * 4));
    const left = Math.min(
      88,
      Math.max(12, 50 + (lng - GWALIOR_CENTRE.lng) * 650 + (index % 4) * 3),
    );
    return { top: `${top}%`, left: `${left}%` };
  };

  const getPinTone = (complaint: Complaint) => {
    if (complaint.status === 'resolved') return 'resolved';
    const sev = complaint.aiAnalysis?.severity;
    if (sev === 'critical') return 'critical';
    if (sev === 'high') return 'high';
    return 'medium';
  };

  return (
    <div className="admin-map-page">
      {' '}
      <div className="admin-complaints__header">
        {' '}
        <div className="admin-complaints__title-group">
          {' '}
          <h1>City-Wide Civic Map & Hotspot Radar</h1>{' '}
          <p>
            Real-time geographic distribution of citizen complaints across all wards in Gwalior
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {/* Map Controls */}
      <div className="admin-map-controls">
        {' '}
        <div className="admin-map-filters">
          {' '}
          <select
            className="admin-filter-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value as typeof selectedDept)}
            aria-label="Filter by department"
          >
            {' '}
            <option value="all">All Departments</option>{' '}
            {Object.values(DEPARTMENTS).map((d) => (
              <option key={d.id} value={d.id}>
                {' '}
                {d.shortName}
              </option>
            ))}
          </select>{' '}
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by status"
          >
            {' '}
            <option value="all">All Complaints ({filteredComplaints.length})</option>{' '}
            <option value="active">Active Issues</option>{' '}
            <option value="resolved">Resolved Issues</option>{' '}
          </select>{' '}
        </div>{' '}
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {' '}
          Displaying <strong>{filteredComplaints.length}</strong> markers on map
        </div>{' '}
      </div>{' '}
      {/* Map Container */}
      <div className="admin-map-container">
        {' '}
        <div className="admin-map-grid" /> {/* Ambient SVG city roads network */}
        <svg className="admin-map-roads" viewBox="0 0 800 600" preserveAspectRatio="none">
          {' '}
          <path
            d="M 50 150 Q 250 200 400 300 T 750 450"
            stroke="var(--slate-700)"
            strokeWidth="6"
            fill="none"
          />{' '}
          <path
            d="M 200 50 Q 300 250 400 300 T 600 550"
            stroke="var(--slate-700)"
            strokeWidth="5"
            fill="none"
          />{' '}
          <path d="M 100 500 Q 400 300 700 150" stroke="var(--navy-700)" strokeWidth="4" fill="none" />{' '}
          <circle cx="400" cy="300" r="14" fill="var(--navy-700)" stroke="var(--color-civic-blue)" strokeWidth="2" />{' '}
        </svg>{' '}
        {/* Legend */}
        <div className="admin-map-legend">
          {' '}
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>Severity Legend</div>{' '}
          <div className="admin-map-legend-item">
            {' '}
            <span className="admin-map-legend-dot admin-map-legend-dot--critical" />{' '}
            <span>Critical Priority</span>{' '}
          </div>{' '}
          <div className="admin-map-legend-item">
            {' '}
            <span className="admin-map-legend-dot admin-map-legend-dot--high" />{' '}
            <span>High Priority</span>{' '}
          </div>{' '}
          <div className="admin-map-legend-item">
            {' '}
            <span className="admin-map-legend-dot admin-map-legend-dot--medium" />{' '}
            <span>Routine</span>{' '}
          </div>{' '}
          <div className="admin-map-legend-item">
            {' '}
            <span className="admin-map-legend-dot admin-map-legend-dot--resolved" />{' '}
            <span>Resolved</span>{' '}
          </div>{' '}
        </div>{' '}
        {/* Complaint Pins */}
        {filteredComplaints.map((c, index) => {
          const tone = getPinTone(c);
          const pos = pinPosition(c.location.latitude, c.location.longitude, index);
          const isSelected = selectedComplaintId === c.id;

          return (
            <button
              key={c.id}
              type="button"
              className={`admin-map-pin admin-map-pin--${tone} ${isSelected ? 'admin-map-pin--selected' : ''}`}
              style={{ top: pos.top, left: pos.left }}
              onClick={() => {
                setSelectedComplaintId(c.id);
                setSelectedHotspot(null);
              }}
              title={`${c.id}: ${c.issue.title}`}
            >
              {' '}
              {tone === 'resolved' ? '✓' : tone === 'critical' ? '!' : tone === 'high' ? '▲' : '•'}
            </button>
          );
        })}
        {/* Pin Detail Popover */}
        {selectedComplaint && (
          <div className="admin-pin-popover">
            {' '}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              {' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: 'var(--color-civic-blue-dark)',
                }}
              >
                {' '}
                {selectedComplaint.id}
              </span>{' '}
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--slate-400)',
                  fontSize: '0.875rem',
                }}
                onClick={() => setSelectedComplaintId(null)}
              >
                {' '}
                ✕
              </button>{' '}
            </div>{' '}
            <h4 className="admin-pin-popover__title">{selectedComplaint.issue.title}</h4>{' '}
            <div className="admin-pin-popover__meta">
              {' '}
              {selectedComplaint.location.locality} · {selectedComplaint.department.name}
            </div>{' '}
            <div style={{ marginBottom: '0.75rem' }}>
              {' '}
              <StatusPill status={selectedComplaint.status} />{' '}
            </div>{' '}
            <Link
              to={`/admin/complaints/${selectedComplaint.id}`}
              className="admin-pin-popover__btn"
            >
              {' '}
              View Full Details →
            </Link>{' '}
          </div>
        )}
        {/* Hotspots Drawer */}
        <div className="admin-hotspots-panel">
          {' '}
          <div className="admin-hotspots-title">
            {' '}
            <span>Civic Hotspots</span>{' '}
            <span style={{ fontSize: '0.6875rem', color: 'var(--blue-300)' }}>
              {hotspots.length} Clusters
            </span>{' '}
          </div>{' '}
          {hotspots.map((h) => (
            <div key={h.id} className="admin-hotspot-item" onClick={() => setSelectedHotspot(h)}>
              {' '}
              <div className="admin-hotspot-header">
                {' '}
                <span> {h.locality}</span>{' '}
                <span style={{ color: 'var(--blue-300)' }}>{h.complaintCount} tickets</span>{' '}
              </div>{' '}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-border-strong)', marginBottom: '4px' }}>
                {' '}
                Top: {h.topCategoryTitle}
              </div>{' '}
              <div className="admin-hotspot-stats">
                {' '}
                {h.highPriorityCount > 0 && (
                  <span style={{ color: 'var(--color-warning)' }}> {h.highPriorityCount} High/Crit</span>
                )}
                {h.slaBreachedCount > 0 && (
                  <span style={{ color: 'var(--color-error)' }}> {h.slaBreachedCount} Breached</span>
                )}
                {h.averageResolutionHours > 0 && <span> ~{h.averageResolutionHours}h avg</span>}
              </div>{' '}
            </div>
          ))}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
