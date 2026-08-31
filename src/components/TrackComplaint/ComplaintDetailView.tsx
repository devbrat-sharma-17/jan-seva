import { useState } from 'react';
import type { Complaint, PublicComplaint } from '../../types';
import { LatestUpdateCard } from './LatestUpdateCard';
import { ComplaintTimeline } from './ComplaintTimeline';
import { OfficerContactCard } from './OfficerContactCard';
import { ResolutionVerificationCard } from './ResolutionVerificationCard';
import { EvidenceGallery } from './EvidenceGallery';
import { ReceiptModal } from './ReceiptModal';
import { IdentityVerification } from './IdentityVerification';
import { StatusPill } from './StatusPill';
import { SyncBar } from './SyncBar';
import { LocationCard } from './LocationCard';
import { StickyAction } from './StickyAction';
import { requestUpdate } from '../../services/complaintService';
import { computeSlaHealth, slaToneClass } from '../../services/slaService';
import { buildShareMessage, timeUntilExpiry } from '../../services/privacyService';
import { formatDate, displayRelative, formatDuration } from '../../services/timeService';
import { useIdentitySession } from '../../hooks/useIdentitySession';
import { useToast } from '../ui/Toast';

interface ComplaintDetailViewProps {
  /** Always present. The redacted projection is what renders by default. */
  complaint: PublicComplaint;
  /** Present only when the viewer has verified as this complaint's reporter. */
  verifiedComplaint: Complaint | null;
  refreshing: boolean;
  lastSyncedAt: number | null;
  clockTick: number;
  onRefresh: () => void;
}

