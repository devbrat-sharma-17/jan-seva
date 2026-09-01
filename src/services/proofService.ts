// ============================================================
// Proof Service — capture integrity for resolution evidence
// ============================================================
//
// A department photo saying "fixed" is currently worth exactly nothing.
// `submitDepartmentResolution` accepted any file that passed MIME,
// extension, size and dimension checks — and a screenshot of last month's
// photo passes all four.
//
// This module binds five facts to every evidence photo at shutter:
//
//   1. live-capture   it came from the in-app camera, not the gallery
//   2. location-match it was taken near the complaint's own coordinates
//   3. device-clock   the device clock agrees with elapsed session time
//   4. mock-location  the platform did not report a mock provider
//   5. novel-image    this image has not been accepted anywhere before
//
// The result is a grade — verified / unverified / disputed — that appears
// on the citizen's timeline and feeds the department score.
//
//   READ THIS BEFORE CITING IT AS SECURITY.
//   These are client-side checks. They are a usability filter, not a
//   security control, exactly as the existing file-validation code says
//   about itself. A determined technical attacker defeats all five. What
//   they defeat is the realistic threat: an officer reusing an old photo,
//   photographing a screen, or closing a job from the depot. The server
//   version — capture nonce, server-side hashing, RFC 3161 timestamping,
//   Play Integrity, a city-wide hash index — is on the roadmap and is
//   named there rather than implied here.

import type {
  CaptureCheck,
  CaptureIntegrity,
  CaptureIntegrityGrade,
  EvidenceHashRecord,
} from '../types/proof';
import type { LatLng } from './geoService';
import { distanceMetres } from './geoService';
import { readJSON, writeJSON } from './storage';

const HASH_INDEX_KEY = 'jan_seva_evidence_hashes_v1';

/**
 * How far from the reported location an evidence photo may be taken.
 *
 * 120 m is deliberately generous. A crew resurfacing a 300 m stretch
 * legitimately stands well away from the pin, and urban GPS routinely
 * drifts 30-50 m between buildings. A tight radius here produces false
 * accusations against honest field staff, which is the fastest way to
 * lose the department's cooperation entirely.
 */
export const CAPTURE_RADIUS_METRES = 120;

/** Beyond this, a fix is being photographed somewhere else entirely. */
export const CAPTURE_HARD_RADIUS_METRES = 500;

/** Device clock skew tolerated before the timestamp stops meaning anything. */
const CLOCK_SKEW_TOLERANCE_MS = 10 * 60 * 1000;

// ------------------------------------------------------------
// Perceptual hash (dHash)
// ------------------------------------------------------------
//
// A cryptographic hash is useless here: re-saving a JPEG at a different
// quality changes every byte. A difference hash compares adjacent pixel
// brightness on a 9x8 downscale, so it survives recompression, minor
// crops and resizing — which is exactly what an officer re-uploading an
// old photo does to it.

const HASH_W = 9;
const HASH_H = 8;

/**
 * 64-bit dHash of an image, as 16 hex characters.
 *
 * Runs on a canvas, which the compression pipeline already produces, so
 * this costs one extra downscale and nothing else.
 */
export async function perceptualHash(dataUrl: string): Promise<string> {
  const bits = await dHashBits(dataUrl);
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

async function dHashBits(dataUrl: string): Promise<number[]> {
  // Outside a browser (the self-test runs in Node) there is no canvas.
  // A deterministic fallback keeps the surrounding logic testable rather
  // than forcing every caller to branch on the environment.
  if (typeof document === 'undefined') return fallbackBits(dataUrl);

  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = HASH_W;
    canvas.height = HASH_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallbackBits(dataUrl);

    ctx.drawImage(img, 0, 0, HASH_W, HASH_H);
    const { data } = ctx.getImageData(0, 0, HASH_W, HASH_H);

    // Rec. 601 luma. Perceptual weighting matters: a plain RGB average
    // treats a blue sky and a yellow road marking as the same brightness.
    const luma: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      luma.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    const bits: number[] = [];
    for (let y = 0; y < HASH_H; y += 1) {
      for (let x = 0; x < HASH_W - 1; x += 1) {
        bits.push(luma[y * HASH_W + x] > luma[y * HASH_W + x + 1] ? 1 : 0);
      }
    }
    return bits;
  } catch {
    return fallbackBits(dataUrl);
  }
}

/** Deterministic stand-in used only where no canvas exists. */
function fallbackBits(seed: string): number[] {
  let h = 2166136261;
  const bits: number[] = [];
  for (let i = 0; i < 64; i += 1) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    bits.push(h & 1);
  }
  return bits;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('unreadable'));
    img.src = src;
  });
}

