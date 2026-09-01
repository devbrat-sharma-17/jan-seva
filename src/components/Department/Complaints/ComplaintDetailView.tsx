// ============================================================
// Department complaint detail
// ============================================================
// Ordered the way an officer reads it: what state is it in, what changed
// last, what is the issue, what does it look like, where is it, why is it
// ranked here, who owns it, how long is left — then the actions.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import {
  describeComplaintAccess,
  assignComplaint,
  startWorkOnComplaint,
  addDepartmentProgressUpdate,
  submitDepartmentResolution,
  acceptDepartmentReinspection,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { getAuditTrailForComplaint, subscribeToAuditTrail } from '../../../services/auditService';
import { explainPriority } from '../../../services/aiService';
import { formatRelative, formatDateLong } from '../../../services/timeService';
import { useComplaintMutation } from '../../../hooks/useComplaintMutation';
import { UnauthorizedPage } from '../../auth/UnauthorizedPage';
import { SkeletonCard } from '../../portal/Skeletons';
import { AssignmentModal } from './AssignmentModal';
import { ProgressUpdateModal } from './ProgressUpdateModal';
import { ResolutionModal } from './ResolutionModal';
import { RepeatFailureBanner } from './RepeatFailureBanner';
import type { CaptureIntegrity } from '../../../types/proof';
import {
  SlaPanel,
  PriorityReasonPanel,
  AiAnalysisPanel,
  DuplicatePanel,
  BeforeAfterEvidence,
  AuditPanel,
} from './DetailPanels';
import type { Complaint } from '../../../types';
import type { AuditEvent } from '../../../types/audit';
import type { DepartmentUser } from '../../../types/department';
import './ComplaintDetailView.css';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; complaint: Complaint }
  | { kind: 'not-found' }
  | { kind: 'forbidden' };

