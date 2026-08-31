// ============================================================
// Image Service — Client-side downscale & compression
// ============================================================
// A photo straight off a phone camera is 3-8 MB. Base64 inflates it
// by a further ~33%, so a single untouched photo overruns the ~5 MB
// localStorage budget and the complaint silently fails to persist.
// Everything the citizen captures passes through here first.

/** Longest edge, in px, kept after downscaling. Plenty for a pothole. */
const MAX_EDGE = 1600;
/** JPEG quality. 0.72 is the knee of the size/artefact curve for photos. */
const JPEG_QUALITY = 0.72;
/** Reject anything above this before we even try to decode it. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
/** Target ceiling for the encoded result. We re-encode down to meet it. */
const MAX_OUTPUT_BYTES = 900 * 1024;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export interface CompressedImage {
  /** `data:image/jpeg;base64,...` — safe to persist. */
  dataUrl: string;
  /** Byte length of the encoded result, not of the original file. */
  bytes: number;
  width: number;
  height: number;
  /** Original file size, so the UI can show what was saved. */
  originalBytes: number;
}

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Rough byte length of a data URL without allocating a second copy. */
function dataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return dataUrl.length;
  const base64 = dataUrl.length - commaIndex - 1;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.floor((base64 * 3) / 4) - padding;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // The bitmap is decoded and held by the element; the blob URL is spent.
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageError('That file could not be opened as an image. Try another photo.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Validates, downscales and re-encodes a captured photo.
 * Throws `ImageError` with a message safe to show the citizen.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file) throw new ImageError('No photo was selected.');

  const type = (file.type || '').toLowerCase();
  if (type && !ACCEPTED_TYPES.includes(type)) {
    throw new ImageError('Please choose a photo (JPG, PNG or WEBP).');
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError('That photo is too large. Please choose one under 20 MB.');
  }

  const img = await loadImage(file);
  const { naturalWidth: srcW, naturalHeight: srcH } = img;

  if (!srcW || !srcH) {
    throw new ImageError('That photo appears to be empty or corrupted.');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  let width = Math.round(srcW * scale);
  let height = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Your browser could not process this photo.');

  const render = (w: number, h: number, quality: number): string => {
    canvas.width = w;
    canvas.height = h;
    // White matte: JPEG has no alpha, and transparent PNGs would go black.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let quality = JPEG_QUALITY;
  let dataUrl = render(width, height, quality);
  let bytes = dataUrlBytes(dataUrl);

  // Busy scenes (foliage, gravel) can still exceed the ceiling at 1600px.
  // Step quality down first, then dimensions — quality is the cheaper loss.
  let guard = 0;
  while (bytes > MAX_OUTPUT_BYTES && guard < 5) {
    guard += 1;
    if (quality > 0.45) {
      quality -= 0.12;
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
    dataUrl = render(width, height, quality);
    bytes = dataUrlBytes(dataUrl);
  }

  return { dataUrl, bytes, width, height, originalBytes: file.size };
}

/** "2.4 MB" / "812 KB" — for the size hint under a thumbnail. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ------------------------------------------------------------
// Department evidence uploads
// ------------------------------------------------------------
//
// Field and resolution photos took whatever a FileReader would read: a
// renamed executable, a 40 MB RAW file or an SVG carrying script all went
// straight into the store as a data URL. These are checked before decode.
//
//   Client-side validation is a usability filter, not a security control.
//   A real upload endpoint must re-check the type by sniffing content,
//   cap the size, strip metadata and serve from a separate origin.

/** What the file picker offers. Formats a canvas can actually decode. */
export const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/webp';

const EVIDENCE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const EVIDENCE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/** Field photos are evidence, not portfolio shots. */
const EVIDENCE_MAX_INPUT_BYTES = 12 * 1024 * 1024;

/** Below this a "photo" is a placeholder, an icon, or a tracking pixel. */
const EVIDENCE_MIN_EDGE = 200;

/**
 * Validates and compresses one evidence photo, returning a data URL ready
 * to persist. Throws `ImageError` with copy safe to show an officer.
 */
export async function prepareEvidencePhoto(file: File): Promise<CompressedImage> {
  if (!file) throw new ImageError('No photo was selected.');

  const type = (file.type || '').toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  // Both must agree. A .png that reports image/svg+xml, or an .exe that
  // reports image/jpeg, fails here rather than reaching the decoder.
  if (!EVIDENCE_MIME.includes(type)) {
    throw new ImageError('Only JPG, PNG and WEBP photos can be attached.');
  }

  if (!EVIDENCE_EXTENSIONS.includes(extension)) {
    throw new ImageError('That file name does not look like a photo. Use a .jpg, .png or .webp file.');
  }

  if (file.size === 0) {
    throw new ImageError('That file is empty.');
  }

  if (file.size > EVIDENCE_MAX_INPUT_BYTES) {
    throw new ImageError('That photo is too large. Please choose one under 12 MB.');
  }

  const compressed = await compressImage(file);

  if (compressed.width < EVIDENCE_MIN_EDGE || compressed.height < EVIDENCE_MIN_EDGE) {
    throw new ImageError('That image is too small to be usable as evidence.');
  }

  return compressed;
}
