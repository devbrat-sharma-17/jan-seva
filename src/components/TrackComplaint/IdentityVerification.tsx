import { useEffect, useRef, useState } from 'react';
import type { IdentityMethod } from '../../types';
import { sendOtp, verifyOtp } from '../../services/authService';
import {
  setVerifiedIdentity,
  formatAadhaarInput,
  formatMobileInput,
  isValidAadhaar,
  isValidMobile,
} from '../../services/identityService';
import { OtpInput } from './OtpInput';

interface IdentityVerificationProps {
  /** Why the citizen is being asked — shapes the heading and helper copy. */
  purpose: 'my-complaints' | 'photos' | 'details';
  onVerified: () => void;
  onCancel?: () => void;
}

const COPY: Record<IdentityVerificationProps['purpose'], { title: string; body: string }> = {
  'my-complaints': {
    title: 'Verify your identity',
    body: 'To protect your complaints, we will verify your mobile number or Aadhaar. Your identity is used to securely access your complaints.',
  },
  photos: {
    title: 'Verify to view photos',
    body: 'Verify your identity to view the original complaint photos.',
  },
  details: {
    title: 'Verify to view full details',
    body: 'Verify your identity to see the exact location and other details you submitted.',
  },
};

export function IdentityVerification({ purpose, onVerified, onCancel }: IdentityVerificationProps) {
  const [method, setMethod] = useState<IdentityMethod>('mobile');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'identifier' | 'otp'>('identifier');
  const [targetMasked, setTargetMasked] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const copy = COPY[purpose];

  // Resend cooldown, so the citizen is told when they may retry instead of
  // being silently rate-limited.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const identifierRef = useRef<HTMLInputElement>(null);

  const switchMethod = (next: IdentityMethod) => {
    setMethod(next);
    setIdentifier('');
    setOtp('');
    setStage('identifier');
    setError(null);
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifier(method === 'aadhaar' ? formatAadhaarInput(value) : formatMobileInput(value));
    setError(null);
  };

  const identifierIsValid =
    method === 'mobile' ? isValidMobile(identifier) : isValidAadhaar(identifier);

  const handleSendOtp = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await sendOtp(identifier, method);
      if (!res.success) {
        setError(res.message);
        return;
      }
      setTargetMasked(res.targetMasked);
      setStage('otp');
      setResendIn(res.resendAfterSeconds);
    } catch {
      setError('Could not send the code. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  const handleVerify = async (code: string = otp) => {
    setError(null);
    setPending(true);
    try {
      const res = await verifyOtp(identifier, code, method);
      if (!res.success || !res.identityReference) {
        setError(res.message);
        setOtp('');
        return;
      }

      setVerifiedIdentity({
        reference: res.identityReference,
        method,
        label: res.identityLabel ?? targetMasked,
        name: res.verifiedName,
      });
      onVerified();
    } catch {
      setError('Could not verify that code. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="verify-card">
      <div className="verify-card__head">
        <span className="verify-card__shield" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <div>
          <h3 className="verify-card__title">{copy.title}</h3>
          <p className="verify-card__body">{copy.body}</p>
        </div>
      </div>

      {stage === 'identifier' ? (
        <>
          <div className="track-search-tabs" role="tablist" aria-label="Verification method">
            <button
              type="button"
              role="tab"
              aria-selected={method === 'mobile'}
              className={`track-search-tab ${method === 'mobile' ? 'track-search-tab--active' : ''}`}
              onClick={() => switchMethod('mobile')}
            >
              Mobile number
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'aadhaar'}
              className={`track-search-tab ${method === 'aadhaar' ? 'track-search-tab--active' : ''}`}
              onClick={() => switchMethod('aadhaar')}
            >
              Aadhaar
            </button>
          </div>

          {error && <InlineError message={error} />}

          <div className="track-input-group">
            <label className="input-field-label" htmlFor="verify-identifier">
              {method === 'mobile' ? 'Registered mobile number' : 'Aadhaar number'}
            </label>
            <div className="track-input-box">
              {method === 'mobile' && <span className="input-field-prefix">+91</span>}
              <input
                ref={identifierRef}
                id="verify-identifier"
                type="tel"
                inputMode="numeric"
                autoComplete={method === 'mobile' ? 'tel-national' : 'off'}
                className="track-input-elem"
                placeholder={method === 'mobile' ? '98765 43210' : '1234 5678 9012'}
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && identifierIsValid && !pending) void handleSendOtp();
                }}
                aria-invalid={error !== null}
                autoFocus
              />
            </div>
            <p className="input-field-hint">
              {method === 'aadhaar'
                ? 'Your Aadhaar number is never stored. Only a masked reference is kept.'
                : 'We will send a one-time code to this number.'}
            </p>
          </div>

          <div className="verify-card__actions">
            {onCancel && (
              <button type="button" className="report-btn report-btn--secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={() => void handleSendOtp()}
              disabled={pending || !identifierIsValid}
            >
              {pending ? 'Sending code…' : 'SEND OTP'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="verify-card__sent">
            Enter the 6-digit code sent to <strong>{targetMasked}</strong>
          </p>

          {error && <InlineError message={error} />}

          <OtpInput
            value={otp}
            onChange={(next) => {
              setOtp(next);
              setError(null);
            }}
            onComplete={(code) => void handleVerify(code)}
            disabled={pending}
          />

          <div className="verify-card__actions">
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={() => {
                setStage('identifier');
                setOtp('');
                setError(null);
              }}
            >
              Change {method === 'mobile' ? 'number' : 'Aadhaar'}
            </button>
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={() => void handleVerify()}
              disabled={pending || otp.replace(/\D/g, '').length !== 6}
            >
              {pending ? 'Verifying…' : 'VERIFY'}
            </button>
          </div>

          <button
            type="button"
            className="verify-card__resend"
            onClick={() => void handleSendOtp()}
            disabled={resendIn > 0 || pending}
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </button>
        </>
      )}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="step-error" role="alert">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
