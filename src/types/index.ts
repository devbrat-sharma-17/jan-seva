// ============================================================
// JAN-SEVA Type Definitions
// ============================================================

export interface CityConfig {
  id: string;
  /** Three-letter ticket code, e.g. "GWL" -> JS-GWL-2026-001284. */
  code: string;
  name: string;
  nameHindi: string;
  state: string;
  stateHindi: string;
  country: string;
  heroImage: string;
  coordinates: { lat: number; lng: number };
  localTagline: string;
  localTaglineHindi: string;
  accent?: string;
  landmarks: string[];
  initiatives: InitiativeConfig[];
  statistics: CityStatistics;
  status?: 'active' | 'coming-soon';
}

export interface CityStatistics {
  issuesReported: number;
  issuesResolved: number;
  activeInitiatives: number;
  resolutionRate: number;
}

export interface InitiativeConfig {
  id: string;
  title: string;
  location: string;
  description: string;
  status: 'ongoing' | 'upcoming' | 'completed';
  image: string;
}

export interface IssueCategory {
  id: string;
  title: string;
  icon: string;
  /** Colour comes from the `--cat-<id>` token set, keyed by `id`. */
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

export interface NavLink {
  label: string;
  href: string;
  isExternal?: boolean;
  /**
   * Display priority in the desktop header.
   *  1 — always shown from 1024px up
   *  2 — appears at 1200px
   *  3 — appears at 1440px
   * Every link is always present in the mobile drawer regardless.
   */
  priority?: 1 | 2 | 3;
}

export interface Testimonial {
  id: string;
  name: string;
  locality: string;
  city: string;
  review: string;
  rating?: number;
  avatar: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: string;
  photo: string;
  departmentColor: string;
}

export type ComplaintStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'resolution-submitted'
  | 'resolved'
  | 'escalated';

export type IdentityMethod = 'aadhaar' | 'mobile';

/**
 * How much of a complaint the current viewer is entitled to see.
 * `public`  — reached by knowing the Complaint ID alone.
 * `verified` — the viewer completed OTP verification as the reporter.
 */
export type AccessLevel = 'public' | 'verified';

export interface ComplaintReporter {
  name: string;
  /** Never a full number. e.g. "+91 XXXXX 43210". */
  mobileMasked?: string;
  identityMethod?: IdentityMethod;
  identityVerified: boolean;
  /**
   * Opaque, non-reversible key used to match a verified citizen to their
   * complaints. Raw mobile numbers and Aadhaar numbers are never persisted.
   */
  identityReference?: string;
  /** Masked display form only, e.g. "XXXX XXXX 3841". */
  identityLabel?: string;
}

export interface Complaint {
  id: string;
  /** Which city configuration this complaint belongs to. */
  cityId: string;
  createdAt: string;
  updatedAt: string;
  status: ComplaintStatus;

  /**
   * Optimistic concurrency counter, incremented on every persisted
   * mutation. A caller holding an older version has been overtaken —
   * by another tab today, by another officer once there is a server —
   * and its write is refused rather than silently overwriting.
   * Absent on records written before versioning; treated as 0.
   */
  version?: number;

  issue: {
    category: string;
    title: string;
    description: string;
  };

  photos: string[];

  location: {
    latitude: number;
    longitude: number;
    address: string;
    locality: string;
    city: string;
    state: string;
    source?: 'gps' | 'manual';
    gps?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      detectedAt?: string;
    };
  };

  reporter: ComplaintReporter;

  aiAnalysis?: {
    category: string;
    categoryTitle?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    priorityScore: number;
    department: string;
    confidenceScore?: number;
    urgencyFlags?: string[];
  };

  department: {
    id?: string;
    name: string;
    division: string;
    helpline: string;
    assignedTeam?: string;
  };

  assignedOfficer?: {
    name: string;
    designation: string;
    staffId?: string;
    team?: string;
    phone?: string;
  };

  sla: {
    dueAt: string;
    status: 'normal' | 'approaching' | 'exceeded';
    escalatedAt?: string;
    escalationLevel?: string;
    escalatedTo?: string;
  };

  timeline: ComplaintTimelineEvent[];
  latestUpdate: {
    title: string;
    description: string;
    timestamp: string;
  };

  duplicate?: {
    isLinked: boolean;
    primaryIssueId?: string;
    primaryTitle?: string;
    supportingCount?: number;
    civicIssueId?: string;
  };

  resolution?: {
    evidencePhotos?: string[];
    resolvedAt?: string;
    resolutionNote?: string;
    resolvedBy?: string;
    /** Set only once the citizen themselves confirms the fix. */
    citizenVerifiedResolved?: boolean;
    citizenVerifiedAt?: string;
  };

  feedback?: {
    rating?: number;
    comment?: string;
    submittedAt?: string;
    reinspectionRequested?: boolean;
    reinspectionNote?: string;
    reinspectionRequestedAt?: string;
  };

  /**
   * Retention. A resolved complaint stays publicly trackable for 48 hours
   * from `resolvedAt`; after that the record is retained locally but is no
   * longer retrievable through public tracking.
   */
  expiresAt?: string;
  isPubliclyTrackable?: boolean;
}

/**
 * The redacted projection handed to any viewer holding only a Complaint ID.
 * Constructing this is the only supported way to render a public view — the
 * PII-bearing fields are absent from the type, so a component cannot leak
 * them by accident.
 */
export interface PublicComplaint {
  id: string;
  cityId: string;
  createdAt: string;
  updatedAt: string;
  status: ComplaintStatus;

  issue: {
    category: string;
    title: string;
    description: string;
  };

  /** Count only — the images themselves stay behind verification. */
  photoCount: number;
  /** Low-resolution, blurred stand-ins safe to show publicly. */
  protectedPhotos: string[];
  resolutionEvidenceCount: number;
  protectedResolutionPhotos: string[];

  /** Generalised to locality + city. No coordinates. */
  area: {
    locality: string;
    city: string;
    state: string;
  };

  department: Complaint['department'];
  assignedOfficer?: Complaint['assignedOfficer'];
  sla: Complaint['sla'];
  timeline: ComplaintTimelineEvent[];
  latestUpdate: Complaint['latestUpdate'];
  duplicate?: Complaint['duplicate'];

  resolution?: {
    resolvedAt?: string;
    resolutionNote?: string;
    citizenVerifiedResolved?: boolean;
    evidencePhotos?: string[];
  };

  feedback?: Complaint['feedback'];

  expiresAt?: string;
  isPubliclyTrackable: boolean;
}

/** Why a public look-up returned nothing. */
export type LookupOutcome =
  | { kind: 'found'; complaint: PublicComplaint }
  | { kind: 'not-found' }
  | { kind: 'expired'; resolvedAt: string };

export interface ComplaintTimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: ComplaintStatus;
  actor?: string;
  actorType?: 'citizen' | 'system' | 'officer' | 'head';
  visibility?: 'public' | 'internal';
  photos?: string[];
}


export interface ComplaintTimelineEntry {
  status: string;
  date: string;
  description: string;
}


export interface PortalCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}
