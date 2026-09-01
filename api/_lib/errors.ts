// ============================================================
// API errors — one vocabulary (spec §84)
// ============================================================
// Every endpoint answers with the same shape, so the client has one
// place that maps a code to a sentence a citizen or an officer can act
// on. An endpoint that invents its own error string forces the UI to
// pattern-match on prose, which breaks the moment the prose is edited.
//
// What never crosses this boundary: stack traces, provider responses,
// SQL, or anything that distinguishes "no such account" from "wrong
// password" (spec §83).

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'STORAGE_ERROR'
  | 'OTP_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const STATUS: Record<ApiErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  STORAGE_ERROR: 502,
  OTP_ERROR: 400,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** Safe to render. Never contains provider or database detail. */
    message: string;
    /** Seconds, on RATE_LIMITED only. */
    retryAfter?: number;
  };
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // These endpoints are never a cacheable resource. An OTP response
  // sitting in a CDN or a back-button cache is a real problem.
  'cache-control': 'no-store',
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: { retryAfter?: number } = {}
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  if (options.retryAfter !== undefined) body.error.retryAfter = options.retryAfter;

  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (options.retryAfter !== undefined) {
    headers['retry-after'] = String(options.retryAfter);
  }

  return new Response(JSON.stringify(body), { status: STATUS[code], headers });
}

export function apiOk(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

/**
 * Wraps a handler so an unexpected throw becomes INTERNAL_ERROR rather
 * than Vercel's default page — which, on a runtime error, includes the
 * stack (spec §83).
 *
 * The real error is logged for the operator, without the request body:
 * that body may hold a verification code or a description, and neither
 * belongs in a log line (spec §82).
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      console.error('[api] unhandled', {
        path: new URL(request.url).pathname,
        method: request.method,
        message: err instanceof Error ? err.message : 'unknown',
      });
      return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
  };
}

/** Parses a JSON body, refusing anything that is not a plain object. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
