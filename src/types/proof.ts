// ============================================================
// Proof of Repair Types — capture integrity
// ============================================================
//
// Every civic app in India asks a department for a photo when it closes a
// complaint. None of the ones reviewed asks whether the photo is real.
//
// In July 2026 the Municipal Corporation of Gurugram terminated an
// Assistant Sanitary Inspector who closed grievances with AI-generated
// photographs of cleaned dumping sites, and a colleague who spoofed GPS.
// It was found by accident, when a citizen complained about the same
// garbage again.
//
// These types describe what JAN-SEVA binds to an evidence photo at the
// moment of capture, so that failure mode is detectable by the system
// rather than by luck.
//
//   IMPORTANT, AND SAID OUT LOUD IN THE UI TOO:
//   Client-side checks are a usability filter, not a security control.
//   Every one of them is bypassable by someone determined and technical.
//   What they defeat is the realistic threat — an officer reusing an old
//   photo, shooting a screen, or standing three kilometres away. The
//   server-side version (capture nonce, server-computed hash, RFC 3161
//   timestamping, Play Integrity attestation) is on the roadmap and is
//   named as such rather than implied.

/** The overall verdict rendered on the citizen's timeline. */
export type CaptureIntegrityGrade = 'verified' | 'unverified' | 'disputed';

export type CaptureCheckId =
  | 'live-capture'
  | 'location-match'
  | 'device-clock'
  | 'mock-location'
  | 'novel-image';

/**
 * One integrity test.
 *
 * `passed: null` means the check could not run — no GPS fix, no
 * permission, an older browser. An unavailable check is reported as
 * unavailable and never silently counted as a pass, which is the same
 * rule the performance score follows for absent data.
 */
export interface CaptureCheck {
  id: CaptureCheckId;
  label: string;
  passed: boolean | null;
  /** One line, written for an officer to read on a phone in sunlight. */
  detail: string;
  /**
   * A `blocking` failure downgrades the grade to `disputed` and stops
   * submission. An `advisory` failure downgrades to `unverified` and is
   * recorded, because a genuine repair in a GPS shadow must still be
   * submittable.
   */
  severity: 'blocking' | 'advisory';
}

/**
 * How a candidate image compared against everything accepted before.
 *
 *   EXACT_REUSE   byte-identical to an earlier accepted image (SHA-256).
 *   NEAR_REUSE    the same scene, recompressed/cropped/resized (dHash).
 *   NO_MATCH      novel as far as the index can tell.
 *   CHECK_UNAVAILABLE  the comparison could not run.
 */
export type ReuseVerdict = 'EXACT_REUSE' | 'NEAR_REUSE' | 'NO_MATCH' | 'CHECK_UNAVAILABLE';

export interface CaptureIntegrity {
  grade: CaptureIntegrityGrade;
  checks: CaptureCheck[];
  /** Device clock at shutter. */
  capturedAt: string;
  /** Metres from the complaint's confirmed location. Null without a fix. */
  distanceMetres: number | null;
  /** 64-bit dHash, as 16 hex characters. The key into the reuse index. */
  perceptualHash: string;
  /**
   * SHA-256 of the image bytes, for exact identity (spec §12). The dHash
   * answers "same scene?"; this answers "same file?", and only this one is
   * a cryptographic hash — the dHash is a similarity metric and is not
   * load-bearing for integrity on its own.
   *
   * Undefined where SubtleCrypto is unavailable (an insecure origin), which
   * is recorded as CHECK_UNAVAILABLE rather than as a pass.
   */
  sha256?: string;
  /** Outcome of the reuse comparison. */
  reuseVerdict: ReuseVerdict;
  /**
   * If this hash was seen before, the complaint it was accepted against.
   * The single strongest signal in the whole pipeline.
   */
  reusedFromComplaintId?: string;
  /** GPS accuracy at capture, in metres. */
  accuracyMetres?: number;
  /** True when the platform reported a mock location provider. */
  mockLocationSuspected?: boolean;
  /** Short human summary, e.g. "Captured live, 18 m from the report". */
  summary: string;
}

/** A validated evidence photo with its provenance attached. */
export interface EvidenceCapture {
  dataUrl: string;
  integrity: CaptureIntegrity;
}

/** One entry in the city-wide evidence hash index. */
export interface EvidenceHashRecord {
  hash: string;
  /** Exact-identity hash. Absent on records written before §12. */
  sha256?: string;
  complaintId: string;
  recordedAt: string;
  assetId?: string;
}
