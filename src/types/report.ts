// ============================================================
// JAN-SEVA — Report an Issue Type Definitions
// ============================================================

export interface ReportPhoto {
  id: string;
  url: string;
  name: string;
  size?: number;
  file?: File;
  timestamp: number;
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
