// ============================================================
// Admin complaint detail
// ============================================================
// The administrator's questions are different from the department's:
// is this where it should be, is it moving, and who has touched it.
// Reassignment and escalation both change who is accountable, so both
// go through a confirmation that records a written reason.

import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  describeComplaintAccess,
  reassignComplaintDepartment,
  manualEscalateComplaint,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { getAuditTrailForComplaint, subscribeToAuditTrail, AUDIT_ACTION_LABELS } from '../../../services/auditService';
import { computeSlaHealth } from '../../../services/slaService';
import { explainPriority } from '../../../services/aiService';
import { useComplaintMutation } from '../../../hooks/useComplaintMutation';
import { DEPARTMENTS } from '../../../data/departments';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { ConfirmDialog } from '../../portal/ConfirmDialog';
import { SkeletonCard } from '../../portal/Skeletons';
import { BeforeAfterEvidence } from '../../Department/Complaints/DetailPanels';
import { formatStamp, formatDateLong } from '../../../services/timeService';
import type { Complaint } from '../../../types';
import type { AuditEvent } from '../../../types/audit';
import type { DepartmentId } from '../../../types/department';
import './AdminComplaintDetail.css';
import { AdminIcon } from '../AdminIcon';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; complaint: Complaint }
  | { kind: 'missing' };

