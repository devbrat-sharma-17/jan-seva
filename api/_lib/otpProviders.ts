// ============================================================
// OTP providers — pluggable, and honest about two different shapes
// ============================================================
//
// India's OTP providers do not all work the same way, and pretending
// they do produces an abstraction that leaks the first time you swap
// one. There are two genuinely different contracts:
//
//   MANAGED        the provider generates the code, sends it, and
//                  verifies it. We never see the code. Twilio Verify,
//                  MSG91's OTP API and 2Factor's AUTOGEN all work this
//                  way. Fewer moving parts, and the code never touches
//                  our database.
//
//   TRANSACTIONAL  we generate the code and the provider is a dumb SMS
//                  pipe. We store a salted hash, enforce our own expiry
//                  and attempt cap. More control, more responsibility.
//
// `send()` returns which kind it is, and the endpoints branch once, at
// the top. A single fake-uniform interface would have forced the
// managed providers through a code-storage path they have no code for.
//
// ------------------------------------------------------------
// BEFORE ANY OF THESE CAN SEND A REAL SMS IN INDIA
// ------------------------------------------------------------
// TRAI's DLT regime applies to every A2P SMS to an Indian number,
// whichever provider is in front of it. It needs a registered legal
// entity, a registered sender header, and each message template
// registered and approved in advance. Provisioning is measured in days
// to weeks, not minutes, and no amount of code shortens it. Until it is
// done, `console` is the only adapter that can actually deliver
// anything, and it delivers to a log.
//
// Verify each provider's current API against its own documentation
// before going live — the shapes below are written from their published
// interfaces and are the thing most likely to have moved.

export type OtpProviderKind = 'managed' | 'transactional';

export interface SendManagedResult {
  kind: 'managed';
  /** The provider's handle for this challenge, passed back to verify. */
  providerRef: string;
}

export interface SendTransactionalResult {
  kind: 'transactional';
  /** The code WE generated. Hashed by the caller; never persisted raw. */
  code: string;
  providerRef?: string;
}

export type SendResult = SendManagedResult | SendTransactionalResult;

export interface OtpProvider {
  readonly name: string;
  readonly kind: OtpProviderKind;
  /** `mobile` must be ten digits, already validated. */
  send(mobile: string): Promise<SendResult>;
  /** Managed providers only. Transactional ones verify against our hash. */
  verify?(mobile: string, providerRef: string, code: string): Promise<boolean>;
}

export class OtpProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OtpProviderError';
  }
}

/** Cryptographically random six-digit code. `Math.random` is not. */
export function generateCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  // Rejection-free and unbiased enough: 2^32 is not a multiple of 10^6,
  // but the bias is under one part in four thousand across the range,
  // which is immaterial against a five-attempt cap.
  return String(buffer[0]! % 1_000_000).padStart(6, '0');
}

// ------------------------------------------------------------
// console — development only
// ------------------------------------------------------------

const consoleProvider: OtpProvider = {
  name: 'console',
  kind: 'transactional',
  async send(mobile: string): Promise<SendResult> {
    const code = generateCode();
    // The one place a code is ever printed, and only ever in a
    // development deployment — `resolveProvider` refuses to hand this
    // adapter back in production.
    console.warn(`[otp:console] code for ${mobile.slice(-4).padStart(10, 'X')} is ${code}`);
    return { kind: 'transactional', code };
  },
};

// ------------------------------------------------------------
// MSG91 — managed (OTP API)
// ------------------------------------------------------------

const msg91Provider: OtpProvider = {
  name: 'msg91',
  kind: 'managed',
  async send(mobile: string): Promise<SendResult> {
    const authKey = required('OTP_PROVIDER_KEY');
    const templateId = required('OTP_TEMPLATE_ID');

    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', `91${mobile}`);
    url.searchParams.set('otp_length', '6');
    url.searchParams.set('otp_expiry', '5');

    const response = await fetch(url, {
      method: 'POST',
      headers: { authkey: authKey, 'content-type': 'application/json' },
      body: '{}',
    });

    const body = (await response.json().catch(() => ({}))) as { type?: string; request_id?: string };
    if (!response.ok || body.type === 'error') {
      throw new OtpProviderError('msg91_send_failed');
    }
    return { kind: 'managed', providerRef: body.request_id ?? `91${mobile}` };
  },

  async verify(mobile: string, _providerRef: string, code: string): Promise<boolean> {
    const authKey = required('OTP_PROVIDER_KEY');
    const url = new URL('https://control.msg91.com/api/v5/otp/verify');
    url.searchParams.set('mobile', `91${mobile}`);
    url.searchParams.set('otp', code);

    const response = await fetch(url, { method: 'GET', headers: { authkey: authKey } });
    const body = (await response.json().catch(() => ({}))) as { type?: string };
    return response.ok && body.type === 'success';
  },
};

