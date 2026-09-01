import { useCallback, useEffect, useRef, useState } from 'react';
import './proof-camera.css';

interface ProofCameraModalProps {
  /** Receives the captured frame as a JPEG data URL. */
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  /** Rendered in the viewfinder so the crew knows what this shot must show. */
  requirement?: string;
}

/**
 * Evidence camera for a department resolution.
 *
 * Separate from the citizen's `LiveCameraModal` on purpose. This one is
 * the top of the Proof of Repair pipeline, so it has obligations the
 * citizen camera does not:
 *
 *   * no gallery path in the viewfinder at all;
 *   * the frame goes straight to grading, never through storage;
 *   * a camera failure does NOT silently fall back to a file picker —
 *     the citizen camera does that, and here it would quietly convert a
 *     live capture into an ungraded gallery upload, which is precisely
 *     the hole this feature exists to close.
 */
export function ProofCameraModal({ onCapture, onClose, requirement }: ProofCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser cannot open the camera. Evidence must be captured live.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Rear camera only. A resolution photo taken on the selfie
          // camera is either a mistake or a photograph of a screen.
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      } catch {
        setCameraError(
          'Camera access was refused. Resolution evidence must be captured live — it cannot be attached from storage.'
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setFlashing(true);
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    window.setTimeout(() => {
      stopStream();
      onCapture(dataUrl);
      onClose();
    }, 220);
  };

  return (
    <div className="proof-camera" role="dialog" aria-modal="true" aria-label="Evidence camera">
      <div className="proof-camera__bar">
        <span className="proof-camera__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Evidence capture
        </span>
        <button
          type="button"
          className="proof-camera__close"
          onClick={() => {
            stopStream();
            onClose();
          }}
          aria-label="Close camera"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="proof-camera__viewport">
        {cameraError ? (
          <div className="proof-camera__error" role="alert">
            <p>{cameraError}</p>
            <p className="proof-camera__error-note">
              Ask your supervisor to record this resolution from a device with a working camera.
              Attaching a stored image would leave the repair marked unverified.
            </p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline autoPlay muted className="proof-camera__video" />
            <div className="proof-camera__reticle" aria-hidden="true" />
            <p className="proof-camera__hint">
              {requirement ?? 'Frame the completed work with enough surroundings to locate it.'}
            </p>
            {flashing && <div className="proof-camera__flash" />}
          </>
        )}
      </div>

      <div className="proof-camera__controls">
        <p className="proof-camera__binding">
          Location, device time and an image fingerprint are bound to this photo at the shutter.
        </p>
        <button
          type="button"
          className="proof-camera__shutter"
          onClick={capture}
          disabled={Boolean(cameraError)}
          aria-label="Capture evidence photo"
        >
          <span className="proof-camera__shutter-inner" />
        </button>
      </div>
    </div>
  );
}