/** Bit difference between two dHashes. 0 is identical. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    let diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (diff) {
      total += diff & 1;
      diff >>= 1;
    }
  }
  return total;
}

/**
 * Below this many differing bits, two photos are the same scene.
 *
 * 6/64 is the conventional dHash threshold for near-duplicates. Tighter
 * misses a recompressed re-upload; looser starts flagging two genuine
 * photos of the same grey road as the same photo.
 */
const REUSE_THRESHOLD_BITS = 6;

// ------------------------------------------------------------
// The city-wide evidence hash index
// ------------------------------------------------------------

function readHashIndex(): EvidenceHashRecord[] {
  return readJSON<EvidenceHashRecord[]>(HASH_INDEX_KEY, []);
}

/** Every evidence hash accepted so far, for the integrity panel. */
export function getEvidenceHashIndex(): EvidenceHashRecord[] {
  return readHashIndex();
}

/**
 * Whether this image has been submitted before, anywhere in the city.
 * Returns the earlier record, or null if the image is novel.
 */
export function findReuse(hash: string, excludeComplaintId?: string): EvidenceHashRecord | null {
  for (const record of readHashIndex()) {
    if (excludeComplaintId && record.complaintId === excludeComplaintId) continue;
    if (hammingDistance(hash, record.hash) <= REUSE_THRESHOLD_BITS) return record;
  }
  return null;
}

/** Records an accepted photo so the same image cannot be reused later. */
export function recordEvidenceHash(hash: string, complaintId: string, assetId?: string): void {
  const index = readHashIndex();
  if (index.some((r) => r.hash === hash && r.complaintId === complaintId)) return;

  // Bounded. This index is a demo-scale artefact in localStorage; the
  // real one belongs in a database with an index on the hash column.
  const next = [
    { hash, complaintId, recordedAt: new Date().toISOString(), assetId },
    ...index,
  ].slice(0, 500);

  try {
    writeJSON(HASH_INDEX_KEY, next);
  } catch {
    // A full store must not block a genuine repair from being recorded.
  }
}

// ------------------------------------------------------------
// Grading
// ------------------------------------------------------------

export interface CaptureContext {
  /** True when the frame came from the in-app camera, not a file picker. */
  liveCapture: boolean;
  /** Where the device says it was at shutter. Null when no fix was granted. */
  capturedAt?: LatLng | null;
  accuracyMetres?: number;
  /** The complaint's own confirmed coordinates. */
  reportedAt: LatLng;
  /** Device wall clock at shutter. */
  deviceTimeMs: number;
  /** Monotonic elapsed time and wall clock at session start, to compare it against. */
  sessionElapsedMs?: number;
  sessionStartedMs?: number;
  /** Platform mock-location flag, where the runtime exposes one. */
  mockLocationSuspected?: boolean;
  /** Complaint being closed, so its own earlier photos are not "reuse". */
  complaintId?: string;
}

/**
 * Runs every check and produces the grade.
 *
 * The grading rule, stated once so it is not re-derived per caller:
 *   any BLOCKING failure                      -> disputed (refused)
 *   any advisory failure or unavailable check  -> unverified
 *   everything passed                          -> verified
 */
export async function gradeCapture(
  dataUrl: string,
  context: CaptureContext
): Promise<CaptureIntegrity> {
  const hash = await perceptualHash(dataUrl);
  const checks: CaptureCheck[] = [];

  // 1. Live capture. Gallery uploads are the whole Gurugram failure mode.
  checks.push({
    id: 'live-capture',
    label: 'Captured live in-app',
    passed: context.liveCapture,
    detail: context.liveCapture
      ? 'Frame taken from the in-app camera.'
      : 'This image came from device storage, not the camera.',
    severity: 'blocking',
  });

  // 2. Location. Advisory inside the hard radius, blocking beyond it —
  //    50 m of GPS drift is normal; 3 km is a different neighbourhood.
  let distance: number | null = null;
  if (context.capturedAt) {
    distance = distanceMetres(context.capturedAt, context.reportedAt);
    const withinSoft = distance <= CAPTURE_RADIUS_METRES;
    const withinHard = distance <= CAPTURE_HARD_RADIUS_METRES;
    checks.push({
      id: 'location-match',
      label: 'Taken at the reported location',
      passed: withinSoft,
      detail: withinSoft
        ? `${distance} m from the reported location.`
        : withinHard
        ? `${distance} m away — outside the ${CAPTURE_RADIUS_METRES} m capture window.`
        : `${(distance / 1000).toFixed(1)} km from the reported location.`,
      severity: withinHard ? 'advisory' : 'blocking',
    });
  } else {
    checks.push({
      id: 'location-match',
      label: 'Taken at the reported location',
      passed: null,
      detail: 'No location fix was available at capture.',
      severity: 'advisory',
    });
  }

  // 3. Device clock, compared against monotonic elapsed time rather than
  //    trusted outright — the wall clock is the easiest thing on a
  //    handset to change.
  checks.push(gradeClock(context));

  // 4. Mock location provider, where the platform exposes the flag.
  if (context.mockLocationSuspected === undefined) {
    checks.push({
      id: 'mock-location',
      label: 'No mock location provider',
      passed: null,
      detail: 'The browser exposes no mock-location flag. Checked on Android in the field build.',
      severity: 'advisory',
    });
  } else {
    checks.push({
      id: 'mock-location',
      label: 'No mock location provider',
      passed: !context.mockLocationSuspected,
      detail: context.mockLocationSuspected
        ? 'The platform reported a mock location provider.'
        : 'No mock location provider reported.',
      severity: 'blocking',
    });
  }

  // 5. Reuse. The strongest single signal available client-side.
  const reuse = findReuse(hash, context.complaintId);
  checks.push({
    id: 'novel-image',
    label: 'Not submitted before',
    passed: !reuse,
    detail: reuse
      ? `This image was already accepted against ${reuse.complaintId}.`
      : 'No matching image in the city evidence index.',
    severity: 'blocking',
  });

  const grade = resolveGrade(checks);

  return {
    grade,
    checks,
    capturedAt: new Date(context.deviceTimeMs).toISOString(),
    distanceMetres: distance,
    perceptualHash: hash,
    reusedFromComplaintId: reuse?.complaintId,
    accuracyMetres: context.accuracyMetres,
    mockLocationSuspected: context.mockLocationSuspected,
    summary: summarise(grade, distance, context.liveCapture, reuse?.complaintId),
  };
}

