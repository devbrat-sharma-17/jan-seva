import { useEffect, useState } from 'react';
import type { Complaint, PublicComplaint } from '../../types';

interface EvidenceGalleryProps {
  publicComplaint: PublicComplaint;
  /** Non-null only for the verified reporter — carries the originals. */
  verifiedComplaint: Complaint | null;
  onVerify: () => void;
}

type Tab = 'reported' | 'resolution';

/**
 * Photos are the most sensitive thing a complaint carries: a street-level
 * shot routinely includes faces, number plates, house numbers and doorways.
 *
 * Publicly they are shown blurred — enough to tell a pothole from an
 * overflowing bin, which is what a status check needs, and not enough to
 * identify a person or a house. Originals require verification.
 */
export function EvidenceGallery({
  publicComplaint,
  verifiedComplaint,
  onVerify,
}: EvidenceGalleryProps) {
  const isVerified = verifiedComplaint !== null;

  const reported = isVerified ? verifiedComplaint.photos : publicComplaint.protectedPhotos;
  const resolution = isVerified
    ? verifiedComplaint.resolution?.evidencePhotos ?? []
    : publicComplaint.protectedResolutionPhotos;

  const hasResolution = resolution.length > 0;
  const [activeTab, setActiveTab] = useState<Tab>('reported');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Escape closes the lightbox. Click-only dismissal leaves keyboard users
  // stuck inside a full-screen overlay.
  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedPhoto]);

  if (reported.length === 0 && !hasResolution) return null;

  const photos = activeTab === 'reported' ? reported : resolution;
  const tabLabel = activeTab === 'reported' ? 'reported' : 'resolution';

  return (
    <div className="evidence-card">
      <div className="evidence-card__head">
        <span className="review-card-title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Photo evidence
        </span>

        {hasResolution && (
          <div className="evidence-toggle" role="group" aria-label="Choose photo set">
            <button
              type="button"
              className="evidence-toggle__btn"
              aria-pressed={activeTab === 'reported'}
              onClick={() => setActiveTab('reported')}
            >
              Before ({reported.length})
            </button>
            <button
              type="button"
              className="evidence-toggle__btn evidence-toggle__btn--after"
              aria-pressed={activeTab === 'resolution'}
              onClick={() => setActiveTab('resolution')}
            >
              After ({resolution.length})
            </button>
          </div>
        )}
      </div>

      <div className="evidence-strip">
        {photos.map((url, idx) =>
          isVerified ? (
            <button
              key={`${tabLabel}-${idx}`}
              type="button"
              className="evidence-thumb"
              onClick={() => setSelectedPhoto(url)}
              aria-label={`Open ${tabLabel} photo ${idx + 1} of ${photos.length}`}
            >
              <img src={url} alt="" className="evidence-thumb__img" loading="lazy" />
            </button>
          ) : (
            <div
              key={`${tabLabel}-${idx}`}
              className="evidence-thumb evidence-thumb--protected"
              aria-label={`Protected ${tabLabel} photo ${idx + 1} of ${photos.length}`}
              role="img"
            >
              {/* The blur is a CSS filter over a lazily loaded image, so the
                  shape of the issue survives while the detail does not. */}
              <img src={url} alt="" className="evidence-thumb__img evidence-thumb__img--blurred" loading="lazy" />
              <span className="evidence-thumb__lock" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
            </div>
          )
        )}
      </div>

      {!isVerified && (
        <button type="button" className="evidence-unlock" onClick={onVerify} id="btn-verify-photos">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>VERIFY TO VIEW PHOTOS</span>
        </button>
      )}

      {!isVerified && (
        <p className="evidence-note">
          Photos are protected to keep people and property in the frame private.
        </p>
      )}

      {selectedPhoto && (
        <div
          className="evidence-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            className="evidence-lightbox__close"
            onClick={() => setSelectedPhoto(null)}
            aria-label="Close photo"
            autoFocus
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img src={selectedPhoto} alt="Full size evidence" className="evidence-lightbox__img" />
        </div>
      )}
    </div>
  );
}
