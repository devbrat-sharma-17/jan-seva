// ============================================================
// HTTP endpoint verification — `npm run check:http`
// ============================================================
//
// Exercises the REAL POST /api/complaints/create over HTTP, against a
// running `vercel dev`. check-complaint.mjs proves what the database
// function guarantees; this file proves what the ENDPOINT in front of it
// does — validation, trust boundaries, error mapping and rate limiting,
// none of which the RPC tests touched.
//
//   THE TRUST-BOUNDARY TESTS ARE THE POINT.
//   Several cases below send `departmentId`, `status`, `slaDueAt`,
//   `priorityScore` and `isSynthetic` in the body and then assert that
//   the STORED ROW ignored every one of them. Asserting the response is
//   not enough: the question is what reached Postgres.
//
// Start the server first:  npx vercel dev --listen 3999
// Then:                    npm run check:http

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

const BASE = process.env.CHECK_HTTP_BASE ?? 'http://localhost:3999';
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

const TAG = `HTTP${Date.now()}`;
let n = 0;
const nextKey = () => `${TAG}-${++n}`;

async function post(body, headers = {}) {
  const r = await fetch(`${BASE}/api/complaints/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const raw = await r.text();
  let json = null; try { json = raw ? JSON.parse(raw) : null; } catch { /* */ }
  return { status: r.status, ok: r.ok, json, raw, headers: r.headers };
}

async function dbGet(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
  });
  return r.ok ? await r.json() : null;
}
async function dbDel(path) {
  await fetch(`${URL_}/rest/v1/${path}`, {
    method: 'DELETE', headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
  });
}

/** The payload /report actually produces, in the endpoint's contract. */
function valid(overrides = {}) {
  return {
    idempotencyKey: nextKey(),
    cityId: 'gwalior',
    category: 'roads',
    title: 'Pothole near market',
    description: 'Large pothole causing traffic problems near the main market road.',
    lat: 26.2183, lng: 78.1828,
    locality: 'Lashkar',
    address: 'Main Market Road, Lashkar, Gwalior',
    locationSource: 'gps',
    gpsLat: 26.2190, gpsLng: 78.1835, gpsAccuracy: 12.5,
    gpsCapturedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function cleanup() {
  section('CLEANUP');
  await dbDel(`sync_operations?idempotency_key=like.${TAG}*`);
  // Also sweep by the complaint the operation produced: a manual curl
  // probe carries its own key, and a ledger row outliving its complaint
  // is precisely the orphan this cleanup exists to catch.
  await dbDel('sync_operations?entity_id=like.JS-GWL-*');
  await dbDel('audit_events?entity_id=like.JS-GWL-*');
  await dbDel('complaints?id=like.JS-GWL-*');
  await dbDel('civic_issues?reference=like.JS-GWL-*');
  await dbDel('ticket_sequences?city_id=eq.gwalior');
  await dbDel('rate_limits?bucket=like.complaint*');
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
  console.log('  JAN-SEVA — HTTP endpoint verification');
  console.log(`  ${BASE}/api/complaints/create`);
  console.log('========================================================');

  // The limiter is real now (15/hour on this bucket) and this suite makes
  // far more than 15 requests. Clearing first means a 429 later in the run
  // is a finding rather than an artefact of the suite's own volume.
  await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');

  // --------------------------------------------------------
  section('0. CONTROL — is the function runtime actually serving api/?');
  //
  // `vite dev` serves the SPA and returns index.html for unknown paths, so
  // a 200 full of HTML would sail through a careless assertion and prove
  // nothing. The control demands JSON from the endpoint itself.
  {
    let probe;
    try { probe = await post({}); }
    catch (err) {
      fail('endpoint reachable', `${err.message}\nStart it first:  npx vercel dev --listen 3999`);
      process.exitCode = 1; return;
    }
    if (/^\s*<!doctype html/i.test(probe.raw)) {
      fail('api/ is executed, not shadowed by the SPA',
           'Got HTML. The SPA rewrite is answering /api/*, so the function never ran.');
      process.exitCode = 1; return;
    }
    if (probe.json === null) {
      fail('endpoint returns JSON', `HTTP ${probe.status}: ${probe.raw.slice(0, 200)}`);
      process.exitCode = 1; return;
    }
    pass('api/ is executed and returns JSON', `empty body -> HTTP ${probe.status} ${probe.json?.error?.code ?? ''}`);

    if (probe.json?.error?.code === 'PROVIDER_UNAVAILABLE') {
      fail('function has database credentials',
           'The endpoint reports the database is not configured. `vercel dev` did not\n' +
           'load SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.');
      process.exitCode = 1; return;
    }
  }

  // --------------------------------------------------------
  section('1-3. VALID REQUEST');
  let first = null;
  {
    const r = await post(valid());
    eq('[1] valid request -> 201 Created', r.status, 201);
    first = r.json;
    if (!first?.complaintId) { fail('[2] response carries a complaint ID', r.raw.slice(0, 300)); }
    else {
      pass('[2] server-generated Complaint ID', first.complaintId);
      /^JS-GWL-2026-\d{6}$/.test(first.complaintId)
        ? pass('[2] correct ID format') : fail('[2] correct ID format', first.complaintId);
      eq('[3] server-side routing', first.departmentId, 'roads');
      eq('    status is server-set', first.status, 'pending');
      eq('    not flagged as a replay', first.replayed, false);
    }
  }

  // --------------------------------------------------------
  section('4-8. TRUST BOUNDARY — what the client cannot inject');
  //
  // Every field below is sent by a hostile client. The assertions read the
  // STORED ROW, because a response that looks right while the database took
  // the client's value is precisely the bug being hunted.
  {
    const key = nextKey();
    const r = await post(valid({
      idempotencyKey: key,
      category: 'roads',
      departmentId: 'water',           // [4] hijack the department
      department_id: 'water',
      status: 'resolved',              // [5] pre-resolve it
      slaDueAt: '2099-01-01T00:00:00Z',// [6] a decade to fix it
      sla_due_at: '2099-01-01T00:00:00Z',
      priorityScore: 100,              // [7] jump the queue
      priority_score: 100,
      isSynthetic: true,               // [8] hide from real metrics
      is_synthetic: true,
      version: 999,
      moderation: 'rejected',
    }));

    if (r.status !== 201) fail('injection attempt still creates a complaint', `HTTP ${r.status} ${r.raw.slice(0, 200)}`);
    else {
      const row = (await dbGet(`complaints?id=eq.${r.json.complaintId}&select=*`))?.[0];
      if (!row) fail('stored row readable');
      else {
        eq('[4] department NOT hijacked (roads, not water)', row.department_id, 'roads');
        eq('[5] status NOT injected', row.status, 'pending');
        eq('[7] priority NOT injected', row.priority_score, 50);
        eq('[8] is_synthetic NOT injected', row.is_synthetic, false);
        eq('    moderation NOT injected', row.moderation, 'normal');
        eq('    version NOT injected', row.version, 0);

        // [6] SLA is 72h for roads, decided server-side — not 2099.
        const hours = (new Date(row.sla_due_at) - new Date(row.created_at)) / 3600000;
        Math.abs(hours - 72) < 0.1
          ? pass('[6] SLA NOT injected', `${hours.toFixed(1)}h, server-derived`)
          : fail('[6] SLA NOT injected', `got ${hours.toFixed(1)}h — client value honoured`);
      }
    }
  }

  // --------------------------------------------------------
  section('9-11. LOCATION');
  {
    const row = (await dbGet(`complaints?id=eq.${first.complaintId}&select=*`))?.[0];
    eq('[10] device GPS persisted', row?.gps_lat, 26.219);
    eq('[11] confirmed location persisted', row?.lat, 26.2183);
    row && row.lat !== row.gps_lat
      ? pass('[11] confirmed and GPS remain distinct', `${row.lat} vs ${row.gps_lat}`)
      : fail('[11] confirmed and GPS remain distinct');

    // [9] Outside the covered area.
    const out = await post(valid({ lat: 19.076, lng: 72.877 })); // Mumbai
    eq('[9] out-of-area location rejected', out.status, 422);
    // Missing entirely.
    const none = await post(valid({ lat: undefined, lng: undefined }));
    eq('[9] missing confirmed location rejected', none.status, 422);
    // Malformed GPS must not sink an otherwise valid report.
    const badGps = await post(valid({ gpsLat: 999, gpsLng: 999 }));
    eq('    invalid GPS does not reject the complaint', badGps.status, 201);
    if (badGps.status === 201) {
      const row2 = (await dbGet(`complaints?id=eq.${badGps.json.complaintId}&select=gps_lat`))?.[0];
      eq('    invalid GPS stored as null rather than garbage', row2?.gps_lat, null);
    }
  }

  // --------------------------------------------------------
  section('12-14. IDEMPOTENCY OVER HTTP');
  {
    const key = nextKey();
    const a = await post(valid({ idempotencyKey: key }));
    const b = await post(valid({ idempotencyKey: key, description: 'Completely different text.' }));
    eq('[12] first submission -> 201', a.status, 201);
    eq('[13] retry -> 200 (not a second 201)', b.status, 200);
    eq('[13] retry returns the same Complaint ID', b.json?.complaintId, a.json?.complaintId);
    eq('[13] retry flagged as replay', b.json?.replayed, true);
    const rows = await dbGet(`complaints?id=eq.${a.json.complaintId}&select=id`);
    eq('[13] one complaint row only', rows?.length, 1);

    // Header form of the key, as an HTTP client would send it.
    const hKey = nextKey();
    const h1 = await post({ ...valid(), idempotencyKey: undefined }, { 'idempotency-key': hKey });
    const h2 = await post({ ...valid(), idempotencyKey: undefined }, { 'idempotency-key': hKey });
    eq('[12] Idempotency-Key header accepted', h1.status, 201);
    eq('[13] header retry replays', h2.json?.complaintId, h1.json?.complaintId);

    for (const [label, bad] of [
      ['too short', 'abc'],
      ['illegal characters', 'key with spaces!'],
      ['absent', undefined],
    ]) {
      const r = await post(valid({ idempotencyKey: bad }));
      eq(`[14] malformed key rejected (${label})`, r.status, 422);
    }
  }

  // --------------------------------------------------------
  section('15-17. REJECTIONS');
  {
    // The endpoint rate-limits BEFORE it validates fields — deliberate, so
    // a flood of malformed requests cannot drive validation work. It does
    // mean this suite's own volume turns later 422s into 429s, so the
    // counter is cleared here and before the error-safety probes.
    await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');

    const cases = [
      ['[15] latitude out of range', valid({ lat: 999 }), 422],
      ['[15] non-numeric coordinates', valid({ lat: 'north', lng: 'east' }), 422],
      ['[16] unknown category', valid({ category: 'wormholes' }), 422],
      ['[16] empty description', valid({ description: '   ' }), 422],
      ['[16] over-long description', valid({ description: 'x'.repeat(5001) }), 422],
      ['[16] missing city', valid({ cityId: undefined }), 422],
      ['[16] inactive city (indore)', valid({ cityId: 'indore' }), 422],
    ];
    for (const [label, body, expected] of cases) eq(label, (await post(body)).status, expected);

    eq('[16] non-JSON body rejected', (await post('not json at all')).status, 422);
    const noCt = await fetch(`${BASE}/api/complaints/create`, { method: 'POST', body: '{}' });
    eq('[16] missing content-type rejected', noCt.status, 422);
    const get = await fetch(`${BASE}/api/complaints/create`);
    eq('[17] GET rejected', get.status, 422);
  }

  // --------------------------------------------------------
  section('18-19. ERROR SAFETY — nothing internal escapes');
  {
    await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');

    const probes = [
      await post(valid({ cityId: 'atlantis' })),
      await post(valid({ lat: 999 })),
      await post('garbage'),
      await post(valid({ category: 'wormholes' })),
    ];
    const leaks = ['supabase.co', 'service_role', 'sb_secret', 'eyJ', 'postgres', 'PGRST',
                   '42501', 'at Object.', 'node_modules', 'create_complaint', 'civic_issues',
                   'SUPABASE_', 'stack', 'plpgsql'];
    let leaked = null;
    for (const p of probes) {
      for (const needle of leaks) {
        if (p.raw.toLowerCase().includes(needle.toLowerCase())) { leaked = `${needle} in: ${p.raw.slice(0, 200)}`; break; }
      }
      if (leaked) break;
    }
    leaked ? fail('[19] no secrets, SQL, schema or stack traces in responses', leaked)
           : pass('[19] no secrets, SQL, schema or stack traces in responses', `${probes.length} error bodies scanned`);

    const shaped = probes.every((p) => p.json?.error?.code && typeof p.json.error.message === 'string');
    shaped ? pass('[18] every error uses the project error envelope')
           : fail('[18] every error uses the project error envelope', JSON.stringify(probes.map((p) => p.json)).slice(0, 300));
  }

  // --------------------------------------------------------
  section('IDENTITY ATTESTATION — the client cannot vouch for itself');
  //
  // Imports the REAL api/_lib/attestation.ts (Node strips the types), so
  // these exercise production signing rather than a reimplementation that
  // could agree with a bug.
  {
    const { issueAttestation, verifyAttestation } =
      await import('../api/_lib/attestation.ts');

    // This section makes many requests and the limiter is real (15/hour),
    // so start it from a clean counter — otherwise a 429 here reads as an
    // attestation failure when it is only this suite's own volume.
    await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');

    const REF = 'idref_v2_0123456789abcdef0123456789abcdef';
    const good = await issueAttestation(REF, 'mobile', '+91 XXXXX 43210');

    // A round trip through our own verifier first. If this fails, every
    // rejection below is meaningless — the same control-before-denial
    // discipline the RLS suite needed.
    const roundTrip = await verifyAttestation(good);
    roundTrip?.ref === REF
      ? pass('[A0] CONTROL: a freshly issued token verifies', `ref matches, method=${roundTrip.method}`)
      : fail('[A0] CONTROL: a freshly issued token verifies',
             `got ${JSON.stringify(roundTrip)}\nNothing verifies, so every "rejected" below proves nothing.`);

    // [1] A valid attestation is honoured and its reference is stored.
    {
      const r = await post(valid({ identityAttestation: good }));
      eq('[A1] valid attestation accepted', r.status, 201);
      if (r.status === 201) {
        const row = (await dbGet(`complaints?id=eq.${r.json.complaintId}&select=identity_reference,identity_verified,identity_method`))?.[0];
        eq('[A1] identity_reference taken from the token', row?.identity_reference, REF);
        eq('[A1] identity_verified set by the server', row?.identity_verified, true);
        eq('[A1] identity_method from the token', row?.identity_method, 'mobile');
      }
    }

    // [5][6] The body's own claims are ignored entirely.
    {
      const r = await post(valid({
        identityReference: 'idref_v2_ffffffffffffffffffffffffffffffff',
        identityVerified: true,
        identityMethod: 'aadhaar',
        identityMasked: 'XXXX XXXX 9999',
      }));
      eq('[A5/6] body identity claims do not create a verified complaint', r.status, 201);
      if (r.status === 201) {
        const row = (await dbGet(`complaints?id=eq.${r.json.complaintId}&select=identity_reference,identity_verified`))?.[0];
        eq('[A6] body identityReference IGNORED', row?.identity_reference, null);
        eq('[A5] body identityVerified IGNORED', row?.identity_verified, false);
      }
    }

    // [2] Forged: a signature that was never ours.
    {
      const forged = `${good.slice(0, good.lastIndexOf('.'))}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
      eq('[A2] forged signature rejected', (await post(valid({ identityAttestation: forged }))).status, 401);
      eq('    verifyAttestation() returns null for it', await verifyAttestation(forged), null);
    }

    // [4] Modified: same signature, payload swapped for a different ref.
    {
      // Exactly three segments — see the SCHEME note in attestation.ts.
      const [scheme, payload, sig] = good.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      claims.ref = 'idref_v2_ffffffffffffffffffffffffffffffff';
      const tampered = `${scheme}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${sig}`;
      eq('[A4] tampered payload rejected', (await post(valid({ identityAttestation: tampered }))).status, 401);
      eq('    verifyAttestation() returns null for it', await verifyAttestation(tampered), null);
    }

    // [3] Expired: minted an hour ago against a 30-minute TTL.
    {
      const expired = await issueAttestation(REF, 'mobile', '+91 XXXXX 43210', Date.now() - 60 * 60 * 1000);
      eq('[A3] expired attestation rejected', (await post(valid({ identityAttestation: expired }))).status, 401);
      eq('    verifyAttestation() returns null for it', await verifyAttestation(expired), null);
    }

    // Garbage in the field must not be treated as "absent".
    for (const [label, bad] of [['not a token', 'hello'], ['wrong scheme', 'attv9.aaa.bbb'], ['empty segments', '..']]) {
      eq(`    malformed attestation rejected (${label})`, (await post(valid({ identityAttestation: bad }))).status, 401);
    }

    // Absent is legitimate: an anonymous report is still a report (§10).
    {
      const r = await post(valid());
      eq('    absent attestation files anonymously (not refused)', r.status, 201);
      if (r.status === 201) {
        const row = (await dbGet(`complaints?id=eq.${r.json.complaintId}&select=identity_verified`))?.[0];
        eq('    and is recorded as unverified', row?.identity_verified, false);
      }
    }

    // The token must never carry a raw identifier.
    {
      const claims = JSON.parse(Buffer.from(good.split('.')[1], 'base64url').toString());
      const blob = JSON.stringify(claims);
      !/\b[6-9]\d{9}\b/.test(blob) && !/\b\d{12}\b/.test(blob)
        ? pass('    token carries no raw mobile or Aadhaar number', blob.slice(0, 120))
        : fail('    token carries a raw identifier', blob);
    }
  }

  // --------------------------------------------------------
  section('20. RATE LIMIT');
  {
    // Start from a clean counter: everything above already spent budget,
    // and `complaint:create:ip` allows 15 an hour.
    await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');

    // 25 SIMULTANEOUS requests — the shape that defeated the old
    // read-then-write limiter, where all 25 read the same count, wrote
    // the same value, and every one was allowed.
    const burst = await Promise.all(Array.from({ length: 25 }, () => post(valid())));
    const limited = burst.filter((r) => r.status === 429);
    const allowed = burst.filter((r) => r.status === 201 || r.status === 200);

    limited.length > 0
      ? pass('[20] rate limiting engages under a burst', `${allowed.length} allowed, ${limited.length} refused`)
      : fail('[20] rate limiting engages under a burst',
             '0 of 25 refused — the limiter is failing open.\n' +
             'Check IDENTITY_SECRET (hashSubject throws without it and consume() catches).');

    // [8] The atomicity proof. Under the old race the stored count landed
    // around 1 no matter how many requests arrived; every request must
    // now be counted exactly once.
    const rows = await dbGet('rate_limits?bucket=eq.complaint%3Acreate%3Aip&select=count');
    const counted = rows?.[0]?.count ?? 0;
    counted === 25
      ? pass('[8] every concurrent request was counted exactly once', `count=${counted}/25 — increment is atomic`)
      : fail('[8] concurrent requests all counted', `count=${counted}, expected 25 — increments were lost to a race`);

    eq('[9] over-limit responses are 429', allowed.length, 15);

    if (limited.length > 0) {
      const h = limited[0].headers.get('retry-after');
      h ? pass('[20] 429 carries Retry-After', `${h}s`) : fail('[20] 429 carries Retry-After', 'header absent');
      eq('[20] 429 uses the error envelope', limited[0].json?.error?.code, 'RATE_LIMITED');
    }

    // Leave the counter clear so the sections after this are not refused.
    await dbDel('rate_limits?bucket=eq.complaint%3Acreate%3Aip');
  }

  // --------------------------------------------------------
  section('21-22. EVIDENCE CONTRACT + ORIGIN');
  {
    // [21] Evidence is NOT part of this endpoint's contract yet. The honest
    // assertion is that photos are ignored rather than half-stored.
    const withPhotos = await post(valid({
      photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
      evidence: [{ sha256: 'a'.repeat(64) }],
    }));
    eq('[21] extra evidence fields do not break the request', withPhotos.status, 201);
    if (withPhotos.status === 201) {
      const ev = await dbGet(`evidence?complaint_id=eq.${withPhotos.json.complaintId}&select=id`);
      eq('[21] no evidence row invented from an unsupported field', ev?.length, 0);
    }

    // [22] No CORS header is the correct answer: the SPA is same-origin, and
    // an Access-Control-Allow-Origin here would invite cross-site posting.
    const pre = await fetch(`${BASE}/api/complaints/create`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    const acao = pre.headers.get('access-control-allow-origin');
    !acao || acao === 'null'
      ? pass('[22] no cross-origin allowance advertised', `preflight ${pre.status}, ACAO ${acao ?? 'absent'}`)
      : fail('[22] no cross-origin allowance advertised', `ACAO: ${acao} — any site could post complaints`);
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
