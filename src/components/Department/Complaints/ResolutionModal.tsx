import React, { useState } from 'react';
import { DeptModal } from './DeptModal';
import { useProofCapture } from '../../../hooks/useProofCapture';
import { ProofCameraModal } from '../../proof/ProofCameraModal';
import { IntegrityBadge, IntegrityChecklist } from '../../proof/IntegrityBadge';
import { CAPTURE_RADIUS_METRES } from '../../../services/proofService';
import { EVIDENCE_ACCEPT } from '../../../services/imageService';
import type { CaptureIntegrity } from '../../../types/proof';
import type { Complaint } from '../../../types';

interface ResolutionModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResolution: (
    note: string,
    evidencePhotos: string[],
    integrity: CaptureIntegrity[]
  ) => Promise<void>;
}

const MAX_PHOTOS = 3;

/**
 * Submit a resolution — with proof.
 *
 * The previous version accepted any file that passed MIME, extension,
 * size and dimension checks. A screenshot of last month's photo passed
 * all four, which is exactly how a Gurugram sanitary inspector closed
 * grievances with AI-generated images of cleaned dumping sites in July
 * 2026 — caught only because a citizen complained about the same
 * garbage again.
 *
 * Now every photo is captured live and graded at the shutter, the grade
 * is visible before the officer commits, and a photo that fails a
 * blocking check cannot be submitted at all.
 */
export function ResolutionModal({
  complaint,
  isOpen,
  onClose,
  onSubmitResolution,
}: ResolutionModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const capture = useProofCapture({
    reportedAt: {
      latitude: complaint.location.latitude,
      longitude: complaint.location.longitude,
    },
    complaintId: complaint.id,
    maxPhotos: MAX_PHOTOS,
  });

  const handleClose = () => {
    setNote('');
    setExpanded(null);
    capture.reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!note.trim()) {
      setError('Describe how the issue was fixed before submitting.');
      return;
    }
    if (capture.values.length === 0) {
      setError('Capture at least one photo of the completed work.');
      return;
    }
    if (capture.hasBlocked) {
      setError('Remove the photo that failed its provenance check before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmitResolution(note.trim(), capture.values, capture.integrities);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const message = error ?? capture.error;
  const blocked = capture.hasBlocked;

  return (
    <>
      <DeptModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Submit the resolution"
        subtitle={`${complaint.id} · ${complaint.issue.title}`}
      >
        <form onSubmit={handleSubmit} className="dept-modal__form">
          {message && (
            <p className={`dept-alert dept-alert--${blocked ? 'error' : 'warning'}`} role="alert">
              <span>{message}</span>
            </p>
          )}

          <div className="dept-field">
            <label className="dept-field__label" htmlFor="resolution-note">
              What was done
            </label>
            <textarea
              id="resolution-note"
              className="dept-form-textarea"
              rows={3}
              placeholder="Pothole excavated, backfilled and resurfaced with hot-mix asphalt. Lane reopened to traffic…"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </div>

          <div className="dept-field">
            <span className="dept-field__label">
              Evidence photos <span className="dept-field__req">captured live</span>
            </span>
            <span className="dept-field__hint">
              Up to {MAX_PHOTOS} shots of the completed work, taken here, now, within{' '}
              {CAPTURE_RADIUS_METRES} m of the reported location.
            </span>

            <div className="proof-evidence-list">
              {capture.photos.map((photo, index) => (
                <div key={index} className="proof-evidence">
                  <img src={photo.dataUrl} alt={`Resolution evidence ${index + 1}`} />

                  <div className="proof-evidence__meta">
                    <IntegrityBadge grade={photo.integrity.grade} size="sm" />
                    <p className="proof-evidence__summary">{photo.integrity.summary}</p>
                    <button
                      type="button"
                      className="proof-evidence__toggle"
                      onClick={() => setExpanded(expanded === index ? null : index)}
                      aria-expanded={expanded === index}
                    >
                      {expanded === index ? 'Hide checks' : 'Show all 5 checks'}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="proof-evidence__remove"
                    onClick={() => {
                      capture.remove(index);
                      if (expanded === index) setExpanded(null);
                    }}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    ✕
                  </button>

                  {expanded === index && (
                    <div className="proof-evidence__checks">
                      <IntegrityChecklist integrity={photo.integrity} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!capture.atLimit && (
              <div className="proof-capture-actions">
                <button
                  type="button"
                  className="proof-capture-btn"
                  onClick={() => setCameraOpen(true)}
                  disabled={capture.busy}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>{capture.busy ? 'Checking…' : 'Open evidence camera'}</span>
                </button>

                {/* ----------------------------------------------------
                    The gallery path is kept and refused, not hidden.
                    An absent button teaches nobody the rule. A button
                    that accepts the file, grades it and then explains
                    why it cannot close a complaint teaches the officer
                    exactly what is required — and shows a reviewer that
                    the rule is enforced rather than merely stated.
                    ---------------------------------------------------- */}
                <label className="proof-capture-btn proof-capture-btn--ghost">
                  <input
                    type="file"
                    accept={EVIDENCE_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void capture.addFromFile(file);
                      e.target.value = '';
                    }}
                    hidden
                  />
                  <span>Attach from storage</span>
                  <span className="proof-capture-btn__tag">will not verify</span>
                </label>
              </div>
            )}
          </div>

          <p className="dept-alert dept-alert--info">
            <span>
              The citizen&rsquo;s tracking page moves to <strong>resolved — awaiting your
              confirmation</strong>, and this repair is written to the asset&rsquo;s permanent
              ledger. It is not counted as citizen-verified until they say so.
            </span>
          </p>

          <div className="dept-modal__footer">
            <button
              type="button"
              className="dept-modal-btn dept-modal-btn--secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dept-modal-btn dept-modal-btn--success"
              disabled={
                submitting || capture.busy || blocked || !note.trim() || capture.values.length === 0
              }
            >
              {submitting ? 'Submitting…' : 'Submit resolution'}
            </button>
          </div>
        </form>
      </DeptModal>

      {cameraOpen && (
        <ProofCameraModal
          onClose={() => setCameraOpen(false)}
          onCapture={(dataUrl) => void capture.addCapture(dataUrl, true)}
          requirement={`Show the completed work at ${complaint.location.locality}, with enough surroundings to place it.`}
        />
      )}
    </>
  );
}