function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ComplaintDetailView() {
  const { complaintId } = useParams<{ complaintId: string }>();
  const navigate = useNavigate();
  const mutation = useComplaintMutation();

  const [user] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);

  /* The scoped lookup answers "not yours" separately from "no such
     record", but only the screen knows that difference — the message the
     user sees still reveals nothing about complaints in other
     departments. */
  const loadComplaint = useCallback(() => {
    if (!complaintId) {
      setLoad({ kind: 'not-found' });
      return;
    }

    const access = describeComplaintAccess(complaintId);
    if (access.kind === 'ok') {
      setLoad({ kind: 'ok', complaint: access.complaint });
    } else if (access.kind === 'forbidden') {
      setLoad({ kind: 'forbidden' });
    } else {
      setLoad({ kind: 'not-found' });
    }
  }, [complaintId]);

  useEffect(() => {
    loadComplaint();
    return subscribeToComplaints(loadComplaint);
  }, [loadComplaint]);

  const departmentId = user?.departmentId;

  useEffect(() => {
    if (!complaintId || !departmentId) return;
    const refresh = () =>
      setAudit(getAuditTrailForComplaint(complaintId, { role: 'department', departmentId }));
    refresh();
    return subscribeToAuditTrail(refresh);
  }, [complaintId, departmentId]);

  const complaint = load.kind === 'ok' ? load.complaint : null;
  const priority = useMemo(
    () => (complaint ? explainPriority(complaint) : null),
    [complaint]
  );

  if (load.kind === 'loading') {
    return (
      <div className="dept-detail">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (load.kind === 'forbidden') {
    return (
      <UnauthorizedPage
        homePath="/department/complaints"
        signInPath="/department/login"
        detail="Your account is scoped to a single department."
      />
    );
  }

  if (load.kind === 'not-found' || !complaint || !user) {
    return (
      <div className="dept-state">
        <h2 className="dept-state__title">Complaint not found</h2>
        <p className="dept-state__desc">
          No complaint with that reference is handled by this department.
        </p>
        <button
          type="button"
          className="dept-action-btn dept-action-btn--secondary"
          onClick={() => navigate('/department/complaints')}
        >
          Back to the queue
        </button>
      </div>
    );
  }

  const deptConfig = getDepartmentConfig(user.departmentId);
  const version = complaint.version;

  // Every action carries the version it was decided against, so a change
  // made from another tab is caught instead of silently overwritten.
  const handleAssign = async (
    officer: { name: string; designation: string; staffId: string; team?: string; phone?: string },
    teamName: string
  ) => {
    await mutation.run('assign', () => assignComplaint(complaint.id, officer, teamName, version), {
      successMessage: `Assigned to ${officer.name}.`,
    });
  };

  const handleStartWork = () =>
    mutation.run('start', () => startWorkOnComplaint(complaint.id, version), {
      successMessage: 'Marked as on-site work in progress.',
    });

  const handleProgressUpdate = async (note: string, photos: string[], isInternal: boolean) => {
    await mutation.run(
      'progress',
      () => addDepartmentProgressUpdate(complaint.id, note, photos, isInternal, version),
      { successMessage: isInternal ? 'Internal note added.' : 'Progress update posted.' }
    );
  };

  const handleResolutionSubmit = async (
    note: string,
    evidencePhotos: string[],
    integrity: CaptureIntegrity[]
  ) => {
    await mutation.run(
      'resolve',
      () => submitDepartmentResolution(complaint.id, note, evidencePhotos, version, integrity),
      { successMessage: 'Resolution submitted. Awaiting citizen verification.' }
    );
  };

  const handleAcceptReinspection = () =>
    mutation.run(
      'reinspect',
      () => acceptDepartmentReinspection(complaint.id, undefined, version),
      { successMessage: 'Reinspection accepted.' }
    );

  const isAssigned = Boolean(complaint.assignedOfficer?.name);
  const isPending = complaint.status === 'pending';
  const isResolved = complaint.status === 'resolved';
  const hasReinspection = Boolean(complaint.feedback?.reinspectionRequested);
  const canWork = complaint.status === 'in-progress' || complaint.status === 'escalated';

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${complaint.location.latitude},${complaint.location.longitude}`;

  const citizenVerified = complaint.resolution?.citizenVerifiedResolved === true;

  return (
    <div className="dept-detail">
      <div className="dept-detail__bar">
        <button type="button" className="dept-back-btn" onClick={() => navigate('/department/complaints')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Queue</span>
        </button>

        <span className="dept-detail__id">{complaint.id}</span>
      </div>

      {/* ---- 1. Status, priority, title ---- */}
      <header className={`dept-detail__head dept-detail__head--${priority?.level ?? 'medium'}`}>
        <div className="dept-detail__pills">
          <span className={`dept-status-pill dept-status-pill--${complaint.status}`}>
            {complaint.status.replace('-', ' ')}
          </span>
          {priority && (
            <span className={`dept-priority-tag dept-priority-tag--${priority.level}`}>
              {priority.level} priority
            </span>
          )}
          {hasReinspection && <span className="dept-flag-pill">Reinspection requested</span>}
        </div>

        <h1 className="dept-detail__title">{complaint.issue.title}</h1>
        <p className="dept-detail__reported">
          Reported {formatRelative(complaint.createdAt)} &middot; {formatDateLong(complaint.createdAt)}
        </p>
      </header>

      {/* A write that was overtaken elsewhere stops here rather than
          landing on top of whatever the other writer did. */}
      {mutation.state.phase === 'conflict' && (
        <div className="dept-alert dept-alert--warning dept-conflict" role="alert">
          <span>
            This complaint was updated elsewhere. Review the latest version before changing it.
          </span>
          <button
            type="button"
            className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm"
            onClick={() => {
              loadComplaint();
              mutation.reset();
            }}
          >
            View latest
          </button>
        </div>
      )}

      {/* Before anything else on the page: has this failed before? An
          officer dispatching a crew needs that answer first, not after
          scrolling past the timeline. */}
      <RepeatFailureBanner complaint={complaint} />

      <div className="dept-detail__grid">
        {/* ================= MAIN COLUMN ================= */}
        <div className="dept-detail__main">
          {/* ---- 2. Latest update ---- */}
          <section className="dept-card dept-detail__latest">
            <h2 className="dept-card__title">Latest update</h2>
            <p className="dept-detail__latest-title">{complaint.latestUpdate.title}</p>
            <p className="dept-detail__latest-desc">{complaint.latestUpdate.description}</p>
            <p className="dept-card__hint">{formatRelative(complaint.latestUpdate.timestamp)}</p>
          </section>

          {/* ---- 3. The issue ---- */}
          <section className="dept-card">
            <h2 className="dept-card__title">Citizen report</h2>
            {/* Rendered as text, never as markup — this is user-supplied
                content and the only safe way to show it. */}
            <blockquote className="dept-detail__quote">{complaint.issue.description}</blockquote>

            <dl className="dept-detail__facts">
              <div>
                <dt>Citizen</dt>
                <dd>{complaint.reporter.name}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                {/* Masked. Department staff need to know a number exists
                    and is verified, not what it is. */}
                <dd>{complaint.reporter.mobileMasked || '+91 XXXXX XXXXX'}</dd>
              </div>
              <div>
                <dt>Verified by</dt>
                <dd>{complaint.reporter.identityMethod === 'aadhaar' ? 'Aadhaar eKYC' : 'Mobile OTP'}</dd>
              </div>
            </dl>
          </section>

          {/* ---- 4. Evidence, before and after ---- */}
          <BeforeAfterEvidence complaint={complaint} />

          {/* ---- 5. Resolution state ---- */}
          {complaint.resolution?.resolvedAt && (
            <section className="dept-card dept-detail__resolution">
              <h2 className="dept-card__title">Resolution</h2>
              <p className="dept-detail__quote">
                {complaint.resolution.resolutionNote || 'Work completed on site.'}
              </p>
              <p className="dept-card__hint">
                Submitted {formatDateLong(complaint.resolution.resolvedAt)} by{' '}
                {complaint.resolution.resolvedBy || 'the field team'}
              </p>

              <p
                className={
                  citizenVerified ? 'dept-alert dept-alert--success' : 'dept-alert dept-alert--warning'
                }
              >
                <span>
                  {citizenVerified
                    ? `Citizen confirmed the fix${complaint.feedback?.rating ? ` and rated it ${complaint.feedback.rating} out of 5` : ''}.`
                    : 'Resolved — awaiting citizen verification from the tracking page.'}
                </span>
              </p>
            </section>
          )}

          {/* ---- 10. Citizen timeline ---- */}
          <section className="dept-card">
            <h2 className="dept-card__title">Timeline &middot; {complaint.timeline.length} entries</h2>

            <ol className="dept-timeline">
              {complaint.timeline.map((evt) => (
                <li
                  key={evt.id}
                  className={`dept-timeline__item${evt.visibility === 'internal' ? ' dept-timeline__item--internal' : ''}`}
                >
                  <span className="dept-timeline__node" aria-hidden="true" />
                  <p className="dept-timeline__title">
                    {evt.title}
                    {evt.visibility === 'internal' && <span className="dept-timeline__badge">Internal</span>}
                  </p>
                  <p className="dept-timeline__desc">{evt.description}</p>

                  {evt.photos && evt.photos.length > 0 && (
                    <div className="dept-timeline__photos">
                      {evt.photos.map((p, i) => (
                        <img key={i} src={p} alt="" loading="lazy" decoding="async" />
                      ))}
                    </div>
                  )}

                  <p className="dept-timeline__meta">
                    {formatDateLong(evt.timestamp)} &middot; {evt.actor || 'System'}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <AuditPanel events={audit} />
        </div>

        {/* ================= CONTEXT RAIL ================= */}
        <aside className="dept-detail__rail">
          {/* ---- 6. Location ---- */}
          <section className="dept-card">
            <h2 className="dept-card__title">
              <PinIcon size={15} />
              Location
            </h2>
            <p className="dept-detail__address">
              {complaint.location.address || complaint.location.locality}, {complaint.location.city},{' '}
              {complaint.location.state}
            </p>
            <p className="dept-detail__coords">
              {complaint.location.latitude.toFixed(5)}, {complaint.location.longitude.toFixed(5)}
            </p>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm dept-action-btn--block"
            >
              <span>Navigate</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          {/* ---- 7. Triage rationale ---- */}
          <AiAnalysisPanel complaint={complaint} />
          <PriorityReasonPanel complaint={complaint} />
          <DuplicatePanel complaint={complaint} />

          {/* ---- 8. Assignment ---- */}
          <section className="dept-card">
            <div className="dept-card__header">
              <h2 className="dept-card__title">Assignment</h2>
              <button
                type="button"
                className="dept-action-btn dept-action-btn--ghost dept-action-btn--sm"
                onClick={() => setIsAssignOpen(true)}
                disabled={isResolved}
              >
                {isAssigned ? 'Reassign' : 'Assign'}
              </button>
            </div>

            <div className="dept-assignee">
              <span className="dept-assignee__avatar" aria-hidden="true">
                {complaint.assignedOfficer?.name ? complaint.assignedOfficer.name[0] : '—'}
              </span>
              <span className="dept-assignee__text">
                <span className="dept-assignee__name">
                  {complaint.assignedOfficer?.name || 'Not yet assigned'}
                </span>
                <span className="dept-assignee__role">
                  {complaint.assignedOfficer?.designation || 'No officer allocated'}
                </span>
                <span className="dept-assignee__team">
                  {complaint.department.assignedTeam || deptConfig.mockTeams[0]}
                </span>
              </span>
            </div>
          </section>

          {/* ---- 9. SLA ---- */}
          <SlaPanel complaint={complaint} />
        </aside>
      </div>

      {/* ---- 11. Actions. Only what this status permits, within thumb
           reach on a phone. ---- */}
      <div className="dept-sticky-actions">
        {mutation.state.phase !== 'idle' && mutation.state.phase !== 'conflict' && (
          <p className={`dept-sticky-actions__state dept-sticky-actions__state--${mutation.state.phase}`} role="status">
            {mutation.state.message}
          </p>
        )}

        {hasReinspection && (
          <button
            type="button"
            className="dept-action-btn dept-action-btn--primary"
            onClick={handleAcceptReinspection}
            disabled={mutation.isBusy}
          >
            {mutation.pendingAction === 'reinspect' ? 'Accepting…' : 'Accept reinspection'}
          </button>
        )}

        {isPending && (
          <button
            type="button"
            className="dept-action-btn dept-action-btn--primary"
            onClick={() => setIsAssignOpen(true)}
            disabled={mutation.isBusy}
          >
            Accept and assign
          </button>
        )}

        {complaint.status === 'assigned' && (
          <button
            type="button"
            className="dept-action-btn dept-action-btn--primary"
            onClick={handleStartWork}
            disabled={mutation.isBusy}
          >
            {mutation.pendingAction === 'start' ? 'Updating…' : 'Start on-site work'}
          </button>
        )}

        {(canWork || hasReinspection) && (
          <>
            <button
              type="button"
              className="dept-action-btn dept-action-btn--secondary"
              onClick={() => setIsProgressOpen(true)}
              disabled={mutation.isBusy}
            >
              Add update
            </button>

            <button
              type="button"
              className="dept-action-btn dept-action-btn--success"
              onClick={() => setIsResolutionOpen(true)}
              disabled={mutation.isBusy}
            >
              Submit resolution
            </button>
          </>
        )}

        {isResolved && !hasReinspection && (
          <p className="dept-sticky-actions__note">
            {citizenVerified ? 'Closed and confirmed by the citizen.' : 'Awaiting citizen verification.'}
          </p>
        )}
      </div>

      <AssignmentModal
        complaint={complaint}
        deptConfig={deptConfig}
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        onAssign={handleAssign}
      />

      <ProgressUpdateModal
        complaint={complaint}
        isOpen={isProgressOpen}
        onClose={() => setIsProgressOpen(false)}
        onSubmitUpdate={handleProgressUpdate}
      />

      <ResolutionModal
        complaint={complaint}
        isOpen={isResolutionOpen}
        onClose={() => setIsResolutionOpen(false)}
        onSubmitResolution={handleResolutionSubmit}
      />
    </div>
  );
}
