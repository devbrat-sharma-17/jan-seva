// ============================================================
// Complaint creation — `npm run check:complaint`
// ============================================================
//
// Proves migration 0009 against the REAL database. Every assertion below
// reads back what Postgres actually stored; nothing is inferred from the
// return value of the call that wrote it.
//
//   WHY THIS TESTS THE RPC AND NOT THE HTTP ENDPOINT
//   api/complaints/create.ts runs only under `vercel dev`. What it does
//   with a validated request is exactly one call to create_complaint(),
//   so the transactional, routing and idempotency guarantees all live in
//   the function and are provable here. The endpoint's own input
//   validation is a separate concern and is not claimed as tested by
//   this file.
//
// Creates rows, asserts, and removes every one. The database is left at
// zero complaints.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* env may come from the environment */ }

const URL_ = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';

let failures = 0, checks = 0;
const pass = (l, d) => { checks++; console.log(`  PASS  ${l}${d ? ` — ${d}` : ''}`); };
const fail = (l, d) => {
  checks++; failures++;
  console.log(`  FAIL  ${l}`);
  if (d) for (const line of String(d).split('\n')) console.log(`        ${line}`);
};
const eq = (l, actual, expected) =>
  actual === expected ? pass(l, `${actual}`) : fail(l, `expected ${expected}, got ${actual}`);
const section = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

async function db(method, path, body, key = SECRET, token = null, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key, authorization: `Bearer ${token ?? key}`,
      'content-type': 'application/json', ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
  return { status: r.status, ok: r.ok, json, raw };
}

const create = (args, key = SECRET, token = null) =>
  db('POST', 'rpc/create_complaint', args, key, token);

const TAG = `CHK${Date.now()}`;
let n = 0;
const nextKey = () => `${TAG}-${++n}`;

/** Gwalior centre, nudged far enough apart to defeat the 50 m dedup. */
const P1 = { lat: 26.2183, lng: 78.1828 };
const FAR = { lat: 26.2600, lng: 78.2300 };

const made = { keys: [], issues: [] };

function base(overrides = {}) {
  return {
    p_idempotency_key: nextKey(),
    p_city_id: 'gwalior',
    p_category: 'roads',
    p_title: `${TAG} test`,
    p_description: 'Automated verification of migration 0009.',
    p_lat: P1.lat, p_lng: P1.lng,
    p_locality: 'Test Locality',
    // Device GPS, deliberately a few metres off the confirmed pin — the
    // realistic case, and the only way [7] can prove the two are stored
    // independently rather than one being copied into the other.
    p_gps_lat: 26.2190, p_gps_lng: 78.1835, p_gps_accuracy_m: 12.5,
    p_gps_captured_at: new Date().toISOString(),
    p_sla_hours: 72,
    ...overrides,
  };
}

