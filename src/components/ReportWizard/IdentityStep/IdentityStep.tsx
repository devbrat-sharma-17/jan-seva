import React, { useState, useRef } from 'react';
import type { IdentityMethod } from '../../../types/report';

import { sendOtp, verifyOtp } from '../../../services/authService';
import './IdentityStep.css';

interface IdentityStepProps {
  identityMethod: IdentityMethod;
  aadhaarNumber: string;
  mobileNumber: string;
  otp: string;
  identityVerified: boolean;
  name: string;
  onMethodChange: (method: IdentityMethod) => void;
  onAadhaarChange: (val: string) => void;
  onMobileChange: (val: string) => void;
  onOtpChange: (val: string) => void;
  onVerified: (verified: boolean, name?: string) => void;
  onNameChange: (name: string) => void;
}

export function IdentityStep({
  identityMethod,
  aadhaarNumber,
  mobileNumber,
  otp,
  identityVerified,
  name,
  onMethodChange,
  onAadhaarChange,
  onMobileChange,
  onOtpChange,
  onVerified,
  onNameChange,
}: IdentityStepProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 6 separate OTP digit refs
  const digitRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Format Aadhaar: 1234 5678 9012
  const handleAadhaarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    onAadhaarChange(formatted);
    setErrorMessage(null);
  };

  // Format Mobile: 10 digits
  const handleMobileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    onMobileChange(raw);
    setErrorMessage(null);
  };

  const handleSendOtp = async () => {
    setErrorMessage(null);
    const target = identityMethod === 'aadhaar' ? aadhaarNumber.replace(/\s+/g, '') : mobileNumber;
    
    if (identityMethod === 'aadhaar' && target.length !== 12) {
      setErrorMessage('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (identityMethod === 'mobile' && target.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await sendOtp(target, identityMethod);
      if (res.success) {
        setOtpSent(true);
        setSentTo(res.targetMasked);
        // Pre-focus first OTP digit after a brief tick
        setTimeout(() => digitRefs[0].current?.focus(), 100);
      }
    } catch {
      setErrorMessage('Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle single digit input and auto-advance
  const handleOtpDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const otpArray = (otp || '').padEnd(6, ' ').split('');
    otpArray[index] = clean || ' ';
    const newOtp = otpArray.join('').trim();
    onOtpChange(newOtp);

    if (clean && index < 5) {
      digitRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      digitRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if ((otp || '').trim().length !== 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setVerifyingOtp(true);
    setErrorMessage(null);
    try {
      const target = identityMethod === 'aadhaar' ? aadhaarNumber : mobileNumber;
      const res = await verifyOtp(target, otp, identityMethod);
      if (res.success) {
        onVerified(true, res.verifiedName || (identityMethod === 'aadhaar' ? 'Raj Sharma' : ''));
      } else {
        setErrorMessage(res.message || 'Incorrect code. Please try again.');
      }
    } catch {
      setErrorMessage('Verification failed. Try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResetVerification = () => {
    onVerified(false, '');
    onOtpChange('');
    setOtpSent(false);
    setErrorMessage(null);
  };

  return (
    <div className="identity-step">
      <div className="step-heading">
        <h2 className="step-heading__title">Let's verify you</h2>
        <p className="step-heading__subtitle">
          We need a verified identity so you can track your complaint.
        </p>
      </div>

      {errorMessage && (
        <div className="step-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Already Verified State */}
      {identityVerified ? (
        <div className="identity-form-card">
          <div className="identity-verified-card">
            <div className="identity-verified-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="identity-verified-info">
              <span className="identity-verified-title">✓ Identity Verified</span>
              <span className="identity-verified-name">{name || 'Citizen'}</span>
              <span className="identity-verified-target">
                {identityMethod === 'aadhaar' ? `Aadhaar: XXXX XXXX ${aadhaarNumber.slice(-4) || '3841'}` : `Mobile: +91 ${mobileNumber}`}
              </span>
            </div>
          </div>

          {/* If verified via mobile, ensure name is confirmed */}
          {identityMethod === 'mobile' && (
            <div className="input-field-group" style={{ marginTop: '8px' }}>
              <label className="input-field-label" htmlFor="citizen-name-input">
                Your Full Name
              </label>
              <div className="input-field-box">
                <input
                  type="text"
                  id="citizen-name-input"
                  className="input-text-elem"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={handleResetVerification}
            style={{ minHeight: '40px', fontSize: '0.875rem' }}
          >
            Change Verification Method
          </button>
        </div>
      ) : (
        /* Verification In-Progress */
        <div className="identity-form-card">
          {/* Method Tabs */}
          <div className="identity-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={identityMethod === 'aadhaar'}
              className={`identity-tab-btn ${identityMethod === 'aadhaar' ? 'identity-tab-btn--active' : ''}`}
              onClick={() => {
                onMethodChange('aadhaar');
                setOtpSent(false);
                setErrorMessage(null);
              }}
              id="tab-aadhaar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="7" y1="8" x2="17" y2="8" />
                <line x1="7" y1="12" x2="13" y2="12" />
              </svg>
              <span>Aadhaar</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={identityMethod === 'mobile'}
              className={`identity-tab-btn ${identityMethod === 'mobile' ? 'identity-tab-btn--active' : ''}`}
              onClick={() => {
                onMethodChange('mobile');
                setOtpSent(false);
                setErrorMessage(null);
              }}
              id="tab-mobile"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>Mobile Number</span>
            </button>
          </div>

          {/* Aadhaar Input Field */}
          {identityMethod === 'aadhaar' ? (
            <div className="input-field-group">
              <label className="input-field-label" htmlFor="aadhaar-number-input">
                Aadhaar Number
              </label>
              <div className="input-field-box">
                <input
                  type="text"
                  id="aadhaar-number-input"
                  className="input-text-elem"
                  placeholder="5482 9102 3841"
                  value={aadhaarNumber}
                  onChange={handleAadhaarInput}
                  disabled={otpSent}
                />
              </div>
            </div>
          ) : (
            /* Mobile Input Field */
            <div className="input-field-group">
              <label className="input-field-label" htmlFor="mobile-number-input">
                Mobile Number
              </label>
              <div className="input-field-box">
                <span className="input-field-prefix">+91</span>
                <input
                  type="tel"
                  id="mobile-number-input"
                  className="input-text-elem"
                  placeholder="98765 43210"
                  value={mobileNumber}
                  onChange={handleMobileInput}
                  disabled={otpSent}
                />
              </div>
            </div>
          )}

          {/* Send OTP Button (if not sent yet) */}
          {!otpSent ? (
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={handleSendOtp}
              disabled={sendingOtp}
              id="btn-send-otp"
            >
              {sendingOtp ? 'Sending code...' : 'SEND OTP'}
            </button>
          ) : (
            /* OTP Screen */
            <div className="otp-container">
              <div className="otp-header">
                <h4 className="otp-title">Enter OTP</h4>
                <p className="otp-subtitle">
                  We sent a 6-digit verification code to your registered{' '}
                  {identityMethod === 'aadhaar' ? 'Aadhaar mobile' : 'number'}.
                </p>
              </div>

              {/* 6 Digit Inputs */}
              <div className="otp-inputs-row">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <input
                    key={idx}
                    ref={digitRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className="otp-digit-input"
                    value={otp[idx] || ''}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    aria-label={`Digit ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="otp-actions-row">
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleSendOtp}
                >
                  Resend OTP
                </button>
                {sentTo && (
                  <span className="otp-sent-hint">Code sent to {sentTo}</span>
                )}
              </div>

              <button
                type="button"
                className="report-btn report-btn--primary"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp}
                id="btn-verify-otp"
              >
                {verifyingOtp ? 'Verifying...' : 'VERIFY & CONTINUE'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trust Notice */}
      <div className="identity-privacy-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Your identity is encrypted and used solely to verify and track your civic complaints.</span>
      </div>
    </div>
  );
}
