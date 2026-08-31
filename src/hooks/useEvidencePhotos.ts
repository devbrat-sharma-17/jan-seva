// ============================================================
// useEvidencePhotos — validated, compressed field photo capture
// ============================================================
//
// Both department modals took files straight from a FileReader, so an
// unvalidated 40 MB file could be turned into a base64 string and pushed
// into a store shared with every citizen's complaint. Uploads now go
// through `prepareEvidencePhoto`, which checks type, extension and size,
// then downscales — a 4 MB camera photo lands as ~200 KB.

import { useCallback, useState } from 'react';
import { prepareEvidencePhoto, ImageError, formatBytes } from '../services/imageService';

export interface EvidencePhoto {
  /** Compressed data URL, safe to persist. */
  dataUrl: string;
  bytes: number;
  /** "2.4 MB → 210 KB", for the size hint under a thumbnail. */
  savingLabel: string;
}

export interface UseEvidencePhotosResult {
  photos: EvidencePhoto[];
  /** Data URLs only, in order — what the service layer wants. */
  values: string[];
  busy: boolean;
  error: string | null;
  addFiles: (files: FileList | null) => Promise<void>;
  remove: (index: number) => void;
  reset: () => void;
  clearError: () => void;
  atLimit: boolean;
}

export function useEvidencePhotos(maxPhotos = 3): UseEvidencePhotosResult {
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const room = Math.max(0, maxPhotos - photos.length);
      if (room === 0) {
        setError(`You can attach up to ${maxPhotos} photos.`);
        return;
      }

      setBusy(true);
      setError(null);

      const accepted: EvidencePhoto[] = [];
      let firstError: string | null = null;
      const batch = Array.from(files).slice(0, room);

      for (const file of batch) {
        try {
          const compressed = await prepareEvidencePhoto(file);
          accepted.push({
            dataUrl: compressed.dataUrl,
            bytes: compressed.bytes,
            savingLabel: `${formatBytes(compressed.originalBytes)} → ${formatBytes(compressed.bytes)}`,
          });
        } catch (err) {
          // The first rejection is the one worth reporting; a list of
          // five identical complaints about the same bad batch is noise.
          if (!firstError) {
            firstError =
              err instanceof ImageError
                ? err.message
                : 'That photo could not be added. Try another one.';
          }
        }
      }

      if (accepted.length > 0) {
        setPhotos((current) => [...current, ...accepted].slice(0, maxPhotos));
      }
      if (firstError) setError(firstError);
      setBusy(false);
    },
    [maxPhotos, photos.length]
  );

  const remove = useCallback((index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setPhotos([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    photos,
    values: photos.map((p) => p.dataUrl),
    busy,
    error,
    addFiles,
    remove,
    reset,
    clearError,
    atLimit: photos.length >= maxPhotos,
  };
}
