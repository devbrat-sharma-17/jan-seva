import React, { useState } from 'react';
import { DeptModal } from './DeptModal';
import { useEvidencePhotos } from '../../../hooks/useEvidencePhotos';
import { EVIDENCE_ACCEPT } from '../../../services/imageService';
import type { Complaint } from '../../../types';

interface ResolutionModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResolution: (note: string, evidencePhotos: string[]) => Promise<void>;
}

const MAX_PHOTOS = 3;

export function ResolutionModal({
  complaint,
  isOpen,
  onClose,
  onSubmitResolution,
}: ResolutionModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evidence = useEvidencePhotos(MAX_PHOTOS);

  /* Dismissing discards the attempt. Keeping compressed photos around
     after a cancel meant reopening the modal on a different complaint
     showed the previous one's evidence. */
  const handleClose = () => {
    setNote('');
    evidence.reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!note.trim()) {
      setError('Describe how the issue was fixed before submitting.');
      return;
    }

    // A stock photo used to be substituted when nothing was attached,
    // which put a stranger's road into a citizen's resolution record.
    // Proof of work is now a real requirement.
    if (evidence.values.length === 0) {
      setError('Attach at least one photo of the completed work.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmitResolution(note.trim(), evidence.values);
      setNote('');
      evidence.reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const message = error ?? evidence.error;

  return (
    <DeptModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Submit the resolution"
      subtitle={`${complaint.id} · ${complaint.issue.title}`}
    >
      <form onSubmit={handleSubmit} className="dept-modal__form">
        {message && (
          <p className="dept-alert dept-alert--error" role="alert">
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
            Evidence photos <span className="dept-field__req">required</span>
          </span>
          <span className="dept-field__hint">
            One to {MAX_PHOTOS} clear shots of the completed work on site.
          </span>

          <div className="dept-photo-upload-row">
            {evidence.photos.map((photo, index) => (
              <div key={index} className="dept-photo-preview-item">
                <img src={photo.dataUrl} alt={`Resolution evidence ${index + 1}`} />
                <button
                  type="button"
                  className="dept-photo-remove-btn"
                  onClick={() => evidence.remove(index)}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}

            {!evidence.atLimit && (
              <label className="dept-photo-upload-btn">
                <input
                  type="file"
                  accept={EVIDENCE_ACCEPT}
                  capture="environment"
                  onChange={(e) => {
                    void evidence.addFiles(e.target.files);
                    e.target.value = '';
                  }}
                  hidden
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>{evidence.busy ? 'Processing…' : 'Add photo'}</span>
              </label>
            )}
          </div>
        </div>

        <p className="dept-alert dept-alert--info">
          <span>
            The citizen&rsquo;s tracking page moves to <strong>resolved — awaiting your
            confirmation</strong>. It is not counted as citizen-verified until they say so.
          </span>
        </p>

        <div className="dept-modal__footer">
          <button type="button" className="dept-modal-btn dept-modal-btn--secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="dept-modal-btn dept-modal-btn--success"
            disabled={submitting || evidence.busy || !note.trim() || evidence.values.length === 0}
          >
            {submitting ? 'Submitting…' : 'Submit resolution'}
          </button>
        </div>
      </form>
    </DeptModal>
  );
}