export function ComplaintDetailView({
  complaint,
  verifiedComplaint,
  refreshing,
  lastSyncedAt,
  clockTick,
  onRefresh,
}: ComplaintDetailViewProps) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [unlockPurpose, setUnlockPurpose] = useState<'photos' | 'details' | null>(null);
  const [busy, setBusy] = useState(false);
  const { identity } = useIdentitySession();
  const { showToast } = useToast();

  const isVerifiedView = verifiedComplaint !== null;

  // SLA is derived from `dueAt` against the clock on every render;
  // `clockTick` is what re-runs it on each minute boundary. The public
  // projection satisfies `SlaSubject`, so the countdown is identical in
  // both views without reaching for the full record.
  const sla = computeSlaHealth(complaint, Date.now());
  void clockTick;

  const expiresIn = verifiedComplaint ? timeUntilExpiry(verifiedComplaint) : null;

  const trackingUrl = `${window.location.origin}/track?id=${complaint.id}`;

  const handleRequestUpdate = async () => {
    setBusy(true);
    try {
      const { complaint: updated, throttled } = await requestUpdate(complaint.id);
      if (!updated) {
        showToast('That complaint could no longer be found.', 'error');
        return;
      }
      showToast(
        throttled
          ? 'You already requested an update today. The department has been notified.'
          : 'Update request sent. The concerned department has been notified.',
        throttled ? 'info' : 'success'
      );
      onRefresh();
    } catch {
      showToast('Could not send that request. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsAppShare = () => {
    // Built from the public projection, so a forwarded message can never
    // carry the reporter's name, number or coordinates.
    const text = buildShareMessage(complaint, trackingUrl);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      showToast('Tracking link copied.', 'success');
    } catch {
      // Clipboard access is blocked outside a secure context and in some
      // in-app browsers; show the link rather than failing silently.
      showToast(`Copy this link: ${trackingUrl}`, 'warning');
    }
  };

  // A single contextual sticky action, chosen by what the citizen can
  // actually do right now. Never two competing full-width buttons.
  const awaitingConfirmation =
    complaint.status === 'resolved' && !complaint.resolution?.citizenVerifiedResolved;

  if (unlockPurpose) {
    return (
      <div className="track-stack">
        <IdentityVerification
          purpose={unlockPurpose}
          onVerified={() => {
            setUnlockPurpose(null);
            onRefresh();
            showToast('Verified. Your complaint details are unlocked.', 'success');
          }}
          onCancel={() => setUnlockPurpose(null)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="detail-layout">
        {/* ---------------- Primary column ---------------- */}
        <div className="detail-primary">
          <SyncBar refreshing={refreshing} lastSyncedAt={lastSyncedAt} onRefresh={onRefresh} />

          {/* 1. Complaint ID + status */}
          <section className="complaint-head" aria-label="Complaint summary">
            <div className="complaint-head__row">
              <div>
                <span className="complaint-head__label">Complaint</span>
                <div className="complaint-head__id">{complaint.id}</div>
              </div>
              <StatusPill status={complaint.status} />
            </div>

            <h2 className="complaint-head__title">{complaint.issue.title}</h2>
            <p className="complaint-head__area">
              {complaint.area.locality}, {complaint.area.city}
            </p>
            <p className="complaint-head__desc">{complaint.issue.description}</p>

            <p className="complaint-head__updated">
              Last updated {displayRelative(complaint.updatedAt)}
            </p>
          </section>

          {/* Retention warning for the verified owner */}
          {isVerifiedView && expiresIn !== null && expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000 && (
            <div className="retention-note" role="status">
              Public tracking for this resolved complaint ends in {formatDuration(expiresIn)}.
            </div>
          )}

          {/* 2. Latest update */}
          <LatestUpdateCard
            title={complaint.latestUpdate.title}
            description={complaint.latestUpdate.description}
            timestamp={complaint.latestUpdate.timestamp}
          />

          {/* 3. Timeline */}
          <ComplaintTimeline currentStatus={complaint.status} events={complaint.timeline} />

          {/* 4. SLA */}
          {sla && (
            <div className={`sla-card ${slaToneClass(sla.status)}`}>
              <div className="sla-card__body">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sla-card__icon"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div className="sla-card__text">
                  <div className="sla-card__headline">{sla.headline}</div>
                  <div className="sla-card__detail">
                    {sla.status === 'exceeded'
                      ? 'This complaint has been automatically escalated for further attention.'
                      : `Target completion by ${formatDate(complaint.sla.dueAt)}.`}
                  </div>
                  {sla.status !== 'met' && (
                    <div
                      className="sla-meter"
                      role="progressbar"
                      aria-valuenow={Math.round(sla.progress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Share of the resolution window elapsed"
                    >
                      <div className="sla-meter__fill" style={{ width: `${sla.progress * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Secondary column ---------------- */}
        <div className="detail-secondary">
          {/* 5. Location */}
          <LocationCard
            area={complaint.area}
            exactLocation={verifiedComplaint?.location ?? null}
            onVerify={() => setUnlockPurpose('details')}
          />

          {/* 6 + 9. Reported photos and resolution evidence */}
          <EvidenceGallery
            publicComplaint={complaint}
            verifiedComplaint={verifiedComplaint}
            onVerify={() => setUnlockPurpose('photos')}
          />

          {/* Duplicate linkage */}
          {complaint.duplicate?.isLinked && (
            <div className="linked-dup-banner">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <div>
                <strong>Linked to an existing issue.</strong> This report is merged with ticket{' '}
                {complaint.duplicate.primaryIssueId}
                {complaint.duplicate.supportingCount
                  ? ` — ${complaint.duplicate.supportingCount} citizens have reported it.`
                  : '.'}{' '}
                More confirmations raise its priority.
              </div>
            </div>
          )}

          {/* 7. Department & officer */}
          <OfficerContactCard
            departmentName={complaint.department.name}
            division={complaint.department.division}
            helpline={complaint.department.helpline}
            officerName={complaint.assignedOfficer?.name}
            officerDesignation={complaint.assignedOfficer?.designation}
          />

          {/* 8. Citizen actions */}
          <div className="track-action-grid">
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={handleWhatsAppShare}
              id="btn-whatsapp-share"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="icon-whatsapp"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span>Share on WhatsApp</span>
            </button>

            {/* 11. Receipt */}
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={() => setShowReceipt(true)}
              id="btn-open-receipt"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Download receipt</span>
            </button>
          </div>

          <button type="button" className="report-btn report-btn--outline" onClick={handleCopyLink}>
            Copy tracking link
          </button>

          {/* 10. Resolution verification — verified citizens only */}
          <ResolutionVerificationCard
            complaint={complaint}
            verifiedComplaint={verifiedComplaint}
            identityReference={identity?.reference}
            onVerifyIdentity={() => setUnlockPurpose('details')}
            onChanged={onRefresh}
          />
        </div>
      </div>

      {/* One sticky action, matched to the current state. */}
      {awaitingConfirmation ? (
        <StickyAction
          label="CONFIRM RESOLUTION"
          hint={isVerifiedView ? 'Tell us whether the issue is fixed' : 'Verify to confirm'}
          onClick={() => {
            if (!isVerifiedView) {
              setUnlockPurpose('details');
              return;
            }
            document
              .getElementById('resolution-verification')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      ) : complaint.status !== 'resolved' ? (
        <StickyAction
          label={busy ? 'SENDING…' : 'REQUEST AN UPDATE'}
          hint="Notifies the assigned department"
          disabled={busy}
          onClick={() => void handleRequestUpdate()}
        />
      ) : null}

      {showReceipt && <ReceiptModal complaint={complaint} onClose={() => setShowReceipt(false)} />}
    </>
  );
}