// ------------------------------------------------------------
// 2Factor — managed (AUTOGEN)
// ------------------------------------------------------------

const twoFactorProvider: OtpProvider = {
  name: '2factor',
  kind: 'managed',
  async send(mobile: string): Promise<SendResult> {
    const apiKey = required('OTP_PROVIDER_KEY');
    const template = process.env.OTP_TEMPLATE_ID ?? 'OTP1';

    const response = await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/+91${mobile}/AUTOGEN/${template}`
    );
    const body = (await response.json().catch(() => ({}))) as {
      Status?: string;
      Details?: string;
    };
    if (!response.ok || body.Status !== 'Success' || !body.Details) {
      throw new OtpProviderError('2factor_send_failed');
    }
    return { kind: 'managed', providerRef: body.Details };
  },

  async verify(_mobile: string, providerRef: string, code: string): Promise<boolean> {
    const apiKey = required('OTP_PROVIDER_KEY');
    const response = await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(providerRef)}/${encodeURIComponent(code)}`
    );
    const body = (await response.json().catch(() => ({}))) as { Status?: string };
    return response.ok && body.Status === 'Success';
  },
};

// ------------------------------------------------------------
// Twilio Verify — managed
// ------------------------------------------------------------
//
// Works, and is the least painful to develop against. Note that Indian
// delivery still requires DLT-registered sender headers configured on
// the Twilio side; Twilio does not exempt anyone from TRAI.

const twilioProvider: OtpProvider = {
  name: 'twilio',
  kind: 'managed',
  async send(mobile: string): Promise<SendResult> {
    const { accountSid, authToken, serviceSid } = twilioConfig();
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `+91${mobile}`, Channel: 'sms' }),
      }
    );
    if (!response.ok) throw new OtpProviderError('twilio_send_failed');
    const body = (await response.json()) as { sid?: string };
    return { kind: 'managed', providerRef: body.sid ?? `+91${mobile}` };
  },

  async verify(mobile: string, _providerRef: string, code: string): Promise<boolean> {
    const { accountSid, authToken, serviceSid } = twilioConfig();
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `+91${mobile}`, Code: code }),
      }
    );
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === 'approved';
  },
};

function twilioConfig() {
  return {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    serviceSid: required('TWILIO_VERIFY_SERVICE_SID'),
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new OtpProviderError(`missing_env_${name}`);
  return value;
}

// ------------------------------------------------------------
// Selection
// ------------------------------------------------------------

const PROVIDERS: Record<string, OtpProvider> = {
  console: consoleProvider,
  msg91: msg91Provider,
  '2factor': twoFactorProvider,
  twilio: twilioProvider,
};

/**
 * The configured provider, or null when this deployment has none.
 *
 * Null is a legitimate state, not an error: there is no SMS account yet,
 * and an endpoint that says so is better than one that pretends to send.
 *
 * The `console` adapter is refused outright in production. A deployment
 * that fell back to logging codes would look like it was working while
 * verifying nobody, and would put live codes in a log aggregator.
 */
export function resolveProvider(): OtpProvider | null {
  const configured = (process.env.OTP_PROVIDER ?? '').trim().toLowerCase();
  const isProduction = (process.env.APP_MODE ?? process.env.VERCEL_ENV) === 'production';

  if (!configured) return isProduction ? null : consoleProvider;

  if (configured === 'console' && isProduction) {
    console.error('[otp] console provider refused in production');
    return null;
  }

  return PROVIDERS[configured] ?? null;
}
