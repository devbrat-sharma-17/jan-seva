// ============================================================
// GET /api/complaints/:id — public complaint tracking
// ============================================================
// Closes the split brain: complaints were being WRITTEN to Postgres and
// READ from localStorage, so a real submission returned a real ticket
// number that `/track` could never find.
//
//   KNOWING A TICKET ID IS NOT AUTHENTICATION.
//   Ticket ids are printed, forwarded and screenshotted. This endpoint
//   therefore assumes the caller is a stranger and returns the PUBLIC
//   projection only — never the reporter, never the exact coordinates,
//   never internal state. The richer view a verified citizen gets is a
//   different, authenticated path and is not this one.
//
//   THE COLUMN LIST IS AN ALLOW-LIST, DELIBERATELY.
//   Not `select=*` minus a few fields. A new column added to
//   `complaints` in a later migration must be invisible here until
//   someone decides otherwise — the default for civic data has to be
//   "not published", and a deny-list inverts that with no warning.

import { apiError, apiOk, withErrorHandling } from '../_lib/errors';
import { select, isDbConfigured, dbUnavailable } from '../_lib/db';

/** Web-standard handler — see api/complaints/create.ts. */
export const config = { runtime: 'edge' };

/**
 * Public tracking window after resolution. Mirrors
 * IDENTITY_RETENTION_MS in src/services/privacyService.ts; the two must
 * agree or the client and the server will disagree about whether a
 * complaint is still trackable.
 */
const PUBLIC_RETENTION_MS = 48 * 60 * 60 * 1000;

/**
 * Exactly what may be published. Note what is ABSENT and why:
 *
 *   identity_reference, identity_masked, identity_method  the reporter
 *   gps_lat, gps_lng, gps_accuracy_m, gps_captured_at     where the
 *                                                         phone was
 *   lat, lng, formatted_address    the doorstep. `locality` is the
 *                                  published granularity (spec §30).
 *   moderation, ai_analysis, priority_score, is_synthetic  internal
 *   assigned_to                    a named municipal employee tied to
 *                                  one citizen's complaint
 */
const PUBLIC_COLUMNS = [
  'id',
  'city_id',
  'status',
  'category',
  'severity',
  'locality',
  'department_id',
  'sla_due_at',
  'sla_state',
  'resolved_at',
  'citizen_verified',
  'evidence_grade',
  'issue',
  'created_at',
  'updated_at',
].join(',');

interface ComplaintRow {
  id: string;
  city_id: string;
  status: string;
  category: string;
  severity: string | null;
  locality: string | null;
  department_id: string | null;
  sla_due_at: string | null;
  sla_state: string;
  resolved_at: string | null;
  citizen_verified: boolean;
  evidence_grade: string | null;
  issue: { title?: string; description?: string } | null;
  created_at: string;
  updated_at: string;
}

interface TimelineRow {
  occurred_at: string;
  status: string | null;
  title: string;
  description: string | null;
  actor_label: string | null;
  actor_type: string | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  short_name: string;
  helpline: string | null;
}

interface CityRow {
  id: string;
  name: string;
  state: string;
}

/**
 * The ticket format, and the only shape this endpoint will look up.
 *
 * Rejecting a malformed id before touching the database is not just
 * tidiness: it keeps a scanner probing `../` or SQL fragments from
 * reaching a query at all, and the id lands in a PostgREST filter below.
 */
const TICKET_PATTERN = /^JS-[A-Z]{3}-\d{4}-\d{4,6}$/;

/** Accepts the many ways a ticket gets pasted, then validates strictly. */
function normaliseId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
}

