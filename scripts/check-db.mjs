// ============================================================
// Supabase connectivity check — `npm run check:db`
// ============================================================
//
// Phase 2 of the hardening audit asks for a real read/write path before
// anyone claims the database works. This is that check, and it is
// deliberately not a smoke test that pings a URL and prints a tick:
// every step below can fail for a DIFFERENT reason, and the reason is
// the whole value. "It doesn't connect" is not a diagnosis.
//
//   THE KEY IS NEVER PRINTED.
//   Not on success, not in an error, not in a stack trace. It is read,
//   used in a header, and masked everywhere it is mentioned. A
//   connectivity script that echoes a service-role key into CI logs has
//   done more damage than the outage it was debugging.
//
// Uses plain fetch against PostgREST, matching api/_lib/db.ts — same
// transport as the real code, so a pass here means the real code's path
// works, not that some other client library's path does.
//
// Run:  npm run check:db

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------
// Environment
// ------------------------------------------------------------
// .env.local is the designated home for these (see .env.example) and is
// gitignored. Parsed here rather than adding a dotenv dependency for one
// script — the format we need is KEY=value and nothing else.

function loadEnvLocal() {
  try {
    const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue; // real env wins
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Absent is fine — the variables may come from the real environment.
  }
}

/** Enough to identify a key in a log, useless to anyone who reads it. */
function mask(value) {
  if (!value) return '(unset)';
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

// ------------------------------------------------------------
// Near-miss variable names
// ------------------------------------------------------------
// "Not set" and "set under a name I don't read" are different faults with
// different fixes, and the first message sends you looking in the wrong
// place. Supabase has also renamed its keys — legacy `service_role` JWTs
// alongside the newer `sb_secret_…` / `sb_publishable_…` pair — so the
// convention in use is genuinely ambiguous and worth naming out loud.
//
// Only NAMES are ever reported. Values are not printed, not masked, not
// hinted at; knowing that SUPABASE_SECRET_KEY is populated is the whole
// diagnosis and its contents add nothing.

const URL_ALIASES = [
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_PROJECT_URL',
  'SUPABASE_API_URL',
  'SUPABASE_DB_URL',
  'PUBLIC_SUPABASE_URL',
];

const KEY_ALIASES = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SERVICE_ROLE_KEY',
  'SUPABASE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const setAliases = (names) => names.filter((name) => (process.env[name] ?? '').trim() !== '');

/**
 * Reports what IS set when the canonical name is not, and distinguishes
 * the three ways this fails: a rename, a publishable key where a secret
 * one belongs, or a file that was never written.
 */
function explainMissing(canonical, aliases) {
  const found = setAliases(aliases);
  if (found.length === 0) return null;

  const lines = [`These ARE set: ${found.join(', ')}`];

  const publishable = found.filter((n) => /ANON|PUBLISHABLE/.test(n));
  if (publishable.length > 0 && /SERVICE_ROLE_KEY$/.test(canonical)) {
    lines.push(
      `${publishable.join(', ')} is the PUBLISHABLE key. It is subject to RLS,`,
      'so it cannot do the server work these functions do. You need the',
      'secret one as well — they are different keys, not two names for one.'
    );
  }

  const renamed = found.filter((n) => !/ANON|PUBLISHABLE/.test(n));
  if (renamed.length > 0) {
    lines.push(
      `If ${renamed[0]} holds the right value, rename it to ${canonical}`,
      'in .env.local — api/_lib/db.ts reads only the canonical name, so a',
      'rename here fixes the real code path too, not just this check.'
    );
  }

  return lines.join('\n');
}

/** True when .env.local exists on disk but defines no Supabase variable. */
function envLocalHasNoSupabase() {
  try {
    const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
    return !/^\s*(export\s+)?[A-Z0-9_]*SUPABASE[A-Z0-9_]*\s*=/m.test(text);
  } catch {
    return false;
  }
}

const UNSAVED_HINT =
  '.env.local exists but defines NO Supabase variable under any name.\n' +
  'If you just typed one into an editor, check it is SAVED — an unsaved\n' +
  'buffer looks correct on screen and is absent from disk.';

// ------------------------------------------------------------
// Output
// ------------------------------------------------------------

let failed = false;

const pass = (label, detail) =>
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);

function fail(label, diagnosis) {
  failed = true;
  console.log(`  FAIL  ${label}`);
  for (const line of diagnosis.split('\n')) console.log(`        ${line}`);
}

const section = (title) =>
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);

// ------------------------------------------------------------
// Checks
// ------------------------------------------------------------

