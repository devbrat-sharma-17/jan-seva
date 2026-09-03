// ============================================================
// JAN-SEVA — Report an Issue Type Definitions
// ============================================================

/**
 * How a photo entered the report.
 *
 *   LIVE_CAMERA           the in-app viewfinder; the app drew the frame.
 *   NATIVE_CAMERA_INTENT  a `capture="environment"` file input. The
 *                         browser was ASKED for the camera; on most
 *                         mobile platforms that is what opens, but no
 *                         browser reports back what the user actually
 *                         picked, so this is an intent, not a proof.
 *   UNKNOWN               provenance was not established.
 *
 * There is deliberately no value meaning "confirmed genuine". A browser
 * cannot establish that, and a field named as if it could would be cited
 * as if it had (spec §19, §47).
 */
export type PhotoCaptureMethod = 'LIVE_CAMERA' | 'NATIVE_CAMERA_INTENT' | 'UNKNOWN';

export interface ReportPhoto {
  id: string;
  url: string;
  name: string;
  size?: number;
  file?: File;
  timestamp: number;
  /** Provenance recorded at the shutter. Absent on drafts saved before this existed. */
  captureMethod?: PhotoCaptureMethod;
  /** Device wall clock at capture. Not authoritative — the server's receipt time is. */
  capturedAtClient?: string;
  /** GPS Location captured exactly when the photo was taken, for geotagging. */
  location?: GPSLocation;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  detectedAt?: string;
  address?: string;
  locality?: string;
  city?: string;
  state?: string;
}

export interface ConfirmedLocation {
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode?: string;
  source: 'gps' | 'manual';
  confirmedAt?: string;
}

export interface LocationData {
  gps?: GPSLocation | null;
  confirmed?: ConfirmedLocation | null;
  // Flat properties for backward compatibility across the app
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  landmark?: string;
  city: string;
  state: string;
  pincode?: string;
}


export type IdentityMethod = 'aadhaar' | 'mobile';

export interface ReportDraft {
  id?: string;
  photos: ReportPhoto[];
  description: string;
  identityMethod: IdentityMethod;
  /** In-memory only. Stripped before the draft is written to storage. */
  aadhaarNumber: string;
  /** In-memory only. Stripped before the draft is written to storage. */
  mobileNumber: string;
  /** In-memory only. Never persisted. */
  otp: string;
  /** Masked stand-in kept on a restored draft, e.g. "+91 XXXXX 43210". */
  mobileMaskedHint?: string;
  identityVerified: boolean;
  /**
   * The server's signed statement that IT verified this citizen, returned
   * by /api/otp/verify. In-memory only and never persisted with the draft:
   * it is short-lived, and a token sitting in localStorage outlives the
   * session it was issued for.
   *
   *   THIS, NOT `identityVerified`, IS WHAT THE SERVER TRUSTS.
   *   `identityVerified` above drives the wizard's own step gating and
   *   carries no authority once it leaves the browser.
   */
  identityAttestation?: string;
  name: string;
  location: LocationData | null;
  category?: string;
  suggestedCategory?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  priority?: number;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysis {
  category: string;
  categoryTitle: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  department: string;
  departmentName: string;
  confidence: number;
  duplicateMatch?: DuplicateMatch | null;
}

export interface DuplicateMatch {
  id: string;
  title: string;
  location: string;
  distanceMeters: number;
  status: 'pending' | 'in-progress' | 'resolved';
  reportedAt: string;
  supportingCount: number;
  thumbnailUrl?: string;
}

export type ReportStep = 
  | 1 // Photos
  | 2 // Description
  | 3 // Identity
  | 4 // Location
  | 5 // Review
  | 'processing'
  | 'duplicate'
  | 'success';

export interface StepValidationResult {
  isValid: boolean;
  errorMessage?: string;
}