export function AdminComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const mutation = useComplaintMutation();

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [showReassign, setShowReassign] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState<DepartmentId>('roads');
  const [showEscalate, setShowEscalate] = useState(false);

  const loadComplaint = useCallback(() => {
    if (!id) {
      setLoad({ kind: 'missing' });
      return;
    }
    const access = describeComplaintAccess(id);
    setLoad(access.kind === 'ok' ? { kind: 'ok', complaint: access.complaint } : { kind: 'missing' });
  }, [id]);

  useEffect(() => {
    loadComplaint();
    return subscribeToComplaints(loadComplaint);
  }, [loadComplaint]);

  useEffect(() => {
    if (!id) return;
    const refresh = () => setAuditEvents(getAuditTrailForComplaint(id, { role: 'admin' }));
    refresh();
    return subscribeToAuditTrail(refresh);
  }, [id]);

  if (load.kind === 'loading') {
    return (
      <div className="admin-detail">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (load.kind === 'missing') {
    return (
      <div className="admin-empty-state">
        <div className="admin-empty-state-icon">
          <AdminIcon name="alert" size={26} />
        </div>
        <h2>Complaint not found</h2>
        <p>No complaint record matches that reference.</p>
        <Link to="/admin/complaints" className="admin-detail__back">
          &larr; Back to all complaints
        </Link>
      </div>
    );
  }

  const complaint = load.complaint;
  const priority = explainPriority(complaint);
  const health = computeSlaHealth(complaint);
  const severity = complaint.aiAnalysis?.severity || 'medium';
  const currentDept = DEPARTMENTS[(complaint.department.id || 'roads') as DepartmentId];

  const handleReassign = async (reason: string) => {
    const target = DEPARTMENTS[targetDeptId];
    const result = await mutation.run(
      'reassign',
      () =>
        reassignComplaintDepartment(
          complaint.id,
          targetDeptId,
          target.name,
          reason,
          complaint.version
        ),
      { successMessage: `Reassigned to ${target.name}.` }
    );
    if (result.ok) setShowReassign(false);
  };

  const handleEscalate = async (reason: string) => {
    const result = await mutation.run(
      'escalate',
      () => manualEscalateComplaint(complaint.id, reason, complaint.version),
      { successMessage: 'Escalated to the Municipal Commissioner.' }
    );
    if (result.ok) setShowEscalate(false);
  };

  const slaLabel =
    health?.status === 'exceeded'
      ? `Breached — exceeded by ${health.label}`
      : health?.status === 'approaching'
      ? `At risk — ${health.label} remaining`
      : health?.status === 'met'
      ? 'Met'
      : health
      ? `On track — ${health.label} remaining`
      : 'No target set';

  return (
    <div className="admin-detail">
      <Link to="/admin/complaints" className="admin-detail__back">
        &larr; Back to city complaints
      </Link>

      {/* ---------- Header ---------- */}
      <div className="admin-detail__header">
        <div>
          <div className="admin-detail__id-row">
            <span className="admin-detail__id">{complaint.id}</span>
            <StatusPill status={complaint.status} />
            <span className={`admin-priority-badge admin-priority-badge--${severity}`}>
              {severity} severity
            </span>
            {health?.status === 'exceeded' && (
              <span className="admin-detail__breach">SLA breached</span>
            )}
          </div>

          <h1 className="admin-detail__title">{complaint.issue.title}</h1>

          <div className="admin-detail__meta-pills">
            <span>{complaint.location.address || complaint.location.locality}</span>
            <span>&middot;</span>
            <span>{complaint.department.name}</span>
            <span>&middot;</span>
            <span>Reported {formatStamp(complaint.createdAt)}</span>
          </div>
        </div>

        <div className="admin-detail__actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--reassign"
            onClick={() => setShowReassign(true)}
            disabled={mutation.isBusy}
          >
            Reassign department
          </button>

          {complaint.status !== 'resolved' && (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--escalate"
              onClick={() => setShowEscalate(true)}
              disabled={mutation.isBusy}
            >
              Escalate
            </button>
          )}
        </div>
      </div>

      {mutation.state.phase !== 'idle' && (
        <p className={`admin-detail__mutation admin-detail__mutation--${mutation.state.phase}`} role="status">
          {mutation.state.message}
          {mutation.state.phase === 'conflict' && (
            <button
              type="button"
              className="admin-action-btn admin-action-btn--sm"
              onClick={() => {
                loadComplaint();
                mutation.reset();
              }}
            >
              View latest
            </button>
          )}
        </p>
      )}

      {/* ---------- Body ---------- */}
      <div className="admin-detail__grid">
        <div className="admin-detail__col">
          <div className="admin-panel">
            <div className="admin-panel__title">Citizen report</div>
            {/* Plain text. This is user-supplied content. */}
            <p className="admin-detail__desc">{complaint.issue.description}</p>
          </div>

          <BeforeAfterEvidence complaint={complaint} />

          {complaint.resolution?.resolvedAt && (
            <div className="admin-panel admin-panel--resolved">
              <div className="admin-panel__title">Resolution record</div>
              <p className="admin-detail__desc">
                {complaint.resolution.resolutionNote || 'Work completed on site.'}
              </p>

              <div className="admin-info-list">
                <div className="admin-info-item">
                  <span className="admin-info-label">Submitted</span>
                  <span className="admin-info-value">
                    {formatDateLong(complaint.resolution.resolvedAt)}
                  </span>
                </div>
                <div className="admin-info-item">
                  <span className="admin-info-label">Citizen verification</span>
                  <span
                    className={`admin-info-value${
                      complaint.resolution.citizenVerifiedResolved
                        ? ' admin-info-value--good'
                        : ' admin-info-value--pending'
                    }`}
                  >
                    {complaint.resolution.citizenVerifiedResolved
                      ? 'Confirmed by the citizen'
                      : 'Awaiting citizen confirmation'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {complaint.feedback && (complaint.feedback.rating || complaint.feedback.comment) && (
            <div className="admin-panel">
              <div className="admin-panel__title">Citizen feedback</div>
              <div className="admin-info-list">
                {complaint.feedback.rating && (
                  <div className="admin-info-item">
                    <span className="admin-info-label">Rating</span>
                    <span className="admin-info-value">{complaint.feedback.rating} out of 5</span>
                  </div>
                )}
                {complaint.feedback.comment && (
                  <div className="admin-info-item">
                    <span className="admin-info-label">Comment</span>
                    <span className="admin-info-value">{complaint.feedback.comment}</span>
                  </div>
                )}
                {complaint.feedback.reinspectionRequested && (
                  <div className="admin-info-item admin-info-item--flag">
                    <span className="admin-info-label">Reinspection</span>
                    <span className="admin-info-value">Requested by the citizen</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="admin-panel">
            <div className="admin-panel__title">Public timeline</div>
            <p className="admin-panel__note">What the citizen sees on their tracking page.</p>
            <div className="admin-audit-trail">
              {complaint.timeline
                .filter((evt) => evt.visibility !== 'internal')
                .map((evt) => (
                  <div key={evt.id} className="admin-audit-event admin-audit-event--public">
                    <div className="admin-audit-header">
                      <span>{evt.title}</span>
                      <span className="admin-audit-time">{formatStamp(evt.timestamp)}</span>
                    </div>
                    <div className="admin-audit-desc">{evt.description}</div>
                    <div className="admin-audit-actor">{evt.actor || 'System'}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="admin-detail__col">
          {/* Internal accountability record, never shown to the citizen. */}
          <div className="admin-panel">
            <div className="admin-panel__title">Audit log</div>
            <p className="admin-panel__note">
              Internal record of every action taken on this complaint.
            </p>

            {auditEvents.length === 0 ? (
              <p className="admin-panel__empty">No recorded actions yet.</p>
            ) : (
              <div className="admin-audit-trail">
                {auditEvents.map((evt) => (
                  <div key={evt.id} className="admin-audit-event">
                    <div className="admin-audit-header">
                      <span>{AUDIT_ACTION_LABELS[evt.action]}</span>
                      <span className="admin-audit-time">{formatStamp(evt.timestamp)}</span>
                    </div>
                    <div className="admin-audit-desc">{evt.description}</div>
                    <div className="admin-audit-actor">{evt.actorName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel">
            <div className="admin-panel__title-row">
              <span className="admin-panel__title">Automated triage</span>
              <span className="demo-tag">Demo AI</span>
            </div>
            <div className="admin-info-list">
              <div className="admin-info-item">
                <span className="admin-info-label">Category</span>
                <span className="admin-info-value">
                  {complaint.aiAnalysis?.categoryTitle || complaint.issue.category}
                </span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Severity</span>
                <span className="admin-info-value">{severity}</span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Priority</span>
                <span className="admin-info-value">{priority.level}</span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Confidence</span>
                <span className="admin-info-value">
                  {complaint.aiAnalysis?.confidenceScore
                    ? `${Math.round(complaint.aiAnalysis.confidenceScore)}%`
                    : '—'}
                </span>
              </div>
            </div>

            <p className="admin-panel__note">Why it ranks {priority.level}:</p>
            <ul className="admin-reason-list">
              {priority.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__title">Service level</div>
            <div className="admin-info-list">
              <div className="admin-info-item">
                <span className="admin-info-label">Status</span>
                <span
                  className={`admin-info-value${
                    health?.status === 'exceeded' ? ' admin-info-value--bad' : ' admin-info-value--good'
                  }`}
                >
                  {slaLabel}
                </span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Target</span>
                <span className="admin-info-value">{formatStamp(complaint.sla.dueAt)}</span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Assigned officer</span>
                <span className="admin-info-value">
                  {complaint.assignedOfficer?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Identity, masked. Administrators are entitled to know a
              complaint is genuine and verified; they are not entitled to
              the underlying Aadhaar or phone number, which this build
              never stores in a reversible form. */}
          <div className="admin-panel">
            <div className="admin-panel__title">Reporter</div>
            <div className="admin-info-list">
              <div className="admin-info-item">
                <span className="admin-info-label">Name</span>
                <span className="admin-info-value">{complaint.reporter.name}</span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Verification</span>
                <span className="admin-info-value admin-info-value--good">
                  {complaint.reporter.identityMethod === 'aadhaar'
                    ? 'Aadhaar eKYC verified'
                    : 'Mobile OTP verified'}
                </span>
              </div>
              <div className="admin-info-item">
                <span className="admin-info-label">Contact</span>
                <span className="admin-info-value">
                  {complaint.reporter.identityLabel || complaint.reporter.mobileMasked || '—'}
                </span>
              </div>
            </div>

            <p className="admin-panel__note">
              Aadhaar and mobile numbers are shown masked. The full values are not held by this
              system.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showReassign}
        title="Reassign this complaint?"
        description={`${complaint.id} moves to a different department. The citizen sees the transfer on their tracking page.`}
        fields={[
          { label: 'From', value: currentDept?.name ?? complaint.department.name },
          { label: 'To', value: DEPARTMENTS[targetDeptId].name },
        ]}
        requireReason
        reasonLabel="Reason for transfer"
        reasonPlaceholder="e.g. The fault is a supply pipeline leak, not road surface damage."
        confirmLabel="Confirm reassignment"
        busy={mutation.pendingAction === 'reassign'}
        onCancel={() => setShowReassign(false)}
        onConfirm={handleReassign}
      >
        <div className="pdialog__field">
          <label className="pdialog__label" htmlFor="reassign-target">
            Target department
          </label>
          <select
            id="reassign-target"
            className="admin-select"
            value={targetDeptId}
            onChange={(e) => setTargetDeptId(e.target.value as DepartmentId)}
          >
            {Object.values(DEPARTMENTS).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showEscalate}
        title="Escalate this complaint?"
        description={`${complaint.id} is raised to the Municipal Commissioner and the department head.`}
        requireReason
        reasonLabel="Escalation justification"
        reasonPlaceholder="e.g. Safety hazard outside a school; needs executive oversight today."
        confirmLabel="Escalate"
        tone="danger"
        busy={mutation.pendingAction === 'escalate'}
        onCancel={() => setShowEscalate(false)}
        onConfirm={handleEscalate}
      />
    </div>
  );
}
