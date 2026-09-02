// ============================================================
// RLS verification — `npm run check:rls`
// ============================================================
//
// Every check in check-db.mjs runs as service_role, which BYPASSES RLS by
// design. Those checks prove the database works and prove exactly nothing
// about whether a browser is contained. This file is the other half.
//
//   THE TRAP THIS FILE IS BUILT TO AVOID
//   An invalid API key returns 401. "Denied" is also what correct
//   containment looks like. A suite that only asserts "anon cannot read
//   complaints" passes just as loudly with a typo'd key as with perfect
//   policies — and would certify a database nobody had actually tested.
//   So CONTROL CHECKS RUN FIRST: the anon key must be proven to
//   authenticate, and each signed-in role must be proven to read
//   SOMETHING, before any denial is counted as evidence.
//
//   GRANTS AND RLS ARE DIFFERENT GATES, AND THIS REPORTS WHICH ONE FIRED
//   403/42501 = no table privilege; the request never reached a policy.
//   200 + []   = privilege granted, RLS filtered every row.
//   Both are denials. Conflating them hides which control is load-bearing,
//   so each result below names the gate.
//
// Creates real auth users and portal_users rows (department isolation
// cannot be tested without them), then removes every one. Run:
//
//   npm run check:rls

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  try {
    const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* may come from the real environment */ }
}
loadEnvLocal();

const URL_ = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

let failures = 0;
let checks = 0;
const pass = (l, d) => { checks++; console.log(`  PASS  ${l}${d ? ` — ${d}` : ''}`); };
const fail = (l, d) => {
  checks++; failures++;
  console.log(`  FAIL  ${l}`);
  if (d) for (const line of String(d).split('\n')) console.log(`        ${line}`);
};
const section = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

/** Request as a given identity. `token` null ⇒ the key itself is the identity. */
async function as(key, token, method, path, body, extraHeaders = {}) {
  const headers = {
    apikey: key,
    authorization: `Bearer ${token ?? key}`,
    'content-type': 'application/json',
    ...extraHeaders,
  };
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
  return { status: r.status, ok: r.ok, json, raw };
}

/**
 * Classifies a read. The distinction between the two denial shapes is the
 * point of the whole file.
 */
function classify(res) {
  // PostgREST answers a PRIVILEGE failure with 401 for the `anon` role and
  // 403 for `authenticated`, and the status alone cannot tell those apart
  // from a bad key. The body can: a Postgres 42501 means the request
  // authenticated fine and was then refused by table privileges. Reading
  // the status only, an earlier version of this file declared a perfectly
  // good anon key "invalid" and aborted the whole suite.
  const privilegeDenied =
    res.json?.code === '42501' || /permission denied for (table|relation)/i.test(res.raw ?? '');

  if (privilegeDenied) {
    return { kind: 'NO_GRANT', label: `HTTP ${res.status}/42501 — no table privilege` };
  }
  if (res.status === 401) return { kind: 'AUTH_FAILED', label: 'HTTP 401 — key rejected' };
  if (res.status === 403) return { kind: 'NO_GRANT', label: 'HTTP 403 — refused' };
  if (res.status === 404) return { kind: 'NOT_EXPOSED', label: 'HTTP 404 — not in schema cache' };
  if (res.ok && Array.isArray(res.json) && res.json.length === 0) {
    return { kind: 'RLS_EMPTY', label: 'HTTP 200 + [] — RLS filtered all rows' };
  }
  if (res.ok) return { kind: 'READ', label: `HTTP 200 — ${res.json?.length ?? '?'} row(s) VISIBLE` };
  return { kind: 'OTHER', label: `HTTP ${res.status}` };
}

const DENIED = new Set(['NO_GRANT', 'RLS_EMPTY', 'NOT_EXPOSED']);

/** Asserts a read is denied, and reports which gate did it. */
async function mustNotRead(label, key, token, table) {
  const c = classify(await as(key, token, 'GET', `${table}?select=*&limit=1`));
  if (c.kind === 'AUTH_FAILED') return fail(`${label} — ${table}`, `${c.label}\nKey is invalid; this is NOT evidence of containment.`);
  if (DENIED.has(c.kind)) return pass(`${label} cannot read ${table}`, c.label);
  fail(`${label} cannot read ${table}`, `${c.label}  <-- DATA EXPOSED`);
}

async function mustRead(label, key, token, table) {
  const c = classify(await as(key, token, 'GET', `${table}?select=*&limit=1`));
  if (c.kind === 'READ') return pass(`${label} CAN read ${table}`, c.label);
  fail(`${label} CAN read ${table}`, `${c.label}  <-- expected rows; policy may be too strict`);
}

// ------------------------------------------------------------