function isTrackable(row: ComplaintRow, now: number): boolean {
  // Only RESOLVED complaints ever stop being trackable. An open one stays
  // visible however old, because the citizen is still waiting on it and
  // expiring it would be the city walking away from unfinished work.
  if (row.status !== 'resolved') return true;
  const anchor = row.resolved_at ? new Date(row.resolved_at).getTime() : null;
  if (anchor === null || Number.isNaN(anchor)) return true;
  return now - anchor < PUBLIC_RETENTION_MS;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return apiError('VALIDATION_ERROR', 'Unsupported request.');
  }

  // The path is the id's only source. A query parameter would be a second
  // way to address the same record, and two ways to say the same thing is
  // how one of them ends up unvalidated.
  const path = new URL(request.url, 'http://localhost').pathname;
  const raw = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
  const id = normaliseId(raw);

  if (!TICKET_PATTERN.test(id)) {
    // Deliberately the same answer as a genuine miss. Telling a caller
    // that an id is "well-formed but unknown" turns this into an oracle
    // for enumerating which tickets exist.
    return apiOk({ kind: 'not-found' });
  }

  if (!isDbConfigured()) return dbUnavailable();

  const rows = await select<ComplaintRow>(
    'complaints',
    `id=eq.${encodeURIComponent(id)}&select=${PUBLIC_COLUMNS}&limit=1`
  );
  const row = rows[0];
  if (!row) return apiOk({ kind: 'not-found' });

  const now = Date.now();
  const trackable = isTrackable(row, now);

  const [departments, cities] = await Promise.all([
    row.department_id
      ? select<DepartmentRow>(
          'departments',
          `id=eq.${encodeURIComponent(row.department_id)}&select=id,name,short_name,helpline&limit=1`
        )
      : Promise.resolve([]),
    select<CityRow>('cities', `id=eq.${encodeURIComponent(row.city_id)}&select=id,name,state&limit=1`),
  ]);

  const department = departments[0];
  const city = cities[0];

  // Public events only. `visibility='internal'` covers moderation notes
  // and officer commentary, and filtering it in SQL means it is never in
  // a response object that some later refactor might forget to strip.
  const timeline = trackable
    ? await select<TimelineRow>(
        'timeline_events',
        `complaint_id=eq.${encodeURIComponent(id)}` +
          `&visibility=eq.public` +
          `&select=occurred_at,status,title,description,actor_label,actor_type` +
          `&order=occurred_at.desc`
      )
    : [];

  const area = {
    locality: row.locality ?? 'City Centre',
    city: city?.name ?? '',
    state: city?.state ?? '',
  };

  const expiresAt =
    row.status === 'resolved' && row.resolved_at
      ? new Date(new Date(row.resolved_at).getTime() + PUBLIC_RETENTION_MS).toISOString()
      : undefined;

  if (!trackable) {
    // NOT a dead end, and not "not found". The identity link has lapsed;
    // the record of the repair has not, and a citizen who looks it up
    // deserves to see the work is on the city's permanent books. The
    // archived shape only ever REMOVES from the live one — no officer, no
    // photographs, no timeline.
    return apiOk({
      kind: 'expired',
      resolvedAt: row.resolved_at ?? row.updated_at,
      archived: {
        id: row.id,
        cityId: row.city_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        issue: { category: row.category, title: row.issue?.title ?? '', description: '' },
        photoCount: 0,
        protectedPhotos: [],
        resolutionEvidenceCount: 0,
        protectedResolutionPhotos: [],
        area,
        department: department
          ? { id: department.id, name: department.name, division: '', helpline: department.helpline ?? '' }
          : undefined,
        sla: { dueAt: row.sla_due_at ?? row.updated_at, status: row.sla_state },
        timeline: [],
        resolution: row.resolved_at
          ? { resolvedAt: row.resolved_at, citizenVerifiedResolved: row.citizen_verified }
          : undefined,
        expiresAt,
        isPubliclyTrackable: false,
        isArchived: true,
        evidenceGrade: row.evidence_grade ?? undefined,
      },
    });
  }

  return apiOk({
    kind: 'found',
    complaint: {
      id: row.id,
      cityId: row.city_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,

      issue: {
        category: row.category,
        title: row.issue?.title ?? '',
        description: row.issue?.description ?? '',
      },

      // Evidence is not wired to Storage yet. Reporting zero is honest;
      // inventing a count or a signed URL would not be.
      photoCount: 0,
      protectedPhotos: [],
      resolutionEvidenceCount: 0,
      protectedResolutionPhotos: [],

      // Locality granularity only — never the confirmed coordinates.
      area,

      department: department
        ? {
            id: department.id,
            name: department.name,
            division: '',
            helpline: department.helpline ?? '',
          }
        : { id: undefined, name: 'Awaiting routing', division: '', helpline: '' },

      sla: { dueAt: row.sla_due_at ?? row.updated_at, status: row.sla_state },

      timeline: timeline.map((event, index) => ({
        id: `${row.id}-tl-${index}`,
        title: event.title,
        description: event.description ?? '',
        timestamp: event.occurred_at,
        status: event.status ?? row.status,
        actor: event.actor_label ?? undefined,
        actorType: event.actor_type ?? undefined,
      })),

      latestUpdate: timeline[0]
        ? {
            title: timeline[0].title,
            description: timeline[0].description ?? '',
            timestamp: timeline[0].occurred_at,
          }
        : undefined,

      resolution: row.resolved_at
        ? { resolvedAt: row.resolved_at, citizenVerifiedResolved: row.citizen_verified }
        : undefined,

      expiresAt,
      isPubliclyTrackable: true,
      isArchived: false,
      evidenceGrade: row.evidence_grade ?? undefined,
    },
  });
}

export default withErrorHandling(handler);
