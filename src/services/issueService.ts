// ============================================================
// Issue Service — the issue / report split & distributed consent
// ============================================================
//
// Before this module, joining an existing complaint MERGED the new report
// into the first reporter's ticket. That made the first reporter's ticket
// the issue and gave only that person a verification vote; nineteen other
// citizens were silently represented by a stranger.
//
// Now:
//
//   * Each citizen keeps their own Complaint, with their own ticket ID.
//   * A CivicIssue owns the shared problem, the asset and the work.
//   * The department works ONE job.
//   * A resolution closes the issue PROVISIONALLY. It closes each report
//     only as that citizen confirms.
//   * One dissent puts the issue in `contested` and reopens the work.
//
//   ANTI-GAMING, because "everyone must agree" is exploitable too:
//   a single dissenting reporter cannot block closure indefinitely. A
//   dispute requires a written reason, reopens are capped per reporter
//   (MAX_REOPENS_PER_REPORTER), and a contested closure past that cap is
//   escalated to a human rather than looping forever.

import type {
  CivicIssue,
  ConfirmationSpread,
  ConsentSummary,
  ReporterStake,
} from '../types/issue';
import type { Complaint } from '../types';
import { locationCell } from './geoService';
import { readJSON, writeJSON, subscribeToKey } from './storage';
import { getCityCode } from '../data/cities';

const ISSUES_KEY = 'jan_seva_civic_issues_v1';

/** After this many reopens by one reporter, a human decides. */
export const MAX_REOPENS_PER_REPORTER = 2;

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

function readIssues(): CivicIssue[] {
  return readJSON<CivicIssue[]>(ISSUES_KEY, []);
}

function writeIssues(issues: CivicIssue[]): void {
  try {
    writeJSON(ISSUES_KEY, issues);
  } catch {
    // The complaint records remain authoritative; a lost issue overlay
    // degrades to today's behaviour rather than losing a citizen's report.
  }
}

export function getIssues(): CivicIssue[] {
  return readIssues();
}

export function getIssueById(issueId: string): CivicIssue | null {
  return readIssues().find((i) => i.id === issueId) ?? null;
}

/** The issue a given complaint is a voice in, if any. */
export function getIssueForComplaint(complaintId: string): CivicIssue | null {
  return (
    readIssues().find((i) => i.stakes.some((s) => s.complaintId === complaintId)) ?? null
  );
}

export function subscribeToIssues(onChange: () => void): () => void {
  return subscribeToKey(ISSUES_KEY, onChange);
}

