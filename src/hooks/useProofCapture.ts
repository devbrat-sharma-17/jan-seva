// ============================================================
// useProofCapture — graded evidence capture for a resolution
// ============================================================
//
// Holds the state the capture modal needs and, importantly, the two
// references the device-clock check depends on:
//
//   sessionStartedMs  wall clock when the capture session opened
//   performance.now() monotonic time since then
//
// Comparing the two is what makes a changed device clock detectable at
// all. A timestamp taken from `Date.now()` alone proves nothing, because
// `Date.now()` is exactly what an officer would change.

import { useCallback, useRef, useState } from 'react';
import type { CaptureIntegrity } from '../types/proof';
import type { LatLng } from '../services/geoService';
import { gradeCapture, isSubmittable } from '../services/proofService';
import { compressImage, ImageError } from '../services/imageService';

export interface ProofPhoto {
  dataUrl: string;
  integrity: CaptureIntegrity;
  /** False when it came from the gallery — kept so the UI can explain why. */
  liveCapture: boolean;
}

export interface UseProofCaptureResult {
  photos: ProofPhoto[];
  /** Data URLs, in order — what the service layer wants. */
  values: string[];
  integrities: CaptureIntegrity[];
  busy: boolean;
  error: string | null;
  /** True when at least one attached photo failed a blocking check. */
  hasBlocked: boolean;
  addCapture: (dataUrl: string, live: boolean) => Promise<void>;
  addFromFile: (file: File) => Promise<void>;
  remove: (index: number) => void;
  reset: () => void;
  clearError: () => void;
  atLimit: boolean;
}

export interface ProofCaptureOptions {
  /** The complaint's confirmed coordinates — what capture location is checked against. */
  reportedAt: LatLng;
  complaintId: string;
  maxPhotos?: number;
}

export function useProofCapture(options: ProofCaptureOptions): UseProofCaptureResult {
  const maxPhotos = options.maxPhotos ?? 3;

  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captured once, when the hook mounts, and never rewritten.
  const sessionStartedMs = useRef(Date.now());
  const sessionOrigin = useRef(
    typeof performance !== 'undefined' ? performance.now() : 0
  );

  const readPosition = useCallback(
    (): Promise<{ coords: LatLng | null; accuracy?: number }> =>
      new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve({ coords: null });
          return;
        }

        // A capture must not hang on a device that will never get a fix.
        // Timing out into "no location available" is a real, reported
        // outcome that downgrades the grade to `unverified` — it does
        // not silently pass.
        const timer = setTimeout(() => resolve({ coords: null }), 6000);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timer);
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
              accuracy: position.coords.accuracy,
            });
          },
          () => {
            clearTimeout(timer);
            resolve({ coords: null });
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }),
    []
  );

  const addCapture = useCallback(
    async (dataUrl: string, live: boolean) => {
      if (photos.length >= maxPhotos) {
        setError(`You can attach up to ${maxPhotos} photos.`);
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const position = await readPosition();

        const integrity = await gradeCapture(dataUrl, {
          liveCapture: live,
          capturedAt: position.coords,
          accuracyMetres: position.accuracy,
          reportedAt: options.reportedAt,
          deviceTimeMs: Date.now(),
          sessionStartedMs: sessionStartedMs.current,
          sessionElapsedMs:
            typeof performance !== 'undefined'
              ? performance.now() - sessionOrigin.current
              : undefined,
          complaintId: options.complaintId,
        });

        setPhotos((current) => [...current, { dataUrl, integrity, liveCapture: live }]);

        // Say why immediately. Discovering the refusal only at submit,
        // after writing a resolution note, is the sort of thing that
        // makes field staff stop using the tool.
        if (!isSubmittable(integrity)) {
          const blocking = integrity.checks.find(
            (c) => c.severity === 'blocking' && c.passed === false
          );
          setError(blocking?.detail ?? 'This photo failed a provenance check.');
        }
      } catch {
        setError('That photo could not be processed. Try capturing it again.');
      } finally {
        setBusy(false);
      }
    },
    [maxPhotos, options.complaintId, options.reportedAt, photos.length, readPosition]
  );

  /**
   * The gallery path.
   *
   * Deliberately NOT removed. An absent button teaches nobody anything;
   * a button that accepts the file, grades it and then refuses it with a
   * reason teaches the officer exactly what the rule is — and shows a
   * reviewer that the rule is enforced rather than merely stated.
   */
  const addFromFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const compressed = await compressImage(file);
        await addCapture(compressed.dataUrl, false);
      } catch (err) {
        setError(
          err instanceof ImageError ? err.message : 'That file could not be read as a photo.'
        );
        setBusy(false);
      }
    },
    [addCapture]
  );

  const remove = useCallback((index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setPhotos([]);
    setError(null);
  }, []);

  return {
    photos,
    values: photos.map((p) => p.dataUrl),
    integrities: photos.map((p) => p.integrity),
    busy,
    error,
    hasBlocked: photos.some((p) => !isSubmittable(p.integrity)),
    addCapture,
    addFromFile,
    remove,
    reset,
    clearError: () => setError(null),
    atLimit: photos.length >= maxPhotos,
  };
}
