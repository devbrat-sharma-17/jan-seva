// ============================================================
// Public tracking verification — `npm run check:track`
// ============================================================
//
// Exercises the REAL GET /api/complaints/:id over HTTP, and closes the
// loop the write path opened: a complaint created through
// POST /api/complaints/create must be findable, by its returned ticket
// id, through the endpoint /track actually calls.
//
//   THE PII ASSERTIONS ARE THE POINT.
//   Knowing a ticket id is not authentication — ids get printed,
//   forwarded and screenshotted. So the tests below do not check that
//   the response "looks right"; they scan the ENTIRE serialised body for
//   values that were deliberately planted at creation time (a real
//   mobile-derived reference, the exact coordinates, the device GPS) and
//   fail if any of them appears anywhere in it.
//
// Start the server first:  npx vercel dev --listen 4100
// Then:                    CHECK_HTTP_BASE=http://localhost:4100 npm run check:track

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* */ }

const BASE = process.env.CHECK_HTTP_BASE ?? 'http://localhost:4100';
const URL_ = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let failures = 0, checks = 0;
const pass = (l, d) => { checks++; console.log(`  PASS  ${l}${d ? ` — ${d}` : ''}`); };
const fail = (l, d) => {
  checks++; failures++;
  console.log(`  FAIL  ${l}`);
  if (d) for (const line of String(d).split('\n')) console.log(`        ${line}`);
};
const eq = (l, a, b) => (a === b ? pass(l, `${a}`) : fail(l, `expected ${b}, got ${a}`));
const section = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

const TAG = `TRK${Date.now()}`;
let n = 0;

async function db(method, path, body, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, 'content-type': 'application/json', ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
  return { status: r.status, ok: r.ok, json, raw };
}