const ALL_TABLES = [
  'cities', 'departments', 'portal_users', 'civic_assets', 'asset_repairs',
  'civic_issues', 'complaints', 'timeline_events', 'evidence', 'evidence_hashes',
  'audit_events', 'otp_challenges', 'rate_limits', 'sync_operations',
  'notification_outbox', 'ticket_sequences', 'image_analysis_results',
  'risk_assessments', 'moderation_cases', 'citizen_abuse_profiles',
  'citizen_warnings', 'sla_events', 'escalations', 'feedback',
];

/** RLS enabled, NO policy — unreachable by any client role, by design. */
const SENSITIVE = [
  'otp_challenges', 'rate_limits', 'sync_operations', 'notification_outbox',
  'evidence_hashes', 'citizen_abuse_profiles', 'citizen_warnings', 'ticket_sequences',
];

const stamp = Date.now();
const users = {
  roads: { email: `rls-test-roads-${stamp}@example.invalid`, password: `Test!${stamp}aA1`, role: 'nodal_officer', dept: 'roads' },
  water: { email: `rls-test-water-${stamp}@example.invalid`, password: `Test!${stamp}bB2`, role: 'nodal_officer', dept: 'water' },
  admin: { email: `rls-test-admin-${stamp}@example.invalid`, password: `Test!${stamp}cC3`, role: 'admin', dept: null },
};
const created = { authIds: [], complaints: [], issues: [] };

