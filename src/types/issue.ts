// ============================================================
// Civic Issue Types — the issue / report split
// ============================================================
//
// The problem this fixes:
//
//   Twenty people report the same pothole. The duplicate detector merges
//   nineteen of them into the first person's ticket. The department fixes
//   the pothole and the FIRST reporter confirms it. Nineteen citizens
//   have just had their complaint closed by a stranger.
//
// NYC Council Int 0744-2024 was drafted to prohibit agencies from closing
// 311 requests solely because they were identified as duplicates. The
// bill's existence is the evidence that agencies were doing exactly this.
// SeeClickFix archives a merged request and it cannot be reopened.
//
// The fix is structural, not cosmetic. A CivicIssue owns the real-world
// problem: the location, the asset, the department, the SLA, the work.
// Each citizen keeps their own Complaint — their own ticket ID, their own
// timeline, and their own vote on whether it is fixed.
//
//   A department sees one job.
//   Twenty citizens each keep their own standing.
//
// Resolution closes the ISSUE provisionally. It closes each REPORT only
// as that citizen confirms.

export type IssueConfirmationState = 'pending' | 'confirmed' | 'disputed' | 'lapsed';

/**
 * One citizen's stake in a shared issue.
 *
 * `coordinates` and `deviceKey` exist for spread-weighted confirmation:
 * twenty confirmations from twenty streets mean something, twenty from
 * one building do not. Neither is PII — the coordinate is the report's
 * own already-stored location, and the device key is a non-reversible
 * hash, never a device identifier.
 */
export interface ReporterStake {
  /** This citizen's own ticket. They keep it; it is not archived. */
  complaintId: string;
  /** Opaque identity reference. Never a mobile number. */
  identityReference?: string;
  reportedAt: string;
  confirmation: IssueConfirmationState;
  confirmedAt?: string;
  /** Required when disputing, so a dissent is reviewable rather than a veto. */
  disputeReason?: string;
  coordinates?: { latitude: number; longitude: number };
  deviceKey?: string;
  /** How many times this reporter has reopened. Capped, to stop a loop. */
  reopenCount: number;
}

export type CivicIssueStatus =
  | 'open'
  | 'in-progress'
  | 'provisionally-closed'
  | 'closed'
  | 'contested';

export interface CivicIssue {
  /** Public reference for the shared problem, e.g. "CI-GWL-000142". */
  id: string;
  cityId: string;
  category: string;
  title: string;
  /** The asset this issue sits on, once snapped. */
  assetId?: string;
  location: {
    latitude: number;
    longitude: number;
    locality: string;
    city: string;
  };
  departmentId?: string;
  departmentName: string;
  status: CivicIssueStatus;
  createdAt: string;
  updatedAt: string;
  /** The complaint the department actually works. */
  primaryComplaintId: string;
  stakes: ReporterStake[];
  /** Set when the department submits a resolution. This is not a closure. */
  provisionallyClosedAt?: string;
  /** Set only once every stake has confirmed. This one is a real closure. */
  fullyConfirmedAt?: string;
  /** Set when a stakeholder disputes a provisional closure. */
  contestedAt?: string;
}

/** How much independent support an issue actually has. */
export interface ConfirmationSpread {
  /** Raw stake count — the number every other platform shows. */
  totalReports: number;
  /** Distinct verified identities. */
  distinctIdentities: number;
  /** Distinct ~100 m location cells the reports came from. */
  distinctLocations: number;
  /** Distinct device keys. */
  distinctDevices: number;
  /**
   * 0-1, with sharply diminishing returns and a hard cap, so the loudest
   * neighbourhood cannot buy priority by volume.
   */
  weight: number;
  /** Points this spread contributes to the priority score. Capped. */
  priorityContribution: number;
  /** "Reported from 9 distinct locations by 11 verified citizens". */
  label: string;
}

/** Distributed-consent state, for the department and the citizen alike. */
export interface ConsentSummary {
  total: number;
  confirmed: number;
  disputed: number;
  pending: number;
  /** True when every stakeholder has confirmed. */
  unanimous: boolean;
  /** True when at least one stakeholder says it is still broken. */
  contested: boolean;
}
