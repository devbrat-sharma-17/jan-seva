// ============================================================
// Database access — PostgREST over fetch
// ============================================================
// No `@supabase/supabase-js`. These functions need four things from
// Supabase — select, insert, update and rpc — and PostgREST exposes all
// four over plain HTTP. A 200 kB client library to build four URLs is
// weight on every cold start for no capability.
//
//   SERVICE ROLE. Every call here bypasses row-level security.
//   That is the point: the RLS policies protect the browser's direct
//   connection, and these functions are the code that must therefore
//   re-derive scope itself, on every request, from the session — never
//   from a value in the request body. Anything in `api/` that skips that
//   check is the vulnerability RLS was covering for.
//
// The key is read lazily rather than at module scope so an unconfigured
// deploy fails on the request that needed a database, with a 503 the UI
// can render, instead of crashing the whole function bundle at import.

import { apiError } from './errors.ts';

export class DbNotConfiguredError extends Error {
  constructor() {
    super('Database is not configured for this environment.');
    this.name = 'DbNotConfiguredError';
  }
}

interface DbConfig {
  url: string;
  serviceKey: string;
}

function config(): DbConfig {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new DbNotConfiguredError();
  return { url: url.replace(/\/+$/, ''), serviceKey };
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const { serviceKey } = config();
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

/**
 * A failed database request, carrying the detail the caller needs to map
 * it to a citizen-readable sentence.
 *
 *   `detail` IS FOR MAPPING, NEVER FOR RENDERING.
 *   PostgREST's body names columns, constraints and functions. It must
 *   reach the endpoint — otherwise a raised `city_not_active` is
 *   indistinguishable from a genuine outage and every one becomes a 500
 *   — and it must never reach the response. Callers match on it and
 *   answer with their own words.
 */
export class DbRequestError extends Error {
  // Declared and assigned separately rather than as constructor parameter
  // properties: `erasableSyntaxOnly` is on in tsconfig, so this file must
  // stay valid once the types are stripped and nothing else.
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`db_request_failed_${status}`);
    this.name = 'DbRequestError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, init);

  if (!response.ok) {
    // Logged as well as thrown: the log is where an operator reads it,
    // and the throw is where the endpoint decides what the citizen sees.
    const detail = await response.text().catch(() => '');
    console.error('[db] request failed', { path, status: response.status, detail: detail.slice(0, 500) });
    throw new DbRequestError(response.status, detail.slice(0, 500));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** `select` with a PostgREST filter string, e.g. `id=eq.JS-GWL-2026-1`. */
export function select<T>(table: string, query: string): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, { method: 'GET', headers: headers() });
}

/** Inserts and returns the created rows. */
export function insert<T>(table: string, rows: unknown): Promise<T[]> {
  return request<T[]>(table, {
    method: 'POST',
    headers: headers({ prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  });
}

/** Updates rows matching the filter and returns them. */
export function update<T>(table: string, query: string, patch: unknown): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, {
    method: 'PATCH',
    headers: headers({ prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
}

/**
 * Insert-or-update in one statement.
 *
 * `on_conflict` names the constraint columns. Used by the rate limiter,
 * where two requests racing on the same window must not both insert.
 */
export function upsert<T>(table: string, onConflict: string, rows: unknown): Promise<T[]> {
  return request<T[]>(`${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: headers({ prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(rows),
  });
}

/** Calls a Postgres function, e.g. `next_complaint_id`. */
export function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return request<T>(`rpc/${fn}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
  });
}

/**
 * The response for an endpoint that needs a database it has not been
 * given. Distinct from INTERNAL_ERROR on purpose: this is a deployment
 * that was never finished, and saying so is what gets it finished.
 */
export function dbUnavailable(): Response {
  return apiError(
    'PROVIDER_UNAVAILABLE',
    'This service is not available yet. Please try again later.'
  );
}