async function adminApi(method, path, body) {
  const r = await fetch(`${URL_}/auth/v1/${path}`, {
    method,
    headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
  return { status: r.status, ok: r.ok, json, raw };
}

async function signIn(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => ({}));
  return j.access_token ?? null;
}

async function cleanup() {
  section('CLEANUP');
  await as(SECRET, null, 'DELETE', 'audit_events?action=eq.rls.test');
  for (const id of created.complaints) await as(SECRET, null, 'DELETE', `complaints?id=eq.${id}`);
  for (const id of created.issues) await as(SECRET, null, 'DELETE', `civic_issues?id=eq.${id}`);
  // Belt and braces: sweep by the fixture's reference prefix as well, so a
  // run that died before recording an id cannot leave rows behind.
  await as(SECRET, null, 'DELETE', 'civic_issues?reference=like.RLS-*');
  for (const id of created.authIds) {
    await as(SECRET, null, 'DELETE', `portal_users?id=eq.${id}`);
    await adminApi('DELETE', `admin/users/${id}`);
  }
  await as(SECRET, null, 'DELETE', 'ticket_sequences?city_id=eq.gwalior');

  for (const t of ['complaints', 'civic_issues', 'portal_users', 'ticket_sequences', 'audit_events']) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=count`, {
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, prefer: 'count=exact' },
    });
    const n = (r.headers.get('content-range') ?? '/?').split('/')[1];
    n === '0' ? pass(`${t} back to empty`) : fail(`${t} back to empty`, `${n} row(s) LEFT BEHIND`);
  }
}

async function main() {
  console.log('========================================================');
  console.log('  JAN-SEVA — RLS verification');
  console.log('========================================================');

  if (!URL_ || !SECRET) { console.log('\nMissing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
  if (!ANON) { console.log('\nMissing VITE_SUPABASE_ANON_KEY — cannot test the browser boundary.'); process.exit(1); }

  // ----------------------------------------------------------
  section('0. CONTROLS — is the anon key even real?');
  //
  // Without this, every denial below is worthless: a typo'd key denies
  // everything and looks like flawless security.
  //
  // The control hits GoTrue, not PostgREST, deliberately: /auth/v1/settings
  // accepts the anon key and does not depend on a single table privilege,
  // so it separates "is this key real" from "may this role read tables".
  // PostgREST cannot answer the first question on its own — it returns 401
  // both for a forged key and for a valid key with no grants.
  {
    const r = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: ANON } });
    if (!r.ok) {
      fail('anon key authenticates', `GoTrue HTTP ${r.status} — the key is INVALID.\nEvery "denied" result below would be meaningless. Stopping.`);
      process.exitCode = 1;
      return;
    }
    pass('anon key authenticates', `GoTrue /settings HTTP ${r.status}`);
  }

  // ----------------------------------------------------------
  section('1. ANON — the public. Must reach nothing.');
  for (const t of ALL_TABLES) await mustNotRead('anon', ANON, null, t);

  section('2. ANON — privileged RPC');
  {
    // Same status/body subtlety as tables: the anon role's EXECUTE
    // failure arrives as 401 carrying 42501, not as 403.
    const r = await as(ANON, null, 'POST', 'rpc/next_complaint_id', { p_city_id: 'gwalior' });
    const denied = r.status >= 400 &&
      (r.json?.code === '42501' || /permission denied for function/i.test(r.raw ?? ''));
    denied
      ? pass('anon cannot call next_complaint_id', `HTTP ${r.status}/42501 — execute revoked`)
      : fail('anon cannot call next_complaint_id', `HTTP ${r.status} — ${r.raw.slice(0, 200)}\n<-- a client could burn ticket numbers`);
  }

  section('3. ANON — writes');
  {
    const r = await as(ANON, null, 'POST', 'complaints', {
      id: `RLS-ANON-${stamp}`, city_id: 'gwalior', category: 'x', lat: 26.2, lng: 78.1,
    });
    r.status >= 400
      ? pass('anon cannot INSERT a complaint', `HTTP ${r.status}`)
      : fail('anon cannot INSERT a complaint', `HTTP ${r.status} <-- ANYONE CAN WRITE`);
  }

  // ----------------------------------------------------------
  section('4. FIXTURES — real staff accounts and two departments\' work');
  for (const [k, u] of Object.entries(users)) {
    const c = await adminApi('POST', 'admin/users', {
      email: u.email, password: u.password, email_confirm: true,
    });
    if (!c.ok || !c.json?.id) { fail(`create auth user (${k})`, c.raw.slice(0, 300)); continue; }
    u.id = c.json.id; created.authIds.push(u.id);

    const p = await as(SECRET, null, 'POST', 'portal_users', {
      id: u.id, account_id: `RLSTEST-${k}-${stamp}`, display_name: `RLS Test ${k}`,
      email: u.email, role: u.role, city_id: 'gwalior', department_id: u.dept,
    }, );
    p.ok || p.status === 201
      ? pass(`portal_users row (${k})`, `role=${u.role} dept=${u.dept ?? 'null (admin)'}`)
      : fail(`portal_users row (${k})`, p.raw.slice(0, 300));

    u.token = await signIn(u.email, u.password);
    u.token ? pass(`sign in (${k})`) : fail(`sign in (${k})`, 'no access_token returned');
  }

  const REP = { prefer: 'return=representation' };

  for (const dept of ['roads', 'water']) {
    // `return=representation` is not cosmetic here: without it the insert
    // answers 201 with an empty body, the generated uuid is never learned,
    // and cleanup silently orphans the row.
    const iss = await as(SECRET, null, 'POST', 'civic_issues', {
      reference: `RLS-${dept}-${stamp}`, city_id: 'gwalior', department_id: dept,
      category: 'test', title: `RLS fixture ${dept}`, lat: 26.2183, lng: 78.1828,
    }, REP);
    const issueId = iss.json?.[0]?.id ?? null;
    issueId ? created.issues.push(issueId)
            : fail(`fixture civic_issue (${dept})`, `no id returned — HTTP ${iss.status} ${iss.raw.slice(0, 200)}`);

    const id = `RLS-${dept.toUpperCase()}-${stamp}`;
    const c = await as(SECRET, null, 'POST', 'complaints', {
      id, city_id: 'gwalior', civic_issue_id: issueId, department_id: dept,
      category: 'test', lat: 26.2183, lng: 78.1828,
      issue: { title: `RLS fixture ${dept}` }, is_synthetic: true,
    }, REP);
    c.ok || c.status === 201 ? (created.complaints.push(id), pass(`fixture complaint (${dept})`, id))
                             : fail(`fixture complaint (${dept})`, c.raw.slice(0, 300));
  }

  // An audit fixture, because audit_events is empty in a fresh database and
  // "admin reads []" would otherwise pass whether the policy worked or not.
  // An empty table cannot demonstrate either access or isolation.
  {
    const a = await as(SECRET, null, 'POST', 'audit_events', {
      action: 'rls.test', entity_type: 'complaint', entity_id: `RLS-ROADS-${stamp}`,
      actor_label: 'rls-suite', detail: { note: 'fixture' },
    }, REP);
    a.ok || a.status === 201
      ? pass('fixture audit_event', 'so the admin-only policy has something to prove')
      : fail('fixture audit_event', a.raw.slice(0, 300));
  }

  // ----------------------------------------------------------
  section('5. ROADS OFFICER — control, then isolation');
  const roads = users.roads;
  if (!roads.token) fail('roads officer signed in', 'cannot test without a session');
  else {
    // CONTROL: prove this session reads SOMETHING, or the denials below
    // prove nothing but a broken login.
    await mustRead('roads officer', ANON, roads.token, 'cities');

    const own = classify(await as(ANON, roads.token, 'GET', `complaints?department_id=eq.roads&select=id`));
    own.kind === 'READ' ? pass('roads officer CAN read roads complaints', own.label)
                        : fail('roads officer CAN read roads complaints', `${own.label}\n<-- policy too strict; the portal would be empty`);

    const other = classify(await as(ANON, roads.token, 'GET', `complaints?department_id=eq.water&select=id`));
    DENIED.has(other.kind) ? pass('roads officer CANNOT read WATER complaints', `${other.label}  <-- DEPARTMENT ISOLATION`)
                           : fail('roads officer CANNOT read WATER complaints', `${other.label}  <-- CROSS-DEPARTMENT LEAK`);

    // IDOR: naming the row directly must not help.
    const direct = classify(await as(ANON, roads.token, 'GET', `complaints?id=eq.RLS-WATER-${stamp}&select=id`));
    DENIED.has(direct.kind) ? pass('roads officer CANNOT read water complaint BY ID', `${direct.label}  <-- IDOR blocked`)
                            : fail('roads officer CANNOT read water complaint BY ID', `${direct.label}  <-- IDOR`);

    for (const t of SENSITIVE) await mustNotRead('roads officer', ANON, roads.token, t);
    await mustNotRead('roads officer', ANON, roads.token, 'audit_events');
    await mustNotRead('roads officer', ANON, roads.token, 'moderation_cases');

    const w = await as(ANON, roads.token, 'PATCH', `complaints?id=eq.RLS-ROADS-${stamp}`, { status: 'resolved' });
    w.status >= 400 || (Array.isArray(w.json) && w.json.length === 0)
      ? pass('roads officer CANNOT UPDATE a complaint directly', `HTTP ${w.status} — no write grant`)
      : fail('roads officer CANNOT UPDATE a complaint directly', `HTTP ${w.status} <-- could close without timeline/audit`);

    const rpc = await as(ANON, roads.token, 'POST', 'rpc/next_complaint_id', { p_city_id: 'gwalior' });
    rpc.status >= 400 ? pass('roads officer cannot call next_complaint_id', `HTTP ${rpc.status}`)
                      : fail('roads officer cannot call next_complaint_id', `HTTP ${rpc.status}`);
  }

  section('6. WATER OFFICER — the mirror');
  const water = users.water;
  if (!water.token) fail('water officer signed in', 'cannot test');
  else {
    const own = classify(await as(ANON, water.token, 'GET', `complaints?department_id=eq.water&select=id`));
    own.kind === 'READ' ? pass('water officer CAN read water complaints', own.label)
                        : fail('water officer CAN read water complaints', own.label);
    const other = classify(await as(ANON, water.token, 'GET', `complaints?department_id=eq.roads&select=id`));
    DENIED.has(other.kind) ? pass('water officer CANNOT read ROADS complaints', `${other.label}  <-- ISOLATION`)
                           : fail('water officer CANNOT read ROADS complaints', `${other.label}  <-- LEAK`);
  }

  section('7. ADMIN — city-wide, but not unlimited');
  const admin = users.admin;
  if (!admin.token) fail('admin signed in', 'cannot test');
  else {
    for (const dept of ['roads', 'water']) {
      const c = classify(await as(ANON, admin.token, 'GET', `complaints?department_id=eq.${dept}&select=id`));
      c.kind === 'READ' ? pass(`admin CAN read ${dept} complaints`, c.label)
                        : fail(`admin CAN read ${dept} complaints`, `${c.label}\n<-- admin oversight broken`);
    }
    await mustRead('admin', ANON, admin.token, 'audit_events');
    // Even an admin has no business holding a list of citizens with strikes.
    for (const t of SENSITIVE) await mustNotRead('admin', ANON, admin.token, t);
  }

  section('8. SERVICE ROLE — regression: the server still works');
  for (const t of ['complaints', 'otp_challenges', 'citizen_abuse_profiles', 'audit_events']) {
    const c = classify(await as(SECRET, null, 'GET', `${t}?select=*&limit=1`));
    c.kind === 'READ' || c.kind === 'RLS_EMPTY'
      ? pass(`service_role reads ${t}`, c.label)
      : fail(`service_role reads ${t}`, `${c.label}\n<-- server code would break`);
  }

  await cleanup();

  console.log('\n========================================================');
  console.log(failures === 0
    ? `  RESULT: PASSED — ${checks} checks, 0 failures.`
    : `  RESULT: FAILED — ${failures} of ${checks} checks failed.`);
  console.log('========================================================\n');
  // Set the code and return rather than process.exit(): exiting while
  // fetch's handles are still open trips a libuv assertion on Windows and
  // the crash text buries the results it was reporting.
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error('\nUnexpected failure:', err instanceof Error ? err.message : err);
  try { await cleanup(); } catch { /* best effort */ }
  process.exitCode = 1;
});