function gradeClock(context: CaptureContext): CaptureCheck {
  if (context.sessionStartedMs === undefined || context.sessionElapsedMs === undefined) {
    return {
      id: 'device-clock',
      label: 'Device clock consistent',
      passed: null,
      detail: 'No session reference to compare the device clock against.',
      severity: 'advisory',
    };
  }

  // What the wall clock should read if it has not been touched: the time
  // the session started, plus the monotonic time that has since elapsed.
  const expected = context.sessionStartedMs + context.sessionElapsedMs;
  const skew = Math.abs(context.deviceTimeMs - expected);
  const ok = skew <= CLOCK_SKEW_TOLERANCE_MS;

  return {
    id: 'device-clock',
    label: 'Device clock consistent',
    passed: ok,
    detail: ok
      ? 'Device clock matches elapsed session time.'
      : `Device clock is ${Math.round(skew / 60000)} min out from elapsed session time.`,
    severity: 'advisory',
  };
}

function resolveGrade(checks: CaptureCheck[]): CaptureIntegrityGrade {
  if (checks.some((c) => c.severity === 'blocking' && c.passed === false)) return 'disputed';
  if (checks.some((c) => c.passed !== true)) return 'unverified';
  return 'verified';
}

function summarise(
  grade: CaptureIntegrityGrade,
  distance: number | null,
  live: boolean,
  reusedFrom?: string
): string {
  if (reusedFrom) return `Image previously submitted against ${reusedFrom}.`;
  if (!live) return 'Image was not captured live in-app.';
  if (grade === 'verified' && distance !== null) return `Captured live, ${distance} m from the report.`;
  if (grade === 'verified') return 'Captured live in-app.';
  if (distance !== null && distance > CAPTURE_RADIUS_METRES) {
    return `Captured live, but ${distance} m from the report.`;
  }
  return 'Captured live; some checks could not be completed.';
}

/** Whether a graded capture may be submitted at all. */
export function isSubmittable(integrity: CaptureIntegrity): boolean {
  return integrity.grade !== 'disputed';
}

/** Aggregate grade for a resolution carrying several photos: the worst one. */
export function worstGrade(grades: CaptureIntegrityGrade[]): CaptureIntegrityGrade {
  if (grades.length === 0) return 'unverified';
  if (grades.includes('disputed')) return 'disputed';
  if (grades.includes('unverified')) return 'unverified';
  return 'verified';
}

/** Points a grade contributes to the evidence-integrity score component. */
export function gradePoints(grade: CaptureIntegrityGrade): number {
  if (grade === 'verified') return 1;
  if (grade === 'unverified') return 0.5;
  return 0;
}

/** Presentation copy for a grade. One source, so badges cannot disagree. */
export const GRADE_COPY: Record<
  CaptureIntegrityGrade,
  { label: string; short: string; blurb: string }
> = {
  verified: {
    label: 'Verified capture',
    short: 'Verified',
    blurb:
      'Photographed live in-app, at the reported location, and not submitted anywhere before.',
  },
  unverified: {
    label: 'Unverified capture',
    short: 'Unverified',
    blurb: 'Taken live, but one or more provenance checks could not be completed.',
  },
  disputed: {
    label: 'Disputed capture',
    short: 'Disputed',
    blurb: 'This image failed a provenance check and cannot close a complaint on its own.',
  },
};
