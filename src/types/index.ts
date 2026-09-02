// ============================================================
// JAN-SEVA Type Definitions
// ============================================================

import type { CaptureIntegrity, CaptureIntegrityGrade } from './proof';
import type { PhotoCaptureMethod } from './report';

/**
 * One deferred durability check on a confirmed resolution.
 *
 * Two prompts, ever. Notification fatigue is the real risk here, so the
 * cap is a design constraint rather than a setting: 30 days, 90 days,
 * one tap each, and never a third.
 */
export interface DurabilityCheckpoint {
  /** Days after confirmation this checkpoint is due. */
  dayOffset: 30 | 90;
  dueAt: string;
  askedAt?: string;
  /** `holding` means the fix survived; `failed` reopens the complaint. */
  outcome?: 'holding' | 'failed' | 'no-response';
  respondedAt?: string;
  note?: string;
}

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

/**
 * Municipal programme totals. Illustrative, and labelled as such.
 *
 * There is deliberately no `resolutionRate` field. Storing a rate
 * alongside the numerator and denominator lets the three disagree, and
 * they did: 94% was printed next to 9,830 of 12,480, which is 79%. The
 * rate is derived by `getProgrammeStats` instead.
 */
export interface CityStatistics {
  issuesReported: number;
  issuesResolved: number;
  activeInitiatives: number;
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

  /**
   * How each entry in `photos` was captured, index-aligned (spec §19).
   *
   * Kept beside `photos` rather than turning that into an array of
   * objects: every existing record, seed and reader treats it as a list
   * of data URLs. Absent on complaints filed before provenance was
   * recorded, which reads as UNKNOWN and never as a confirmed capture.
   */
  photoProvenance?: Array<{
    captureMethod: PhotoCaptureMethod;
    /** Device clock at capture. Not authoritative on its own. */
    capturedAtClient?: string;
  }>;

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

  /**
   * The piece of infrastructure this complaint sits on, once snapped.
   *
   * This is what turns a stream of complaints into a maintenance
   * history. Absent means the report did not fall within any known
   * asset's snap radius, which is a real and common outcome — an honest
   * "not on a known asset" beats snapping to whatever was nearest.
   */
  assetId?: string;
  /** How far the report was from the asset it snapped to, in metres. */
  assetSnapMetres?: number;

  /**
   * The shared real-world problem this report is one voice in.
   *
   * A CivicIssue owns the location, the asset, the SLA and the work.
   * This complaint remains the citizen's own — their ticket, their
   * timeline, their vote — and is never archived into someone else's.
   */
  civicIssueId?: string;

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
    /**
     * Provenance of each evidence photo, bound at shutter.
     * Parallel to `evidencePhotos` by index.
     */
    captureIntegrity?: CaptureIntegrity[];
    /** Worst grade across the evidence — the one the timeline shows. */
    evidenceGrade?: CaptureIntegrityGrade;
    /** Ledger entry appended to the asset when this resolution landed. */
    assetRepairId?: string;
  };

  /**
   * Durability of a confirmed resolution.
   *
   * A citizen standing next to a fresh patch will confirm it. Whether
   * the patch is still there in November is the question that actually
   * matters, and until now nobody asked it. A confirmed resolution
   * enters a watch window and is re-asked at 30 and 90 days.
   */
  verification?: {
    /** When the watch window opened — the citizen's confirmation. */
    watchStartedAt?: string;
    checkpoints?: DurabilityCheckpoint[];
    /** Selected into the independent re-inspection sample. */
    auditSampled?: boolean;
    auditSampledAt?: string;
    auditOutcome?: 'upheld' | 'failed' | 'pending';
    auditedBy?: string;
    auditNote?: string;
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

  /**
   * True once the identity retention window has passed.
   *
   * An archived record is the PERMANENT civic record: what was reported,
   * where, who fixed it and whether it held. It is no longer linked to
   * the citizen who reported it and no longer accepts their actions.
   * See the retention note in privacyService.
   */
  isArchived: boolean;

  /** The asset this complaint sits on. Survives archival — assets are not people. */
  assetId?: string;
  /** Repeat-failure flag, so a reader can see the history without the identity. */
  isRepeatFailure?: boolean;
  /** Capture-integrity grade of the resolution evidence. */
  evidenceGrade?: CaptureIntegrityGrade;
}

/**
 * Why a public look-up returned what it did.
 *
 * `expired` is no longer a dead end. It carries the archived civic
 * record, because the identity expiring is not the same thing as the
 * repair never having happened.
 */
export type LookupOutcome =
  | { kind: 'found'; complaint: PublicComplaint }
  | { kind: 'not-found' }
  | { kind: 'expired'; resolvedAt: string; archived: PublicComplaint };

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
