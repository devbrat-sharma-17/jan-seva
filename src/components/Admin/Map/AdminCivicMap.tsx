// ============================================================
// Admin City-Wide Civic Map & Hotspots — JAN-SEVA Phase 5
// ============================================================

import { useCallback, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStoredComplaints } from '../../../services/complaintService';
import { useLiveData } from '../../../hooks/useLiveData';
import { getCivicHotspots } from '../../../services/adminService';
import { DEPARTMENTS } from '../../../data/departments';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { CivicMap, type CivicMapMarker } from '../../shared/CivicMap/CivicMap';
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

  const allComplaints = useLiveData(useCallback(() => getStoredComplaints(), []));
  const hotspots = useLiveData(useCallback(() => getCivicHotspots(), []));

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

  const getPinTone = (complaint: Complaint): CivicMapMarker['tone'] => {
    if (complaint.status === 'resolved') return 'resolved';
    const sev = complaint.aiAnalysis?.severity;
    if (sev === 'critical') return 'critical';
    if (sev === 'high') return 'high';
    return 'medium';
  };

  const mapMarkers = useMemo<CivicMapMarker[]>(
    () =>
      filteredComplaints.map((c) => ({
        id: c.id,
        lat: c.location.latitude,
        lng: c.location.longitude,
        tone: getPinTone(c),
        title: `${c.id}: ${c.issue.title}`,
      })),
    [filteredComplaints],
  );

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
        <div className="admin-u-caption">
          {' '}
          Displaying <strong>{filteredComplaints.length}</strong> markers on map
        </div>{' '}
      </div>{' '}
      {/* Map Container */}
      <div className="admin-map-container">
        {' '}
        <CivicMap
          center={[GWALIOR_CENTRE.lat, GWALIOR_CENTRE.lng]}
          zoom={12}
          basemap="dark"
          fitToMarkers
          zoomPosition="topright"
          attributionPosition="bottomleft"
          ariaLabel="City-wide civic complaint map"
          markers={mapMarkers}
          selectedId={selectedComplaintId}
          onMarkerClick={(id) => {
            setSelectedComplaintId(id);
            setSelectedHotspot(null);
          }}
        />{' '}
        {/* Legend */}
        <div className="admin-map-legend">
          {' '}
          <div className="admin-cell-title">Severity Legend</div>{' '}
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
        {/* Pin Detail Popover */}
        {selectedComplaint && (
          <div className="admin-pin-popover">
            {' '}
            <div
              className="admin-mapcard__head"
            >
              {' '}
              <span
                className="admin-mapcard__id"
              >
                {' '}
                {selectedComplaint.id}
              </span>{' '}
              <button
                type="button"
                className="admin-mapcard__close"
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
            <div className="admin-u-gap-sm">
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
            <span className="admin-u-sub-ondark">
              {hotspots.length} Clusters
            </span>{' '}
          </div>{' '}
          {hotspots.map((h) => (
            <div key={h.id} className="admin-hotspot-item" onClick={() => setSelectedHotspot(h)}>
              {' '}
              <div className="admin-hotspot-header">
                {' '}
                <span> {h.locality}</span>{' '}
                <span className="admin-u-ondark-accent">{h.complaintCount} tickets</span>{' '}
              </div>{' '}
              <div className="admin-u-label-ondark">
                {' '}
                Top: {h.topCategoryTitle}
              </div>{' '}
              <div className="admin-hotspot-stats">
                {' '}
                {h.highPriorityCount > 0 && (
                  <span className="admin-u-warning"> {h.highPriorityCount} High/Crit</span>
                )}
                {h.slaBreachedCount > 0 && (
                  <span className="admin-u-danger"> {h.slaBreachedCount} Breached</span>
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
