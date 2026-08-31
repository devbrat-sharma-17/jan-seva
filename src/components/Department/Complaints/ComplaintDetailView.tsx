import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getCurrentDepartmentUser } from '../../../services/authService';
import { getDepartmentConfig } from '../../../data/departments';
import {
  getDepartmentComplaintById,
  assignComplaint,
  startWorkOnComplaint,
  addDepartmentProgressUpdate,
  submitDepartmentResolution,
  acceptDepartmentReinspection,
  subscribeToComplaints,
} from '../../../services/complaintService';
import { explainPriority } from '../../../services/aiService';
import { formatRelative, formatDateLong } from '../../../services/timeService';
import { AssignmentModal } from './AssignmentModal';
import { ProgressUpdateModal } from './ProgressUpdateModal';
import { ResolutionModal } from './ResolutionModal';
import type { Complaint } from '../../../types';
import type { DepartmentUser } from '../../../types/department';
import './ComplaintDetailView.css';

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

  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, []);

  const loadComplaint = () => {
    if (!complaintId) return;
    setComplaint(getDepartmentComplaintById(complaintId));
    setLoading(false);
  };

  useEffect(() => {
    loadComplaint();
    const unsubscribe = subscribeToComplaints(loadComplaint);
    return () => unsubscribe();
  }, [complaintId]);

  if (loading) {
    return <div className="dept-loading">Loading {complaintId}</div>;
  }

  if (!complaint || !user) {
    return (
      <div className="dept-state">
        <h2 className="dept-state__title">Complaint not found</h2>
        <p className="dept-state__desc">
          {complaintId} does not exist in this department, or its record has expired.
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
  const priority = explainPriority(complaint);

  const handleAssign = async (
    officer: { name: string; designation: string; staffId: string; team?: string; phone?: string },
    teamName: string
  ) => {
    await assignComplaint(complaint.id, officer, teamName, user.name);
    loadComplaint();
  };

  const handleStartWork = async () => {
    await startWorkOnComplaint(complaint.id, user.name);
    loadComplaint();
  };

  const handleProgressUpdate = async (note: string, photos: string[], isInternal: boolean) => {
    await addDepartmentProgressUpdate(complaint.id, note, photos, isInternal, user.name);
    loadComplaint();
  };

  const handleResolutionSubmit = async (note: string, evidencePhotos: string[]) => {
    await submitDepartmentResolution(complaint.id, note, evidencePhotos, user.name);
    loadComplaint();
  };

  const handleAcceptReinspection = async () => {
    await acceptDepartmentReinspection(complaint.id, 'Reinspection accepted. Field crew redeployed.', user.name);
    loadComplaint();
  };

  const isAssigned = Boolean(complaint.assignedOfficer?.name);
  const isPending = complaint.status === 'pending';
  const isInProgress = complaint.status === 'in-progress';
  const isResolved = complaint.status === 'resolved';
  const hasReinspection = Boolean(complaint.feedback?.reinspectionRequested);

  const slaTone =
    complaint.sla.status === 'exceeded' ? 'breached' : complaint.sla.status === 'approaching' ? 'atrisk' : 'normal';

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${complaint.location.latitude},${complaint.location.longitude}`;

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

      {/* ---- Title block. Status, priority and the SLA flag are the three
           things read first, so they sit above the title. ---- */}
      <header className={`dept-detail__head dept-detail__head--${priority.level}`}>
        <div className="dept-detail__pills">
          <span className={`dept-status-pill dept-status-pill--${complaint.status}`}>
            {complaint.status.replace('-', ' ')}
          </span>
          <span className={`dept-priority-tag dept-priority-tag--${priority.level}`}>
            {priority.level} priority
          </span>
          {complaint.sla.status === 'exceeded' && (
            <span className="dept-sla-pill dept-sla-pill--breached">SLA breached</span>
          )}
          {hasReinspection && <span className="dept-flag-pill">Reinspection requested</span>}
        </div>

        <h1 className="dept-detail__title">{complaint.issue.title}</h1>
        <p className="dept-detail__reported">
          Reported {formatRelative(complaint.createdAt)} &middot; {formatDateLong(complaint.createdAt)}
        </p>
      </header>

      <div className="dept-detail__grid">
        {/* ================= MAIN COLUMN ================= */}
        <div className="dept-detail__main">
          <section className="dept-card dept-detail__latest">
            <h2 className="dept-card__title">Latest update</h2>
            <p className="dept-detail__latest-title">{complaint.latestUpdate.title}</p>
            <p className="dept-detail__latest-desc">{complaint.latestUpdate.description}</p>
            <p className="dept-card__hint">{formatRelative(complaint.latestUpdate.timestamp)}</p>
          </section>

          <section className="dept-card">
            <h2 className="dept-card__title">Citizen report</h2>
            <blockquote className="dept-detail__quote">{complaint.issue.description}</blockquote>

            {complaint.photos.length > 0 && (
              <div className="dept-photo-gallery">
                {complaint.photos.map((photo, idx) => (
                  <a
                    key={idx}
                    href={photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dept-gallery-img"
                  >
                    <img src={photo} alt={`Reported evidence ${idx + 1}`} loading="lazy" />
                  </a>
                ))}
              </div>
            )}

            <dl className="dept-detail__facts">
              <div>
                <dt>Citizen</dt>
                <dd>{complaint.reporter.name}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{complaint.reporter.mobileMasked || '+91 XXXXX XXXXX'}</dd>
              </div>
              <div>
                <dt>Verified by</dt>
                <dd>{complaint.reporter.identityMethod === 'aadhaar' ? 'Aadhaar eKYC' : 'Mobile OTP'}</dd>
              </div>
            </dl>
          </section>

          {complaint.resolution && (
            <section className="dept-card dept-detail__resolution">
              <h2 className="dept-card__title">Resolution evidence</h2>
              <p className="dept-detail__quote">
                {complaint.resolution.resolutionNote || 'Work completed on site.'}
              </p>

              {complaint.resolution.evidencePhotos && complaint.resolution.evidencePhotos.length > 0 && (
                <div className="dept-photo-gallery">
                  {complaint.resolution.evidencePhotos.map((photo, i) => (
                    <a
                      key={i}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dept-gallery-img"
                    >
                      <img src={photo} alt={`Resolution evidence ${i + 1}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              )}

              <p className="dept-card__hint">
                Closed {formatDateLong(complaint.resolution.resolvedAt || complaint.updatedAt)} by{' '}
                {complaint.resolution.resolvedBy || 'the field team'}
              </p>

              <p
                className={
                  complaint.resolution.citizenVerifiedResolved
                    ? 'dept-alert dept-alert--success'
                    : 'dept-alert dept-alert--warning'
                }
              >
                <span>
                  {complaint.resolution.citizenVerifiedResolved
                    ? `Citizen confirmed the fix — rated ${complaint.feedback?.rating ?? 5} out of 5.`
                    : 'Awaiting citizen confirmation from the tracking page.'}
                </span>
              </p>
            </section>
          )}

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
                        <img key={i} src={p} alt="" loading="lazy" />
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
        </div>

        {/* ================= CONTEXT RAIL ================= */}
        <aside className="dept-detail__rail">
          <section className={`dept-card dept-sla-card dept-sla-card--${slaTone}`}>
            <h2 className="dept-card__title">Service level</h2>
            <p className="dept-sla-card__state">
              {complaint.sla.status === 'exceeded'
                ? 'Past deadline'
                : complaint.sla.status === 'approaching'
                ? 'Under 6 hours left'
                : 'On track'}
            </p>
            <p className="dept-sla-card__due">
              Due {formatRelative(complaint.sla.dueAt)}
              <span>{formatDateLong(complaint.sla.dueAt)}</span>
            </p>
          </section>

          <section className="dept-card">
            <div className="dept-card__header">
              <h2 className="dept-card__title">Assignment</h2>
              <button
                type="button"
                className="dept-action-btn dept-action-btn--ghost dept-action-btn--sm"
                onClick={() => setIsAssignOpen(true)}
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
              <span>Open in Maps</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </section>

          <section className="dept-card dept-ai-card">
            <div className="dept-card__header">
              <h2 className="dept-card__title">Automatic triage</h2>
              <span className="dept-ai-card__tag">AI</span>
            </div>

            <dl className="dept-ai-card__facts">
              <div>
                <dt>Category</dt>
                <dd>{complaint.aiAnalysis?.categoryTitle || complaint.issue.category}</dd>
              </div>
              <div>
                <dt>Severity</dt>
                <dd>{complaint.aiAnalysis?.severity ?? 'medium'}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{complaint.aiAnalysis?.priorityScore ?? 85} / 99</dd>
              </div>
            </dl>

            <p className="dept-ai-card__lead">Why it ranks {priority.level}</p>
            <ul className="dept-ai-card__reasons">
              {priority.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* ---- Actions. Only what this status permits, so the bar is never
           four buttons wide on a phone. ---- */}
      <div className="dept-sticky-actions">
        {hasReinspection && (
          <button type="button" className="dept-action-btn dept-action-btn--primary" onClick={handleAcceptReinspection}>
            Accept reinspection
          </button>
        )}

        {isPending && (
          <button type="button" className="dept-action-btn dept-action-btn--primary" onClick={() => setIsAssignOpen(true)}>
            Accept and assign
          </button>
        )}

        {complaint.status === 'assigned' && (
          <button type="button" className="dept-action-btn dept-action-btn--primary" onClick={handleStartWork}>
            Start on-site work
          </button>
        )}

        {(isInProgress || complaint.status === 'assigned' || hasReinspection) && (
          <>
            <button
              type="button"
              className="dept-action-btn dept-action-btn--secondary"
              onClick={() => setIsProgressOpen(true)}
            >
              Add progress log
            </button>

            <button
              type="button"
              className="dept-action-btn dept-action-btn--success"
              onClick={() => setIsResolutionOpen(true)}
            >
              Mark resolved
            </button>
          </>
        )}

        {isResolved && !hasReinspection && (
          <p className="dept-sticky-actions__note">Resolution submitted and recorded.</p>
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
