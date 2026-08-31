import React, { useState } from 'react';
import { DeptModal } from './DeptModal';
import type { Complaint } from '../../../types';

interface ProgressUpdateModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onSubmitUpdate: (note: string, photos: string[], isInternal: boolean) => Promise<void>;
}

const MAX_PHOTOS = 3;

export function ProgressUpdateModal({
  complaint,
  isOpen,
  onClose,
  onSubmitUpdate,
}: ProgressUpdateModalProps) {
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

    // Let the same file be picked again after it is removed.
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    setSubmitting(true);
    try {
      await onSubmitUpdate(note.trim(), photos, isInternal);
      setNote('');
      setPhotos([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeptModal
      isOpen={isOpen}
      onClose={onClose}
      title="Post a progress update"
      subtitle={`${complaint.id} · ${complaint.issue.title}`}
    >
      <form onSubmit={handleSubmit} className="dept-modal__form">
        <div className="dept-field">
          <label className="dept-field__label" htmlFor="progress-note">
            Field log
          </label>
          <textarea
            id="progress-note"
            className="dept-form-textarea"
            rows={3}
            placeholder="On-site inspection completed. Resurfacing crew deployed with materials…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />
        </div>

        <div className="dept-field">
          <span className="dept-field__label">Field photos</span>
          <span className="dept-field__hint">Optional · up to {MAX_PHOTOS}</span>

          <div className="dept-photo-upload-row">
            {photos.map((photo, index) => (
              <div key={index} className="dept-photo-preview-item">
                <img src={photo} alt={`Field update ${index + 1}`} />
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

        <div className="dept-form-checkbox-row">
          <input
            type="checkbox"
            id="internal-switch"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
          />
          <label htmlFor="internal-switch">
            Internal note — hidden from the citizen&rsquo;s tracking page
          </label>
        </div>

        <div className="dept-modal__footer">
          <button type="button" className="dept-modal-btn dept-modal-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="dept-modal-btn dept-modal-btn--primary"
            disabled={submitting || !note.trim()}
          >
            {submitting ? 'Posting…' : 'Post update'}
          </button>
        </div>
      </form>
    </DeptModal>
  );
}
