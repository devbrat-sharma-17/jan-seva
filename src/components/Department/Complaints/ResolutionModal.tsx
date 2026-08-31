import React, { useState } from 'react';
import { DeptModal } from './DeptModal';
import type { Complaint } from '../../../types';

interface ResolutionModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResolution: (note: string, evidencePhotos: string[]) => Promise<void>;
}

const MAX_PHOTOS = 3;

/** Stand-in used when a demo session submits without attaching a photo. */
const PLACEHOLDER_EVIDENCE =
  'https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&auto=format&fit=crop&q=80';

export function ResolutionModal({
  complaint,
  isOpen,
  onClose,
  onSubmitResolution,
}: ResolutionModalProps) {
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files)
      .slice(0, MAX_PHOTOS - photos.length)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setPhotos((prev) => [...prev, String(event.target?.result)]);
          }
        };
        reader.readAsDataURL(file);
      });

    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Describe how the issue was fixed before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmitResolution(note.trim(), photos.length > 0 ? photos : [PLACEHOLDER_EVIDENCE]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeptModal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit the resolution"
      subtitle={`${complaint.id} · ${complaint.issue.title}`}
    >
      <form onSubmit={handleSubmit} className="dept-modal__form">
        {error && (
          <p className="dept-alert dept-alert--error" role="alert">
            <span>{error}</span>
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
            onChange={(e) => setNote(e.target.value)}
            required
          />
        </div>

        <div className="dept-field">
          <span className="dept-field__label">Evidence photos</span>
          <span className="dept-field__hint">
            One to {MAX_PHOTOS} clear shots of the completed work on site.
          </span>

          <div className="dept-photo-upload-row">
            {photos.map((photo, index) => (
              <div key={index} className="dept-photo-preview-item">
                <img src={photo} alt={`Resolution evidence ${index + 1}`} />
                <button
                  type="button"
                  className="dept-photo-remove-btn"
                  onClick={() => handleRemovePhoto(index)}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}

            {photos.length < MAX_PHOTOS && (
              <label className="dept-photo-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  hidden
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Add photo</span>
              </label>
            )}
          </div>
        </div>

        <p className="dept-alert dept-alert--info">
          <span>
            The citizen&rsquo;s tracking page moves to <strong>awaiting verification</strong>, and they
            are asked to confirm the fix.
          </span>
        </p>

        <div className="dept-modal__footer">
          <button type="button" className="dept-modal-btn dept-modal-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="dept-modal-btn dept-modal-btn--success"
            disabled={submitting || !note.trim()}
          >
            {submitting ? 'Submitting…' : 'Mark resolved'}
          </button>
        </div>
      </form>
    </DeptModal>
  );
}