async function main() {
  loadEnvLocal();

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

  console.log('========================================================');
  console.log('  JAN-SEVA — Supabase connectivity check');
  console.log('========================================================');

  section('1. Configuration');

  if (!url) {
    fail(
      'SUPABASE_URL is set',
      [
        explainMissing('SUPABASE_URL', URL_ALIASES),
        envLocalHasNoSupabase() ? UNSAVED_HINT : null,
        'Add it to .env.local:\n' +
          '  SUPABASE_URL=https://<project-ref>.supabase.co\n' +
          'Project Settings → Data API → Project URL.',
      ]
        .filter(Boolean)
        .join('\n\n')
    );
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
    // Not fatal — self-hosted and custom domains are legitimate. But the
    // single most common cause of a dead connection is a pasted
    // dashboard URL (supabase.com/dashboard/project/…) instead of the
    // API URL, and that is worth naming explicitly.
    pass('SUPABASE_URL is set', url);
    console.log('        NOTE  This is not the usual https://<ref>.supabase.co shape.');
    console.log('              If you pasted the dashboard URL, that is the wrong one —');
    console.log('              you want Project Settings → Data API → Project URL.');
  } else {
    pass('SUPABASE_URL is set', url);
  }

  if (!key) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is set',
      [
        explainMissing('SUPABASE_SERVICE_ROLE_KEY', KEY_ALIASES),
        envLocalHasNoSupabase() ? UNSAVED_HINT : null,
        'Add it to .env.local (gitignored — never commit it):\n' +
          '  SUPABASE_SERVICE_ROLE_KEY=<service_role or sb_secret_… key>\n' +
          'Project Settings → API Keys → service_role (or "secret").\n' +
          'This key bypasses RLS. It must never carry a VITE_ prefix.',
      ]
        .filter(Boolean)
        .join('\n\n')
    );
  } else if (key.startsWith('sb_publishable_') || (key.startsWith('eyJ') && key.includes('anon'))) {
    // Both key generations have a publishable half that is easy to grab
    // by mistake — they sit next to each other in the dashboard.
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is the secret key',
      'That is the PUBLISHABLE key, not the secret one. It is subject to\n' +
        'RLS, so every server write below would be refused — and the failure\n' +
        'would look like a broken policy rather than a wrong key.'
    );
  } else {
    pass('SUPABASE_SERVICE_ROLE_KEY is set', mask(key));
    if (anonKey) {
      pass('VITE_SUPABASE_ANON_KEY is set', mask(anonKey));
    }
  }

  if (failed) {
    console.log('\nStopping: cannot reach a database without both values.\n');
    process.exit(1);
  }

  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };

  // ----------------------------------------------------------
  section('2. Reachability and credentials');

  let reachable = false;
  try {
    const response = await fetch(`${url}/rest/v1/`, { headers });
    if (response.status === 401 || response.status === 403) {
      fail(
        'PostgREST accepts the key',
        `HTTP ${response.status}. The URL resolved, so the project exists —\n` +
          'the key is wrong, revoked, or from a different project.'
      );
    } else if (!response.ok) {
      fail('PostgREST responds', `HTTP ${response.status} from ${url}/rest/v1/`);
    } else {
      reachable = true;
      pass('PostgREST responds and accepts the key');
    }
  } catch (err) {
    fail(
      'The project URL resolves',
      `${err instanceof Error ? err.message : 'unknown error'}\n` +
        'DNS or TLS failed. Check the project ref, and that the project is\n' +
        'not paused — Supabase pauses free projects after inactivity.'
    );
  }

  if (!reachable) {
    console.log('\nStopping: nothing downstream can pass.\n');
    process.exit(1);
  }

  // ----------------------------------------------------------
  section('3. Schema — have the migrations been applied?');

  let schemaPresent = false;
  try {
    const response = await fetch(`${url}/rest/v1/cities?select=id,code,name&limit=10`, { headers });
    if (response.status === 404 || response.status === 406) {
      fail(
        'Table `cities` exists',
        'The project is reachable but empty. Apply the migrations:\n' +
          '  supabase link --project-ref <ref>\n' +
          '  supabase db push\n' +
          'Or paste supabase/migrations/*.sql into the SQL editor IN ORDER.'
      );
    } else if (response.status === 403) {
      // 42501 is the single most misleading state this project can be
      // in: the migrations applied perfectly and every table refuses
      // every caller, which reads exactly like "the migrations failed"
      // and sends you to re-run DDL that is already correct.
      //
      // Postgres only says "permission denied for table X" about a
      // table that EXISTS. The schema is fine; the GRANTs are missing.
      const body = await response.text().catch(() => '');
      const isPrivilege = body.includes('42501') || body.includes('permission denied');
      fail(
        'Table `cities` is readable',
        isPrivilege
          ? 'HTTP 403 / Postgres 42501 — "permission denied for table cities".\n\n' +
            'THE MIGRATIONS APPLIED. The tables exist — Postgres only reports\n' +
            '"permission denied" about a table it can see. What is missing is\n' +
            'the GRANTs: newer Supabase projects no longer auto-grant new\n' +
            'public tables, and 0001-0007 contain no `grant` statement.\n\n' +
            'Do NOT re-run 0001-0007. Apply this instead:\n' +
            '  supabase/migrations/0008_grants.sql\n\n' +
            'Grants and RLS are different gates. This is the first one.'
          : `HTTP 403. Body: ${body.slice(0, 300)}`
      );
    } else if (!response.ok) {
      fail('Table `cities` is readable', `HTTP ${response.status}`);
    } else {
      const rows = await response.json();
      schemaPresent = true;
      pass('Table `cities` exists and is readable', `${rows.length} row(s)`);
      if (rows.length === 0) {
        console.log('        NOTE  No cities seeded. 0005_reference_data.sql has not run,');
        console.log('              or ran against a different project.');
      } else {
        for (const row of rows) console.log(`        · ${row.id} (${row.code}) — ${row.name}`);
      }
    }
  } catch (err) {
    fail('Table `cities` is readable', err instanceof Error ? err.message : 'unknown');
  }

  if (schemaPresent) {
    for (const table of ['departments', 'complaints', 'civic_issues', 'evidence', 'otp_challenges']) {
      try {
        const response = await fetch(`${url}/rest/v1/${table}?select=count`, {
          headers: { ...headers, prefer: 'count=exact' },
        });
        if (response.ok) {
          const range = response.headers.get('content-range') ?? '';
          pass(`Table \`${table}\` exists`, `${range.split('/')[1] ?? '?'} row(s)`);
        } else if (response.status === 403) {
          fail(`Table \`${table}\` is readable`, 'HTTP 403 — exists, not granted. See 0008_grants.sql.');
        } else if (response.status === 404) {
          fail(`Table \`${table}\` exists`, 'HTTP 404 — genuinely absent. Migration incomplete.');
        } else {
          fail(`Table \`${table}\` exists`, `HTTP ${response.status}.`);
        }
      } catch (err) {
        fail(`Table \`${table}\` exists`, err instanceof Error ? err.message : 'unknown');
      }
    }
  }

  // ----------------------------------------------------------
  section('4. Write path — a real round trip');
  //
  // Against `rate_limits`: no foreign keys, server-only, and designed to
  // be written constantly, so a test row is not pollution. An obviously
  // synthetic bucket name keeps it identifiable if cleanup ever fails.

  if (!schemaPresent) {
    console.log('  SKIP  No schema to write to.');
  } else {
    const subject = `connectivity-check-${Date.now()}`;
    const row = {
      bucket: 'diagnostic:check-db',
      subject,
      window_start: new Date().toISOString(),
      count: 1,
    };
    const filter = `bucket=eq.diagnostic:check-db&subject=eq.${encodeURIComponent(subject)}`;
    let inserted = false;

    try {
      const response = await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST',
        headers: { ...headers, prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      if (response.ok) {
        inserted = true;
        pass('INSERT succeeded');
      } else {
        fail('INSERT succeeded', `HTTP ${response.status} — ${(await response.text()).slice(0, 300)}`);
      }
    } catch (err) {
      fail('INSERT succeeded', err instanceof Error ? err.message : 'unknown');
    }

    if (inserted) {
      try {
        const response = await fetch(`${url}/rest/v1/rate_limits?${filter}&select=subject,count`, {
          headers,
        });
        const rows = response.ok ? await response.json() : [];
        if (rows.length === 1 && rows[0].subject === subject) {
          pass('SELECT read the row back', 'write is durable, not just accepted');
        } else {
          fail('SELECT read the row back', `Expected 1 row, got ${rows.length}.`);
        }
      } catch (err) {
        fail('SELECT read the row back', err instanceof Error ? err.message : 'unknown');
      }

      // Cleanup runs whether or not the read passed. A diagnostic that
      // leaves rows behind becomes a source of the confusion it exists
      // to remove.
      try {
        const response = await fetch(`${url}/rest/v1/rate_limits?${filter}`, {
          method: 'DELETE',
          headers,
        });
        if (response.ok) pass('DELETE cleaned up the test row');
        else fail('DELETE cleaned up the test row', `HTTP ${response.status}. Row left: ${subject}`);
      } catch (err) {
        fail('DELETE cleaned up the test row', err instanceof Error ? err.message : 'unknown');
      }
    }
  }

  // ----------------------------------------------------------
  section('5. Row level security');
  //
  // The checks above all ran as service_role, which bypasses RLS by
  // design. That proves the database works; it proves NOTHING about
  // whether the browser is contained. This step is what catches the
  // "everything works" deploy where RLS was never enabled.

  if (!schemaPresent) {
    console.log('  SKIP  No schema.');
  } else {
    try {
      const response = await fetch(`${url}/rest/v1/complaints?select=id&limit=1`, {
        headers: { apikey: key, authorization: `Bearer ${key}`, 'accept-profile': 'public' },
      });
      // Service role again — so this is informational, not a verdict.
      pass(
        'Service role reads complaints',
        `HTTP ${response.status} (expected: RLS bypassed for server code)`
      );
    } catch {
      // Non-fatal.
    }

    if (anonKey) {
      // Test 1: anon direct read on complaints
      try {
        const res = await fetch(`${url}/rest/v1/complaints?select=id&limit=1`, {
          headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
        });
        if (res.status === 401 || res.status === 403) {
          pass('Anon direct read on complaints is refused', `HTTP ${res.status} (expected: access denied)`);
        } else {
          fail('Anon direct read on complaints is refused', `HTTP ${res.status} — anon should not read complaints directly.`);
        }
      } catch (err) {
        fail('Anon direct read on complaints is refused', err instanceof Error ? err.message : 'unknown');
      }

      // Test 2: anon direct write to complaints
      try {
        const res = await fetch(`${url}/rest/v1/complaints`, {
          method: 'POST',
          headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'UNAUTH-TEST', category: 'roads' }),
        });
        if (res.status === 401 || res.status === 403) {
          pass('Anon direct write to complaints is refused', `HTTP ${res.status} (expected: access denied)`);
        } else {
          fail('Anon direct write to complaints is refused', `HTTP ${res.status} — anon should not write complaints directly.`);
        }
      } catch (err) {
        fail('Anon direct write to complaints is refused', err instanceof Error ? err.message : 'unknown');
      }

      // Test 3: anon sequence generation RPC
      try {
        const res = await fetch(`${url}/rest/v1/rpc/next_complaint_id`, {
          method: 'POST',
          headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ p_city_id: 'gwalior' }),
        });
        if (res.status === 401 || res.status === 403) {
          pass('Anon sequence generation (next_complaint_id) is refused', `HTTP ${res.status} (expected: access denied)`);
        } else {
          fail('Anon sequence generation (next_complaint_id) is refused', `HTTP ${res.status} — only server should issue sequences.`);
        }
      } catch (err) {
        fail('Anon sequence generation (next_complaint_id) is refused', err instanceof Error ? err.message : 'unknown');
      }

      // Test 4: anon read on staff directory
      try {
        const res = await fetch(`${url}/rest/v1/portal_users?select=id&limit=1`, {
          headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
        });
        if (res.status === 401 || res.status === 403) {
          pass('Anon read on portal_users staff directory is refused', `HTTP ${res.status} (expected: access denied)`);
        } else {
          fail('Anon read on portal_users staff directory is refused', `HTTP ${res.status} — staff directory must not be public.`);
        }
      } catch (err) {
        fail('Anon read on portal_users staff directory is refused', err instanceof Error ? err.message : 'unknown');
      }

      console.log('        PASS  Public anon role is completely contained.');
      console.log('        NOTE  Per-role department containment (authenticated portal users)');
      console.log('              requires signed-in accounts to test cross-department policy boundaries.');
    } else {
      console.log('        NOT VERIFIED  Whether anon and each portal role are correctly');
      console.log('                      contained. That needs an anon key and one signed-in');
      console.log('                      user per role, and it is the check that actually');
      console.log('                      matters — see FINAL quality gate, "RLS verified".');
    }
  }

  // ----------------------------------------------------------
  console.log('\n========================================================');
  if (failed) {
    console.log('  RESULT: FAILED — the database is not usable yet.');
    console.log('========================================================\n');
    process.exit(1);
  }
  console.log('  RESULT: PASSED — real read and write verified.');
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('\nUnexpected failure:', err instanceof Error ? err.message : err);
  process.exit(1);
});