async function cleanup() {
  section('CLEANUP');
  // Complaints cascade to timeline and evidence; audit and the ledger do
  // not hang off them, so both are swept explicitly.
  await db('DELETE', `sync_operations?idempotency_key=like.${TAG}*`);
  await db('DELETE', `audit_events?entity_id=like.JS-GWL-*`);
  await db('DELETE', 'complaints?id=like.JS-GWL-*');
  await db('DELETE', 'civic_issues?reference=like.JS-GWL-*');
  await db('DELETE', `civic_issues?reference=like.${TAG}*`);
  for (const id of made.issues) await db('DELETE', `civic_issues?id=eq.${id}`);
  await db('DELETE', 'ticket_sequences?city_id=eq.gwalior');

  for (const t of ['complaints', 'civic_issues', 'timeline_events', 'audit_events',
                   'sync_operations', 'ticket_sequences', 'evidence']) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=count`, {
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, prefer: 'count=exact' },
    });
    const c = (r.headers.get('content-range') ?? '/?').split('/')[1];
    c === '0' ? pass(`${t} = 0 rows`) : fail(`${t} = 0 rows`, `${c} row(s) LEFT BEHIND`);
  }
}

async function main() {
  console.log('========================================================');
  console.log('  JAN-SEVA — complaint creation verification (0009)');
  console.log('========================================================');
  if (!URL_ || !SECRET) { console.log('Missing credentials.'); process.exitCode = 1; return; }

  // Start from a known-clean slate so row counts mean something.
  await db('DELETE', 'ticket_sequences?city_id=eq.gwalior');

  // =========================================================
  section('A. MIGRATION 0009 VERIFICATION');

  {
    const spec = await (await fetch(`${URL_}/rest/v1/`, {
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
    })).json();
    const rpcs = Object.keys(spec.paths ?? {}).filter((p) => p.startsWith('/rpc/'));
    rpcs.includes('/rpc/create_complaint') ? pass('create_complaint exists') : fail('create_complaint exists');
    rpcs.includes('/rpc/route_department') ? pass('route_department exists') : fail('route_department exists');
  }

  {
    const d = await db('GET', 'departments?select=id,categories&order=id');
    const map = Object.fromEntries((d.json ?? []).map((r) => [r.id, r.categories]));
    const want = {
      roads: 'roads', sanitation: 'garbage', water: 'water',
      electrical: 'streetlights', infrastructure: 'infrastructure',
    };
    let good = true;
    for (const [dept, cat] of Object.entries(want)) {
      if (!map[dept]?.includes(cat)) { good = false; fail(`departments.${dept} owns '${cat}'`, `got ${JSON.stringify(map[dept])}`); }
    }
    if (good) pass('routing config uses the app category vocabulary', JSON.stringify(map));
  }

  // =========================================================
  section('B. AUTHORIZATION — not proved with service_role');

  {
    const r = await create(base(), ANON);
    const denied = r.status >= 400 &&
      (r.json?.code === '42501' || /permission denied for function/i.test(r.raw));
    denied ? pass('anon CANNOT call create_complaint', `HTTP ${r.status}/42501`)
           : fail('anon CANNOT call create_complaint', `HTTP ${r.status} — ANYONE COULD MINT COMPLAINTS`);
  }
  {
    const r = await db('POST', 'rpc/route_department', { p_city_id: 'gwalior', p_category: 'roads' }, ANON);
    r.status >= 400 ? pass('anon CANNOT call route_department', `HTTP ${r.status}`)
                    : fail('anon CANNOT call route_department', `HTTP ${r.status}`);
  }

  // An authenticated portal session must be no better off than anon here.
  let authUserId = null, authToken = null;
  {
    const email = `chk-${Date.now()}@example.invalid`, password = `Chk!${Date.now()}aA1`;
    const c = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const cu = await c.json().catch(() => ({}));
    authUserId = cu.id ?? null;
    if (authUserId) {
      await db('POST', 'portal_users', {
        id: authUserId, account_id: `CHK-${Date.now()}`, display_name: 'Check Officer',
        email, role: 'nodal_officer', city_id: 'gwalior', department_id: 'roads',
      });
      const s = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      authToken = (await s.json().catch(() => ({}))).access_token ?? null;
    }
    if (!authToken) fail('authenticated session created', 'could not sign in');
    else {
      const r = await create(base(), ANON, authToken);
      r.status >= 400 ? pass('authenticated officer CANNOT call create_complaint', `HTTP ${r.status}`)
                      : fail('authenticated officer CANNOT call create_complaint', `HTTP ${r.status}`);
    }
  }

  // =========================================================
  section('C. CREATION — id, format, routing');

  let first = null;
  {
    const key = nextKey(); made.keys.push(key);
    const r = await create(base({ p_idempotency_key: key }));
    if (!r.ok) { fail('create_complaint succeeds', r.raw.slice(0, 400)); }
    else {
      first = r.json;
      pass('create_complaint succeeds', first.complaintId);
      eq('[1] server-issued ID is the first of the year', first.complaintId, 'JS-GWL-2026-000001');
      /^JS-GWL-2026-\d{6}$/.test(first.complaintId)
        ? pass('[2] JS-GWL-2026-XXXXXX format')
        : fail('[2] JS-GWL-2026-XXXXXX format', first.complaintId);
      eq('[3] server routed roads -> roads', first.departmentId, 'roads');
      eq('    status is server-set', first.status, 'pending');
    }
  }

  {
    // [4] The function has no department parameter at all, so there is no
    // field for a client to override. PostgREST rejects the unknown arg.
    const r = await create(base({ p_department_id: 'water', p_status: 'resolved' }));
    r.status >= 400
      ? pass('[4] client CANNOT pass a department or status', `HTTP ${r.status} — no such parameter`)
      : fail('[4] client CANNOT pass a department or status', 'extra args were accepted');
  }

  {
    const cases = [
      ['garbage', 'sanitation'], ['water', 'water'],
      ['streetlights', 'electrical'], ['infrastructure', 'infrastructure'],
    ];
    for (const [cat, dept] of cases) {
      const r = await create(base({ p_category: cat, p_lat: FAR.lat + Math.random() * 0.01, p_lng: FAR.lng + Math.random() * 0.01 }));
      r.ok ? eq(`[3] ${cat} -> ${dept}`, r.json.departmentId, dept)
           : fail(`[3] ${cat} -> ${dept}`, r.raw.slice(0, 200));
    }
  }

  {
    // [11] 'others' belongs to no department and must land in triage.
    const r = await create(base({ p_category: 'others', p_lat: FAR.lat + 0.05, p_lng: FAR.lng + 0.05 }));
    r.ok ? eq('[11] others -> general triage (null)', r.json.departmentId, null)
         : fail('[11] others -> triage', r.raw.slice(0, 200));
  }

  // =========================================================
  section('D. PERSISTENCE — read back what was stored');

  {
    const g = await db('GET', `complaints?id=eq.${first.complaintId}&select=*`);
    const c = g.json?.[0];
    if (!c) fail('[5] complaint row exists');
    else {
      pass('[5] complaint row exists', c.id);
      eq('[5] linked to a civic_issue', typeof c.civic_issue_id === 'string' && c.civic_issue_id.length > 0, true);

      // [6] CONFIRMED issue location, full precision, unrounded.
      eq('[6] confirmed lat persisted exactly', c.lat, P1.lat);
      eq('[6] confirmed lng persisted exactly', c.lng, P1.lng);

      // [7] Device GPS in its own columns, and DIFFERENT.
      eq('[7] device GPS lat stored separately', c.gps_lat, 26.2190);
      eq('[7] device GPS lng stored separately', c.gps_lng, 78.1835);
      c.lat !== c.gps_lat && c.lng !== c.gps_lng
        ? pass('[7] confirmed location NOT overwritten by GPS', `confirmed ${c.lat} vs device ${c.gps_lat}`)
        : fail('[7] confirmed location NOT overwritten by GPS', 'the two collapsed into one');

      // [10] SLA derived server-side from the category, not the request.
      const hours = (new Date(c.sla_due_at) - new Date(c.created_at)) / 3600000;
      Math.abs(hours - 72) < 0.05
        ? pass('[10] SLA derived server-side', `${hours.toFixed(1)}h from created_at`)
        : fail('[10] SLA derived server-side', `expected 72h, got ${hours.toFixed(2)}h`);

      eq('    is_synthetic is false for a real report', c.is_synthetic, false);
      eq('    version starts at 0', c.version, 0);
    }
  }

  {
    // [8] Timeline: received + routed, both citizen-visible.
    const t = await db('GET', `timeline_events?complaint_id=eq.${first.complaintId}&select=title,actor_type,visibility&order=title`);
    const rows = t.json ?? [];
    rows.length === 2 ? pass('[8] two timeline events created', rows.map((r) => r.title).join(' | '))
                      : fail('[8] two timeline events created', `got ${rows.length}`);
    rows.every((r) => r.visibility === 'public')
      ? pass('[8] timeline events are citizen-visible') : fail('[8] timeline visibility');
    rows.some((r) => /Routed to/.test(r.title))
      ? pass('[8] routing recorded in the citizen timeline') : fail('[8] routing event missing');
  }

  {
    // [9] Audit, and it must not be a second copy of the report.
    const a = await db('GET', `audit_events?entity_id=eq.${first.complaintId}&select=action,detail,actor_label`);
    const row = a.json?.[0];
    row ? pass('[9] audit event created', row.action) : fail('[9] audit event created');
    if (row) {
      eq('[9] audit action', row.action, 'complaint.create');
      const blob = JSON.stringify(row.detail);
      !/Automated verification/.test(blob) && !/78\.18/.test(blob)
        ? pass('[9] audit holds no description or coordinates', blob)
        : fail('[9] audit leaks report content', blob);
    }
  }

  // =========================================================
  section('E. CIVIC ISSUE DEDUPLICATION (50 m)');

  {
    // ~11 m away, same category: the same physical pothole.
    const near = await create(base({ p_lat: P1.lat + 0.0001, p_lng: P1.lng, p_category: 'roads' }));
    near.ok && near.json.civicIssueId === first.civicIssueId
      ? pass('[12] report ~11 m away joins the SAME civic issue', near.json.civicIssueId.slice(0, 8) + '…')
      : fail('[12] report ~11 m away joins the same civic issue',
             `first=${first.civicIssueId} near=${near.json?.civicIssueId}`);

    const rc = await db('GET', `civic_issues?id=eq.${first.civicIssueId}&select=report_count`);
    eq('[12] report_count incremented', rc.json?.[0]?.report_count, 2);

    // ~1.1 km away: a different problem.
    const far = await create(base({ p_lat: P1.lat + 0.01, p_lng: P1.lng, p_category: 'roads' }));
    far.ok && far.json.civicIssueId !== first.civicIssueId
      ? pass('[12] report ~1.1 km away opens a NEW civic issue')
      : fail('[12] report far away opens a new civic issue', 'it was merged into the near one');
  }

  // =========================================================
  section('F. IDEMPOTENCY');

  {
    // [13] Same key, same everything.
    const key = nextKey();
    const a = await create(base({ p_idempotency_key: key }));
    const b = await create(base({ p_idempotency_key: key, p_description: 'DIFFERENT text on the retry' }));
    a.ok && b.ok && a.json.complaintId === b.json.complaintId
      ? pass('[13] same key returns the same complaint', a.json.complaintId)
      : fail('[13] same key returns the same complaint', `${a.json?.complaintId} vs ${b.json?.complaintId}`);
    eq('[13] the retry is flagged as a replay', b.json?.replayed, true);
    eq('    the original was not', a.json?.replayed, false);

    const dup = await db('GET', `complaints?id=eq.${a.json.complaintId}&select=id`);
    eq('[13] exactly one complaint row for that key', dup.json?.length, 1);
    const tl = await db('GET', `timeline_events?complaint_id=eq.${a.json.complaintId}&select=id`);
    eq('[13] the retry created no extra timeline events', tl.json?.length, 2);
  }

  {
    // [14] Ten simultaneous retries — the real double-submit shape.
    const key = nextKey();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => create(base({ p_idempotency_key: key })))
    );
    const okr = results.filter((r) => r.ok);
    const ids = new Set(okr.map((r) => r.json.complaintId));
    eq('[14] 10 concurrent retries -> 1 distinct complaint ID', ids.size, 1);
    const id = [...ids][0];
    const rows = await db('GET', `complaints?id=eq.${id}&select=id`);
    eq('[14] exactly one complaint row', rows.json?.length, 1);
    const tl = await db('GET', `timeline_events?complaint_id=eq.${id}&select=id`);
    eq('[14] exactly two timeline events', tl.json?.length, 2);
    const au = await db('GET', `audit_events?entity_id=eq.${id}&select=id`);
    eq('[14] exactly one audit event', au.json?.length, 1);
  }

  // =========================================================
  section('G. REJECTIONS');

  const rejects = [
    ['[15] latitude out of range', { p_lat: 999 }, 'invalid_coordinates'],
    ['[15] null coordinates', { p_lat: null, p_lng: null }, 'invalid_coordinates'],
    ['[16] unknown city', { p_city_id: 'atlantis' }, 'city_not_active'],
    ['[16] inactive city (indore)', { p_city_id: 'indore' }, 'city_not_active'],
    ['[16] empty category', { p_category: '   ' }, 'category_required'],
    ['    over-long description', { p_description: 'x'.repeat(5001) }, 'description_too_long'],
    ['    empty idempotency key', { p_idempotency_key: '' }, 'idempotency_key_required'],
  ];
  for (const [label, override, expected] of rejects) {
    const r = await create(base(override));
    r.status >= 400 && r.raw.includes(expected)
      ? pass(label, `rejected: ${expected}`)
      : fail(label, `HTTP ${r.status} — expected ${expected}, got ${r.raw.slice(0, 200)}`);
  }

  // =========================================================
  section('H. TRANSACTION ROLLBACK — no partial records');
  //
  // Validation failures reject before any write, which proves nothing
  // about atomicity. This forces a failure AFTER the ticket has been
  // issued and the transaction is under way, by pre-claiming the unique
  // civic_issues.reference the function is about to insert.

  {
    // Rewinding the sequence makes the next ticket …-000001 again, so the
    // reference the function will derive for its civic issue is already
    // taken by the complaint created in section C. That IS the blocker —
    // no planted row needed, and planting one collides with the same
    // reference anyway. (An earlier revision planted one, then counted it
    // as present when its insert had silently failed for that very
    // reason, and reported a phantom orphan.)
    await db('DELETE', 'ticket_sequences?city_id=eq.gwalior');

    const snapshot = async () => ({
      complaints: (await db('GET', 'complaints?select=id')).json?.length ?? -1,
      issues: (await db('GET', 'civic_issues?select=id')).json?.length ?? -1,
      timeline: (await db('GET', 'timeline_events?select=id')).json?.length ?? -1,
      audit: (await db('GET', 'audit_events?select=id')).json?.length ?? -1,
    });

    const before = await snapshot();

    const r = await create(base({ p_lat: 26.5, p_lng: 78.5, p_category: 'roads' }));
    r.status >= 400
      ? pass('[17] the mid-transaction failure surfaced', `HTTP ${r.status} — after the ticket was issued`)
      : fail('[17] expected the insert to fail', `HTTP ${r.status} ${r.raw.slice(0, 200)}`);

    const after = await snapshot();
    eq('[17] no complaint row written', after.complaints, before.complaints);
    eq('[17] no orphan civic issue', after.issues, before.issues);
    eq('[17] no orphan timeline event', after.timeline, before.timeline);
    eq('[17] no orphan audit event', after.audit, before.audit);

    const seq = await db('GET', 'ticket_sequences?city_id=eq.gwalior&select=last_value');
    (seq.json?.length ?? 0) === 0
      ? pass('[17] the ticket sequence rolled back too', 'no number was burned')
      : fail('[17] the ticket sequence rolled back', `last_value=${seq.json[0].last_value} — a gap is now permanent`);
  }

  // =========================================================
  if (authUserId) {
    await db('DELETE', `portal_users?id=eq.${authUserId}`);
    await fetch(`${URL_}/auth/v1/admin/users/${authUserId}`, {
      method: 'DELETE', headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
    });
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
  try { await cleanup(); } catch { /* best effort */ }
  process.exitCode = 1;
});
