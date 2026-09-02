import React, { useRef, useState } from 'react';
import type { ReportPhoto } from '../../../types/report';
import { LiveCameraModal } from './LiveCameraModal';
import { compressImage, ImageError, formatBytes } from '../../../services/imageService';
import { useTranslation } from '../../../hooks/useTranslation';
import './PhotoStep.css';

interface PhotoStepProps {
  photos: ReportPhoto[];
  onAddPhoto: (photo: ReportPhoto) => void;
  onRemovePhoto: (id: string) => void;
  onReplacePhoto: (id: string, newPhoto: ReportPhoto) => void;
}

export function PhotoStep({
  photos,
  onAddPhoto,
  onRemovePhoto,
  onReplacePhoto,
}: PhotoStepProps) {
  const { t } = useTranslation();
  /* One input, and it asks for the camera. The gallery picker and the
     separate "replace from storage" picker are gone: evidence for a civic
     complaint is photographed at the issue, not chosen from a camera roll
     (spec §1, §3). This input is only reached when getUserMedia is
     unavailable, and `capture="environment"` makes it a camera request —
     which is an intent the browser may honour, not a guarantee (spec §2). */
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /**
   * Compresses each selected file before it enters the draft.
   */
  const processFiles = async (fileList: FileList | null, isReplacing = false) => {
    if (!fileList || fileList.length === 0) return;

    const availableSlots = 3 - photos.length;
    const filesToProcess = isReplacing
      ? [fileList[0]]
      : Array.from(fileList).slice(0, availableSlots);

    if (!isReplacing && fileList.length > availableSlots) {
      setPhotoError(`Only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} can be added.`);
    } else {
      setPhotoError(null);
    }

    setIsCompressing(true);
    try {
      for (const file of filesToProcess) {
        try {
          const compressed = await compressImage(file);
          const newPhoto: ReportPhoto = {
            id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            url: compressed.dataUrl,
            name: file.name,
            size: compressed.bytes,
            timestamp: Date.now(),
            /* The only file input left asks for the camera, so this is a
               camera intent — recorded as exactly that and no stronger. */
            captureMethod: 'NATIVE_CAMERA_INTENT',
            capturedAtClient: new Date().toISOString(),
          };

          if (isReplacing && replacingPhotoId) {
            onReplacePhoto(replacingPhotoId, newPhoto);
            setReplacingPhotoId(null);
          } else {
            onAddPhoto(newPhoto);
            setSelectedPhotoIndex(photos.length);
          }
        } catch (err) {
          setPhotoError(
            err instanceof ImageError ? err.message : 'That photo could not be added. Please try another.'
          );
        }
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processFiles(e.target.files, replacingPhotoId !== null);
    if (e.target) e.target.value = '';
  };

  const triggerCamera = () => {
    setIsLiveCameraOpen(true);
  };

  const triggerFallbackFileInput = () => {
    cameraInputRef.current?.click();
  };

  /* Replacing a photo takes another photo. It used to open the file
     picker, which made "replace" the one path in the wizard that could
     still attach anything on the device. */
  const triggerReplace = (photoId: string) => {
    setReplacingPhotoId(photoId);
    setIsLiveCameraOpen(true);
  };

  const activePhoto = photos[selectedPhotoIndex] || photos[0];

  return (
    <div className="photo-step">
      {/* Camera fallback only, used when the in-app viewfinder cannot run. */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        style={{ display: 'none' }}
        id="native-camera-input"
      />

      <div className="step-heading">
        <h2 className="step-heading__title">{t('report.photo.title')}</h2>
        <p className="step-heading__subtitle">{t('report.photo.subtitle')}</p>
      </div>

      {photoError && (
        <div className="step-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{photoError}</span>
        </div>
      )}

      {isCompressing && (
        <div className="photo-compressing" role="status">
          <span className="photo-compressing__spinner" aria-hidden="true" />
          <span>{t('report.photo.optimising')}</span>
        </div>
      )}

      {/* When NO photos yet */}
      {photos.length === 0 ? (
        <div className="photo-picker-box">
          <div className="photo-picker-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>

          <div className="photo-actions-group">
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={triggerCamera}
              disabled={isCompressing}
              id="btn-take-photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{t('report.photo.takePhoto')}</span>
            </button>

            <p className="photo-capture-note">{t('report.photo.cameraOnly')}</p>
          </div>
        </div>
      ) : (
        /* When Photos Exist */
        <div className="photo-tray">
          {/* Main Large Preview */}
          {activePhoto && (
            <div className="photo-main-preview">
              <img
                src={activePhoto.url}
                alt="Selected issue preview"
                className="photo-main-preview__img"
              />
              <div className="photo-main-preview__badge">
                {t('report.photo.photoCount')
                  .replace('{current}', String(selectedPhotoIndex + 1))
                  .replace('{total}', String(photos.length))}
                {typeof activePhoto.size === 'number' && (
                  <span className="photo-size-hint"> &middot; {formatBytes(activePhoto.size)}</span>
                )}
              </div>
              <div className="photo-main-preview__controls">
                <button
                  type="button"
                  className="photo-btn-icon"
                  onClick={() => triggerReplace(activePhoto.id)}
                  title={t('report.photo.replace')}
                  aria-label={t('report.photo.replace')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="photo-btn-icon photo-btn-icon--delete"
                  onClick={() => {
                    onRemovePhoto(activePhoto.id);
                    if (selectedPhotoIndex > 0) setSelectedPhotoIndex(selectedPhotoIndex - 1);
                  }}
                  title={t('report.photo.delete')}
                  aria-label={t('report.photo.delete')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Thumbnails strip & Add button */}
          <div className="photo-thumbnails-strip">
            {photos.map((p, idx) => (
              <div
                key={p.id}
                className={`photo-thumb-card ${selectedPhotoIndex === idx ? 'photo-thumb-card--active' : ''}`}
                onClick={() => setSelectedPhotoIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPhotoIndex(idx);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedPhotoIndex === idx}
                aria-label={`View photo ${idx + 1}`}
              >
                <img src={p.url} alt="" className="photo-thumb-card__img" />
                <button
                  type="button"
                  className="photo-thumb-card__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePhoto(p.id);
                    if (selectedPhotoIndex >= photos.length - 1 && selectedPhotoIndex > 0) {
                      setSelectedPhotoIndex(selectedPhotoIndex - 1);
                    }
                  }}
                  aria-label={t('report.photo.delete')}
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Add another photo slot if < 3 */}
            {photos.length < 3 && (
              <button
                type="button"
                className="photo-add-thumb-btn"
                onClick={triggerCamera}
                id="btn-add-another-photo"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{t('report.photo.addAnother')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Single Clear Guidance Tip */}
      <div className="photo-tip-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>{t('report.photo.title')}:</strong> {t('report.photo.tip')}
        </span>
      </div>

      {/* Live Camera Viewfinder Modal */}
      {isLiveCameraOpen && (
        <LiveCameraModal
          onCapture={(newPhoto) => {
            if (replacingPhotoId) {
              onReplacePhoto(replacingPhotoId, newPhoto);
              setReplacingPhotoId(null);
            } else {
              onAddPhoto(newPhoto);
              setSelectedPhotoIndex(photos.length);
            }
            setIsLiveCameraOpen(false);
          }}
          onClose={() => {
            setIsLiveCameraOpen(false);
            setReplacingPhotoId(null);
          }}
          onFallbackToFile={triggerFallbackFileInput}
        />
      )}
    </div>
  );
}