async function get(id) {
  const r = await fetch(`${BASE}/api/complaints/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
  return { status: r.status, ok: r.ok, json, raw };
}

async function create(overrides = {}) {
  const r = await fetch(`${BASE}/api/complaints/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `${TAG}-${++n}`,
      cityId: 'gwalior',
      category: 'roads',
      title: 'Pothole near market',
      description: 'Large pothole causing traffic problems near the main market road.',
      lat: 26.2183, lng: 78.1828,
      locality: 'Lashkar',
      address: 'Main Market Road, Lashkar, Gwalior',
      gpsLat: 26.2190, gpsLng: 78.1835, gpsAccuracy: 12.5,
      gpsCapturedAt: new Date().toISOString(),
      ...overrides,
    }),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function cleanup() {
  section('CLEANUP');
  await db('DELETE', `sync_operations?idempotency_key=like.${TAG}*`);
  await db('DELETE', 'sync_operations?entity_id=like.JS-GWL-*');
  await db('DELETE', 'audit_events?entity_id=like.JS-GWL-*');
  await db('DELETE', 'complaints?id=like.JS-GWL-*');
  await db('DELETE', 'civic_issues?reference=like.JS-GWL-*');
  await db('DELETE', 'ticket_sequences?city_id=eq.gwalior');
  await db('DELETE', 'rate_limits?bucket=like.complaint*');
  for (const t of ['complaints', 'civic_issues', 'timeline_events', 'audit_events',
                   'sync_operations', 'ticket_sequences', 'evidence']) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=count`, {
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, prefer: 'count=exact' },
    });
    const c = (r.headers.get('content-range') ?? '/?').split('/')[1];
    c === '0' ? pass(`${t} = 0 rows`) : fail(`${t} = 0 rows`, `${c} left behind`);
  }
}

async function main() {
  console.log('========================================================');
  console.log('  JAN-SEVA — public tracking verification');
  console.log(`  GET ${BASE}/api/complaints/:id`);
  console.log('========================================================');

  await db('DELETE', 'rate_limits?bucket=eq.complaint%3Acreate%3Aip');

  // --------------------------------------------------------
  section('0. CONTROL — the endpoint runs and is not the SPA');
  {
    const probe = await get('JS-GWL-2026-999999');
    if (/^\s*<!doctype html/i.test(probe.raw)) {
      fail('api/ answers, not the SPA rewrite', 'Got HTML — the function never ran.');
      process.exitCode = 1; return;
    }
    if (probe.json === null) {
      fail('endpoint returns JSON', `HTTP ${probe.status}: ${probe.raw.slice(0, 200)}`);
      process.exitCode = 1; return;
    }
    pass('endpoint returns JSON', `unknown id -> ${probe.json.kind}`);
  }

  // --------------------------------------------------------
  section('1. THE ROUND TRIP — create, then track by the returned id');
  let ticket = null;
  {
    const created = await create();
    eq('complaint created over HTTP', created.status, 201);
    ticket = created.json?.complaintId;
    if (!ticket) { fail('ticket id returned'); await cleanup(); process.exitCode = 1; return; }
    pass('ticket id returned', ticket);

    const found = await get(ticket);
    eq('[1] the SAME id is trackable', found.json?.kind, 'found');
    eq('[1] tracked id matches the created id', found.json?.complaint?.id, ticket);
    eq('[4] an open complaint is trackable', found.json?.complaint?.isPubliclyTrackable, true);
    eq('    status is the server\'s', found.json?.complaint?.status, 'pending');
    eq('    department resolved for display', found.json?.complaint?.department?.name, 'Public Works Department');
    eq('    locality published', found.json?.complaint?.area?.locality, 'Lashkar');
    Array.isArray(found.json?.complaint?.timeline) && found.json.complaint.timeline.length === 2
      ? pass('    public timeline returned', `${found.json.complaint.timeline.length} events`)
      : fail('    public timeline returned', `got ${found.json?.complaint?.timeline?.length}`);
  }

  // --------------------------------------------------------
  section('2-3. NONEXISTENT AND MALFORMED IDS');
  {
    eq('[2] well-formed but unknown id -> not-found', (await get('JS-GWL-2026-987654')).json?.kind, 'not-found');
    for (const [label, bad] of [
      ['gibberish', 'hello'],
      ['wrong prefix', 'XX-GWL-2026-000001'],
      ['path traversal', '../../etc/passwd'],
      ['SQL fragment', "JS-GWL-2026-000001' or '1'='1"],
      ['PostgREST operator injection', 'JS-GWL-2026-000001&status=eq.resolved'],
      ['empty', ' '],
    ]) {
      const r = await get(bad);
      r.json?.kind === 'not-found'
        ? pass(`[3] malformed id rejected safely (${label})`, `HTTP ${r.status} not-found`)
        : fail(`[3] malformed id rejected safely (${label})`, `HTTP ${r.status} ${r.raw.slice(0, 200)}`);
    }
    // A malformed id must answer exactly as an unknown one does, or the
    // difference becomes an oracle for which tickets exist.
    const a = await get('JS-GWL-2026-987654');
    const b = await get('not-a-ticket');
    a.raw === b.raw
      ? pass('[2/3] unknown and malformed are indistinguishable')
      : fail('[2/3] unknown and malformed are indistinguishable', `${a.raw} vs ${b.raw}`);
  }

  // --------------------------------------------------------
  section('7-9. PRIVACY — nothing personal in the public body');
  {
    // Plant values that MUST NOT come back, then scan the whole body.
    const REF = 'idref_v2_deadbeefdeadbeefdeadbeefdeadbeef';
    await db('PATCH', `complaints?id=eq.${ticket}`, {
      identity_reference: REF,
      identity_masked: '+91 XXXXX 43210',
      identity_method: 'mobile',
      identity_verified: true,
      formatted_address: 'House 42, Secret Lane, Lashkar',
    });
    await db('POST', 'timeline_events', {
      complaint_id: ticket, status: 'pending', title: 'INTERNAL moderation note',
      description: 'Officer suspects this reporter files repeatedly.',
      actor_type: 'admin', visibility: 'internal',
    });

    const r = await get(ticket);
    const body = r.raw;

    const banned = [
      ['[7] reporter identity reference', REF],
      ['[7] masked phone number', '43210'],
      ['[9] exact confirmed latitude', '26.2183'],
      ['[9] exact confirmed longitude', '78.1828'],
      ['[7] device GPS latitude', '26.219'],
      ['[7] device GPS longitude', '78.1835'],
      ['[9] street address', 'Secret Lane'],
      ['[9] internal timeline event', 'INTERNAL moderation note'],
      ['[9] internal note text', 'files repeatedly'],
      ['[8] identity_reference column name', 'identity_reference'],
      ['[8] moderation state', 'moderation'],
      ['[8] is_synthetic flag', 'is_synthetic'],
      ['[8] priority score column', 'priority_score'],
      ['[8] assigned officer column', 'assigned_to'],
    ];
    let leaked = 0;
    for (const [label, needle] of banned) {
      body.includes(needle)
        ? (leaked++, fail(`${label} NOT exposed`, `found "${needle}" in the public body`))
        : pass(`${label} NOT exposed`);
    }
    if (leaked === 0) pass('    full body scanned clean', `${body.length} bytes, ${banned.length} probes`);

    // And the internal event must not merely be absent from the text —
    // the public timeline must still contain the public ones.
    const titles = (r.json?.complaint?.timeline ?? []).map((t) => t.title);
    titles.length === 2 && !titles.some((t) => t.includes('INTERNAL'))
      ? pass('[9] internal events filtered, public events kept', titles.join(' | '))
      : fail('[9] internal events filtered, public events kept', JSON.stringify(titles));
  }

  // --------------------------------------------------------
  section('5-6. EXPIRY — resolved inside and outside the 48h window');
  {
    // Inside the window: resolved an hour ago.
    await db('PATCH', `complaints?id=eq.${ticket}`, {
      status: 'resolved',
      resolved_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      citizen_verified: true,
    });
    const inside = await get(ticket);
    eq('[5] resolved 1h ago is still trackable', inside.json?.kind, 'found');
    eq('[5] flagged as publicly trackable', inside.json?.complaint?.isPubliclyTrackable, true);
    inside.json?.complaint?.expiresAt
      ? pass('[5] expiry timestamp published', inside.json.complaint.expiresAt)
      : fail('[5] expiry timestamp published');

    // Outside: resolved 49 hours ago.
    await db('PATCH', `complaints?id=eq.${ticket}`, {
      resolved_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
    });
    const outside = await get(ticket);
    eq('[6] resolved 49h ago -> expired', outside.json?.kind, 'expired');
    outside.json?.kind === 'expired'
      ? pass('[6] "Complaint Tracking Ended", NOT "not found"', 'kind=expired')
      : fail('[6] expired is distinct from not-found', `got ${outside.json?.kind}`);
    eq('[6] archived record still carries the department', outside.json?.archived?.department?.name, 'Public Works Department');
    eq('[6] archived record is flagged archived', outside.json?.archived?.isArchived, true);
    eq('[6] archived timeline is emptied', outside.json?.archived?.timeline?.length, 0);
    !outside.raw.includes('idref_v2_')
      ? pass('[6] archived record leaks no identity')
      : fail('[6] archived record leaks no identity');

    // The operational record must SURVIVE public expiry.
    const still = await db('GET', `complaints?id=eq.${ticket}&select=id,status,resolved_at`);
    still.json?.length === 1
      ? pass('[6] operational record NOT deleted by expiry', 'row still in Postgres')
      : fail('[6] operational record NOT deleted by expiry', 'the row is gone');
  }

  // --------------------------------------------------------
  section('RLS BOUNDARY — the read path did not open a new door');
  {
    const anon = process.env.VITE_SUPABASE_ANON_KEY ?? '';
    if (!anon) console.log('  SKIP  no anon key');
    else {
      const r = await fetch(`${URL_}/rest/v1/complaints?select=*&limit=1`, {
        headers: { apikey: anon, authorization: `Bearer ${anon}` },
      });
      const raw = await r.text();
      r.status >= 400 || raw.includes('42501')
        ? pass('anon still cannot read complaints directly', `HTTP ${r.status}/42501`)
        : fail('anon still cannot read complaints directly', `HTTP ${r.status} — RLS regressed`);
    }
  }

  await cleanup();

  console.log('\n========================================================');
  console.log(failures === 0
    ? `  RESULT: PASSED — ${checks} checks, 0 failures.`
    : `  RESULT: FAILED — ${failures} of ${checks} checks failed.`);
  console.log('========================================================\n');
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('\nUnexpected failure:', err instanceof Error ? err.message : err);
  try { await cleanup(); } catch { /* */ }
  process.exitCode = 1;
});