function nextIssueId(cityId: string): string {
  const code = getCityCode(cityId);
  const taken = new Set(readIssues().map((i) => i.id));
  let n = readIssues().length + 1;
  let candidate = `CI-${code}-${String(n).padStart(6, '0')}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `CI-${code}-${String(n).padStart(6, '0')}`;
  }
  return candidate;
}

/**
 * Non-reversible device key.
 *
 * Used only to answer "were these two confirmations made from the same
 * handset?". It is derived from coarse, non-identifying browser traits
 * and hashed; it is not a device identifier, is never displayed, and is
 * never sent anywhere. A citizen who clears their browser gets a new
 * key, which costs the spread measure a little accuracy and costs their
 * privacy nothing.
 */
export function deriveDeviceKey(): string {
  const traits =
    typeof navigator === 'undefined'
      ? 'headless'
      : [
          navigator.language ?? '',
          String((navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? ''),
          typeof screen === 'undefined' ? '' : `${screen.width}x${screen.height}`,
          new Date().getTimezoneOffset().toString(),
        ].join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < traits.length; i += 1) {
    hash ^= traits.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `dev_${hash.toString(36)}`;
}

// ------------------------------------------------------------
// Registering stakes
// ------------------------------------------------------------

function stakeFrom(complaint: Complaint): ReporterStake {
  return {
    complaintId: complaint.id,
    identityReference: complaint.reporter.identityReference,
    reportedAt: complaint.createdAt,
    confirmation: 'pending',
    coordinates: {
      latitude: complaint.location.latitude,
      longitude: complaint.location.longitude,
    },
    deviceKey: deriveDeviceKey(),
    reopenCount: 0,
  };
}

/**
 * Ensures an issue exists for `primary`, creating one on first join.
 *
 * A complaint nobody else has reported does not need an issue record —
 * it IS the issue. The overlay is created the moment a second citizen
 * reports the same thing, which is the first moment distributed consent
 * means anything.
 */
export function ensureIssueFor(primary: Complaint): CivicIssue {
  const existing = getIssueForComplaint(primary.id);
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  const issue: CivicIssue = {
    id: nextIssueId(primary.cityId),
    cityId: primary.cityId,
    category: primary.issue.category,
    title: primary.issue.title,
    assetId: primary.assetId,
    location: {
      latitude: primary.location.latitude,
      longitude: primary.location.longitude,
      locality: primary.location.locality,
      city: primary.location.city,
    },
    departmentId: primary.department.id,
    departmentName: primary.department.name,
    status: primary.status === 'resolved' ? 'provisionally-closed' : 'open',
    createdAt: primary.createdAt,
    updatedAt: nowIso,
    primaryComplaintId: primary.id,
    stakes: [stakeFrom(primary)],
  };

  writeIssues([issue, ...readIssues()]);
  return issue;
}

/**
 * Adds a second (or twentieth) citizen's report to a shared issue.
 *
 * The joining complaint keeps its own ID and its own timeline. It is not
 * archived, not merged, and not represented by anyone else.
 */
export function addStake(issueId: string, complaint: Complaint): CivicIssue | null {
  const issues = readIssues();
  const index = issues.findIndex((i) => i.id === issueId);
  if (index === -1) return null;

  const issue = issues[index];
  if (issue.stakes.some((s) => s.complaintId === complaint.id)) return issue;

  const updated: CivicIssue = {
    ...issue,
    updatedAt: new Date().toISOString(),
    stakes: [...issue.stakes, stakeFrom(complaint)],
  };

  issues[index] = updated;
  writeIssues(issues);
  return updated;
}

function patchIssue(issueId: string, patch: (issue: CivicIssue) => CivicIssue): CivicIssue | null {
  const issues = readIssues();
  const index = issues.findIndex((i) => i.id === issueId);
  if (index === -1) return null;

  const updated = { ...patch(issues[index]), updatedAt: new Date().toISOString() };
  issues[index] = updated;
  writeIssues(issues);
  return updated;
}

// ------------------------------------------------------------
// Distributed consent
// ------------------------------------------------------------

/** Marks the department's resolution as a PROVISIONAL close, not a close. */
export function markProvisionallyClosed(issueId: string): CivicIssue | null {
  return patchIssue(issueId, (issue) => ({
    ...issue,
    status: 'provisionally-closed',
    provisionallyClosedAt: new Date().toISOString(),
    contestedAt: undefined,
  }));
}

/** One citizen agrees the work is done. Their vote, and only theirs. */
export function recordConfirmation(
  issueId: string,
  complaintId: string
): CivicIssue | null {
  return patchIssue(issueId, (issue) => {
    const stakes = issue.stakes.map((s) =>
      s.complaintId === complaintId
        ? { ...s, confirmation: 'confirmed' as const, confirmedAt: new Date().toISOString() }
        : s
    );
    const consent = summariseConsent({ ...issue, stakes });

    return {
      ...issue,
      stakes,
      // Closure requires everyone. Nineteen confirmations and one open
      // vote is not a closed issue, it is nineteen confirmations.
      status: consent.unanimous ? 'closed' : issue.status,
      fullyConfirmedAt: consent.unanimous ? new Date().toISOString() : issue.fullyConfirmedAt,
    };
  });
}

export interface DisputeOutcome {
  issue: CivicIssue | null;
  /** True when this reporter has exhausted their reopens. */
  capped: boolean;
  /** True when the issue reopened as a result. */
  reopened: boolean;
}

/**
 * One citizen says it is still broken from where they stand.
 *
 * A reason is required, so a dissent is reviewable rather than a veto,
 * and reopens are capped per reporter. Past the cap the dispute is
 * recorded and the issue is flagged for a human decision instead of
 * reopening the work again — a loop helps nobody, least of all the
 * nineteen citizens who said it was fixed.
 */
export function recordDispute(
  issueId: string,
  complaintId: string,
  reason: string
): DisputeOutcome {
  const issue = getIssueById(issueId);
  if (!issue) return { issue: null, capped: false, reopened: false };

  const stake = issue.stakes.find((s) => s.complaintId === complaintId);
  if (!stake) return { issue, capped: false, reopened: false };

  const capped = stake.reopenCount >= MAX_REOPENS_PER_REPORTER;

  const updated = patchIssue(issueId, (current) => ({
    ...current,
    stakes: current.stakes.map((s) =>
      s.complaintId === complaintId
        ? {
            ...s,
            confirmation: 'disputed' as const,
            disputeReason: reason,
            reopenCount: s.reopenCount + 1,
          }
        : s
    ),
    status: 'contested',
    contestedAt: new Date().toISOString(),
    fullyConfirmedAt: undefined,
  }));

  return { issue: updated, capped, reopened: !capped };
}

/** Where the consent vote currently stands. */
export function summariseConsent(issue: CivicIssue): ConsentSummary {
  const total = issue.stakes.length;
  const confirmed = issue.stakes.filter((s) => s.confirmation === 'confirmed').length;
  const disputed = issue.stakes.filter((s) => s.confirmation === 'disputed').length;

  return {
    total,
    confirmed,
    disputed,
    pending: total - confirmed - disputed,
    unanimous: total > 0 && confirmed === total,
    contested: disputed > 0,
  };
}

// ------------------------------------------------------------
// Spread-weighted confirmation
// ------------------------------------------------------------
//
// `supportingCount` was a raw integer that any repeat submission
// incremented, and it did not influence priority at all — so the feature
// was simultaneously gameable and inert, while the success screen told
// the citizen it had "raised the priority". It had not.
//
// Twenty confirmations from twenty different streets mean something.
// Twenty from one building do not. Swachhata has vote-up and SeeClickFix
// has follow; neither weights by independence, so both are brigadable by
// a resident association, a contractor, or a political worker.

/** Points a spread can add to a priority score, however large it gets. */
export const MAX_SPREAD_PRIORITY_POINTS = 8;

/**
 * Independence-weighted support for an issue.
 *
 * Three axes, each with sharply diminishing returns:
 *   distinct verified identities, distinct ~110 m location cells, and
 *   distinct device keys. Location is weighted highest, because it is
 *   the axis hardest to fake from a single desk.
 */
export function computeSpread(issue: CivicIssue): ConfirmationSpread {
  const identities = new Set<string>();
  const locations = new Set<string>();
  const devices = new Set<string>();

  for (const stake of issue.stakes) {
    if (stake.identityReference) identities.add(stake.identityReference);
    if (stake.coordinates) locations.add(locationCell(stake.coordinates));
    if (stake.deviceKey) devices.add(stake.deviceKey);
  }

  // log1p saturates: the second independent report is worth far more
  // than the twentieth, which is the honest shape of the signal.
  const saturate = (n: number, scale: number) => Math.min(1, Math.log1p(n) / Math.log1p(scale));

  const weight = Number(
    (
      0.5 * saturate(locations.size, 12) +
      0.3 * saturate(identities.size, 12) +
      0.2 * saturate(devices.size, 12)
    ).toFixed(3)
  );

  const priorityContribution = Math.round(weight * MAX_SPREAD_PRIORITY_POINTS);

  return {
    totalReports: issue.stakes.length,
    distinctIdentities: identities.size,
    distinctLocations: locations.size,
    distinctDevices: devices.size,
    weight,
    priorityContribution,
    label: describeSpread(locations.size, identities.size, issue.stakes.length),
  };
}

/**
 * Spread is displayed as spread, never as a count.
 *
 * "18 reports" invites the reader to treat volume as truth. "Reported
 * from 9 distinct locations by 11 verified citizens" tells them what
 * the number actually establishes.
 */
function describeSpread(locations: number, identities: number, total: number): string {
  if (total <= 1) return 'Reported by one citizen';

  const parts: string[] = [];
  if (locations > 0) {
    parts.push(`${locations} distinct location${locations === 1 ? '' : 's'}`);
  }
  if (identities > 0) {
    parts.push(`${identities} verified citizen${identities === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) return `${total} reports`;
  if (locations <= 1 && total > 3) {
    // Said plainly, because this is the brigading shape.
    return `${total} reports, but all from ${parts[0]}`;
  }
  return `Reported from ${parts.join(' by ')}`;
}

/**
 * Priority for a complaint, recomputed against current support.
 *
 * Confirmations are capped and never dominate: severity, safety and SLA
 * decide the queue. Otherwise the loudest neighbourhood simply wins by a
 * different route, which is the failure mode the whole spread weighting
 * exists to close.
 */
export function priorityWithSpread(basePriority: number, issue: CivicIssue | null): number {
  if (!issue) return basePriority;
  return Math.min(99, basePriority + computeSpread(issue).priorityContribution);
}
