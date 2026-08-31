// ============================================================
// Admin Complaint Detail View — JAN-SEVA Phase 5
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getDepartmentComplaintById,
  reassignComplaintDepartment,
  manualEscalateComplaint,
} from '../../../services/complaintService';
import { addAuditEvent, getAuditTrailForComplaint } from '../../../services/adminService';
import { getCurrentAdminUser } from '../../../services/authService';
import { DEPARTMENTS } from '../../../data/departments';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { formatStamp, formatDateLong } from '../../../services/timeService';
import type { Complaint } from '../../../types';
import type { AdminAuditEvent } from '../../../types/admin';
import type { DepartmentId } from '../../../types/department';
import './AdminComplaintDetail.css';
import { AdminIcon } from '../AdminIcon';

export function AdminComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState<DepartmentId>('roads');
  const [reassignReason, setReassignReason] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  const admin = getCurrentAdminUser() || { id: 'admin-001', name: 'Dr. Rakesh Agrawal' };

  useEffect(() => {
    if (!id) return;
    const found = getDepartmentComplaintById(id);
    setComplaint(found);
    if (found) {
      setAuditEvents(getAuditTrailForComplaint(found.id));
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return <div className="admin-empty-state">Loading complaint details...</div>;
  }

  if (!complaint) {
    return (
      <div className="admin-empty-state">
        {' '}
        <div className="admin-empty-state-icon">
          <AdminIcon name="alert" size={26} />
        </div> <h2>Complaint Not Found</h2>{' '}
        <p>No complaint record matches ID "{id}".</p>{' '}
        <Link to="/admin/complaints" className="admin-detail__back">
          {' '}
          ← Back to All Complaints
        </Link>{' '}
      </div>
    );
  }

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignReason.trim()) return;
    setIsReassigning(true);

    const targetDept = DEPARTMENTS[targetDeptId];
    const updated = await reassignComplaintDepartment(
      complaint.id,
      targetDeptId,
      targetDept.name,
      reassignReason.trim(),
      admin.name,
    );

    if (updated) {
      addAuditEvent(
        admin,
        'department_reassign',
        'complaint',
        complaint.id,
        `Reassigned from ${complaint.department.name} to ${targetDept.name}. Reason: ${reassignReason.trim()}`,
        { fromDept: complaint.department.name, toDept: targetDept.name },
      );
      setComplaint(updated);
      setAuditEvents(getAuditTrailForComplaint(updated.id));
    }

    setIsReassigning(false);
    setShowReassignModal(false);
    setReassignReason('');
  };

  const handleManualEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim()) return;
    setIsEscalating(true);

    const updated = await manualEscalateComplaint(complaint.id, escalateReason.trim(), admin.name);

    if (updated) {
      addAuditEvent(
        admin,
        'manual_escalation',
        'complaint',
        complaint.id,
        `Manually escalated: ${escalateReason.trim()}`,
      );
      setComplaint(updated);
      setAuditEvents(getAuditTrailForComplaint(updated.id));
    }

    setIsEscalating(false);
    setShowEscalateModal(false);
    setEscalateReason('');
  };

  const severity = complaint.aiAnalysis?.severity || 'medium';
  const isBreached =
    complaint.sla.status === 'exceeded' || new Date(complaint.sla.dueAt).getTime() < Date.now();

  return (
    <div className="admin-detail">
      {' '}
      <Link to="/admin/complaints" className="admin-detail__back">
        {' '}
        ← Back to City Complaints
      </Link>{' '}
      {/* Main Header */}
      <div className="admin-detail__header">
        {' '}
        <div>
          {' '}
          <div className="admin-detail__id-row">
            {' '}
            <span className="admin-detail__id">{complaint.id}</span>{' '}
            <StatusPill status={complaint.status} />{' '}
            <span className={`admin-priority-badge admin-priority-badge--${severity}`}>
              {' '}
              {severity} priority
            </span>{' '}
            {isBreached && (
              <span style={{ color: 'var(--red-600)', fontWeight: 700, fontSize: '0.75rem' }}>
                {' '}
                SLA Breached
              </span>
            )}
          </div>{' '}
          <h1 className="admin-detail__title">{complaint.issue.title}</h1>{' '}
          <div className="admin-detail__meta-pills">
            {' '}
            <span> {complaint.location.address || complaint.location.locality}</span> <span>·</span>{' '}
            <span> {complaint.department.name}</span> <span>·</span>{' '}
            <span>Reported {formatStamp(complaint.createdAt)}</span>{' '}
          </div>{' '}
        </div>{' '}
        <div className="admin-detail__actions">
          {' '}
          <button
            type="button"
            className="admin-action-btn admin-action-btn--reassign"
            onClick={() => setShowReassignModal(true)}
          >
            {' '}
            Reassign Department
          </button>{' '}
          {complaint.status !== 'resolved' && (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--escalate"
              onClick={() => setShowEscalateModal(true)}
            >
              {' '}
              Escalate Complaint
            </button>
          )}
        </div>{' '}
      </div>{' '}
      {/* Grid: 2 Columns */}
      <div className="admin-detail__grid">
        {' '}
        {/* Left Column: Description, Photos, Timeline, Resolution */}
        <div className="admin-detail__col">
          {' '}
          {/* Issue & Description */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Report and evidence</div>{' '}
            <p className="admin-detail__desc">{complaint.issue.description}</p>{' '}
            {complaint.photos && complaint.photos.length > 0 && (
              <div className="admin-detail__photos">
                {' '}
                {complaint.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Citizen photo evidence ${i + 1}`}
                    className="admin-detail__photo"
                  />
                ))}
              </div>
            )}
          </div>{' '}
          {/* Resolution Evidence (if resolved) */}
          {complaint.resolution && (
            <div className="admin-panel" style={{ borderLeft: '4px solid var(--color-success)' }}>
              {' '}
              <div className="admin-panel__title" style={{ color: 'var(--green-700)' }}>
                {' '}
                Department Resolution Record
              </div>{' '}
              <p className="admin-detail__desc">
                {' '}
                {complaint.resolution.resolutionNote ||
                  'Work completed on site and verified by field team.'}
              </p>{' '}
              {complaint.resolution.evidencePhotos &&
                complaint.resolution.evidencePhotos.length > 0 && (
                  <div className="admin-detail__photos">
                    {' '}
                    {complaint.resolution.evidencePhotos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Resolution evidence ${i + 1}`}
                        className="admin-detail__photo"
                      />
                    ))}
                  </div>
                )}
              <div className="admin-info-list" style={{ marginTop: '1rem' }}>
                {' '}
                <div className="admin-info-item">
                  {' '}
                  <span className="admin-info-label">Resolved At:</span>{' '}
                  <span className="admin-info-value">
                    {' '}
                    {complaint.resolution.resolvedAt
                      ? formatDateLong(complaint.resolution.resolvedAt)
                      : '—'}
                  </span>{' '}
                </div>{' '}
                <div className="admin-info-item">
                  {' '}
                  <span className="admin-info-label">Citizen Verification Status:</span>{' '}
                  <span
                    className="admin-info-value"
                    style={{
                      color: complaint.resolution.citizenVerifiedResolved ? 'var(--green-500)' : 'var(--amber-600)',
                    }}
                  >
                    {' '}
                    {complaint.resolution.citizenVerifiedResolved
                      ? '✓ Confirmed by Citizen'
                      : 'Pending Citizen Verification'}
                  </span>{' '}
                </div>{' '}
              </div>{' '}
            </div>
          )}
          {/* Citizen Feedback */}
          {complaint.feedback && (
            <div className="admin-panel">
              {' '}
              <div className="admin-panel__title">Citizen feedback</div>{' '}
              <div className="admin-info-list">
                {' '}
                {complaint.feedback.rating && (
                  <div className="admin-info-item">
                    {' '}
                    <span className="admin-info-label">Citizen Rating:</span>{' '}
                    <span
                      className="admin-info-value"
                      style={{ color: 'var(--color-warning)', fontSize: '1rem' }}
                    >
                      {' '}
                      {'★'.repeat(complaint.feedback.rating)}
                      {'☆'.repeat(5 - complaint.feedback.rating)} ({complaint.feedback.rating} / 5)
                    </span>{' '}
                  </div>
                )}
                {complaint.feedback.comment && (
                  <div className="admin-info-item">
                    {' '}
                    <span className="admin-info-label">Citizen Comment:</span>{' '}
                    <span className="admin-info-value">"{complaint.feedback.comment}"</span>{' '}
                  </div>
                )}
                {complaint.feedback.reinspectionRequested && (
                  <div className="admin-info-item" style={{ color: 'var(--red-600)' }}>
                    {' '}
                    <span className="admin-info-label">Reinspection Flag:</span>{' '}
                    <span className="admin-info-value">
                      {' '}
                      Reinspection Requested by Citizen
                    </span>{' '}
                  </div>
                )}
              </div>{' '}
            </div>
          )}
          {/* Citizen-Facing Public Timeline */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Public timeline</div>{' '}
            <div className="admin-audit-trail">
              {' '}
              {complaint.timeline.map((evt) => (
                <div
                  key={evt.id}
                  className="admin-audit-event"
                  style={{ borderLeftColor: 'var(--color-civic-blue)' }}
                >
                  {' '}
                  <div className="admin-audit-header">
                    {' '}
                    <span>{evt.title}</span>{' '}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>
                      {' '}
                      {formatStamp(evt.timestamp)}
                    </span>{' '}
                  </div>{' '}
                  <div className="admin-audit-desc">{evt.description}</div>{' '}
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {' '}
                    Actor: {evt.actor || 'System'}
                  </div>{' '}
                </div>
              ))}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        {/* Right Column: Admin Audit, Routing, Officer, SLA, Privacy Info */}
        <div className="admin-detail__col">
          {' '}
          {/* Admin Audit Trail (SEPARATE from citizen timeline) */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Audit log</div>{' '}
            {auditEvents.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', margin: 0 }}>
                {' '}
                No administrative interventions recorded for this complaint yet.
              </p>
            ) : (
              <div className="admin-audit-trail">
                {' '}
                {auditEvents.map((evt) => (
                  <div key={evt.id} className="admin-audit-event">
                    {' '}
                    <div className="admin-audit-header">
                      {' '}
                      <span>{evt.action.replace('_', ' ').toUpperCase()}</span>{' '}
                      <span style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>
                        {' '}
                        {formatStamp(evt.timestamp)}
                      </span>{' '}
                    </div>{' '}
                    <div className="admin-audit-desc">{evt.description}</div>{' '}
                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {' '}
                      By: {evt.adminName}
                    </div>{' '}
                  </div>
                ))}
              </div>
            )}
          </div>{' '}
          {/* AI Routing & Severity */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Automatic triage</div>{' '}
            <div className="admin-info-list">
              {' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Category:</span>{' '}
                <span className="admin-info-value">
                  {complaint.aiAnalysis?.categoryTitle || complaint.issue.category}
                </span>{' '}
              </div>{' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Assessed Severity:</span>{' '}
                <span className="admin-info-value">{severity.toUpperCase()}</span>{' '}
              </div>{' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Priority Score:</span>{' '}
                <span className="admin-info-value">
                  {complaint.aiAnalysis?.priorityScore || 70} / 100
                </span>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
          {/* Operational SLA */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Service level</div>{' '}
            <div className="admin-info-list">
              {' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">SLA Target Due:</span>{' '}
                <span className="admin-info-value">{formatStamp(complaint.sla.dueAt)}</span>{' '}
              </div>{' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Status:</span>{' '}
                <span
                  className="admin-info-value"
                  style={{ color: isBreached ? 'var(--red-600)' : 'var(--green-500)' }}
                >
                  {' '}
                  {isBreached ? 'Breached' : 'On track'}
                </span>{' '}
              </div>{' '}
              {complaint.assignedOfficer && (
                <div className="admin-info-item">
                  {' '}
                  <span className="admin-info-label">Assigned Officer:</span>{' '}
                  <span className="admin-info-value">{complaint.assignedOfficer.name}</span>{' '}
                </div>
              )}
            </div>{' '}
          </div>{' '}
          {/* Citizen Privacy Info (Permission-controlled, masked only) */}
          <div className="admin-panel">
            {' '}
            <div className="admin-panel__title">Reporter identity</div>{' '}
            <div className="admin-info-list">
              {' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Citizen Name:</span>{' '}
                <span className="admin-info-value">{complaint.reporter.name}</span>{' '}
              </div>{' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Verification:</span>{' '}
                <span className="admin-info-value" style={{ color: 'var(--green-500)' }}>
                  {' '}
                  ✓{' '}
                  {complaint.reporter.identityMethod === 'aadhaar'
                    ? 'Aadhaar Verified'
                    : 'OTP Verified'}
                </span>{' '}
              </div>{' '}
              <div className="admin-info-item">
                {' '}
                <span className="admin-info-label">Masked Contact:</span>{' '}
                <span className="admin-info-value">
                  {complaint.reporter.identityLabel || complaint.reporter.mobileMasked}
                </span>{' '}
              </div>{' '}
            </div>{' '}
            <p style={{ fontSize: '0.6875rem', color: 'var(--slate-400)', margin: '0.75rem 0 0' }}>
              {' '}
              Aadhaar and raw mobile numbers are masked for citizen privacy per statutory
              compliance.
            </p>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="admin-modal-overlay" onClick={() => setShowReassignModal(false)}>
          {' '}
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            {' '}
            <h3 className="admin-modal-title">Reassign Complaint Department</h3>{' '}
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {' '}
              Transfer ticket {complaint.id} to another municipal department. This action will be
              logged in the admin audit trail.
            </p>{' '}
            <form className="admin-modal-form" onSubmit={handleReassign}>
              {' '}
              <div className="admin-modal-field">
                {' '}
                <label>Select Target Department</label>{' '}
                <select
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value as DepartmentId)}
                >
                  {' '}
                  {Object.values(DEPARTMENTS).map((d) => (
                    <option key={d.id} value={d.id}>
                      {' '}
                      {d.name} ({d.shortName})
                    </option>
                  ))}
                </select>{' '}
              </div>{' '}
              <div className="admin-modal-field">
                {' '}
                <label>Reason for Transfer</label>{' '}
                <textarea
                  rows={3}
                  placeholder="e.g. Issue involves water supply pipeline leakage rather than road pavement fault..."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  required
                />{' '}
              </div>{' '}
              <div className="admin-modal-actions">
                {' '}
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setShowReassignModal(false)}
                >
                  {' '}
                  Cancel
                </button>{' '}
                <button
                  type="submit"
                  className="admin-action-btn admin-action-btn--reassign"
                  disabled={isReassigning || !reassignReason.trim()}
                >
                  {' '}
                  {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>{' '}
              </div>{' '}
            </form>{' '}
          </div>{' '}
        </div>
      )}
      {/* Manual Escalate Modal */}
      {showEscalateModal && (
        <div className="admin-modal-overlay" onClick={() => setShowEscalateModal(false)}>
          {' '}
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            {' '}
            <h3 className="admin-modal-title">Manual Administrative Escalation</h3>{' '}
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {' '}
              Escalate {complaint.id} directly to the Municipal Commissioner and Department Head.
            </p>{' '}
            <form className="admin-modal-form" onSubmit={handleManualEscalate}>
              {' '}
              <div className="admin-modal-field">
                {' '}
                <label>Escalation Justification</label>{' '}
                <textarea
                  rows={3}
                  placeholder="e.g. Critical safety hazard near school premises requiring urgent executive oversight..."
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  required
                />{' '}
              </div>{' '}
              <div className="admin-modal-actions">
                {' '}
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => setShowEscalateModal(false)}
                >
                  {' '}
                  Cancel
                </button>{' '}
                <button
                  type="submit"
                  className="admin-action-btn admin-action-btn--escalate"
                  disabled={isEscalating || !escalateReason.trim()}
                >
                  {' '}
                  {isEscalating ? 'Escalating...' : 'Trigger Escalation'}
                </button>{' '}
              </div>{' '}
            </form>{' '}
          </div>{' '}
        </div>
      )}
    </div>
  );
}
