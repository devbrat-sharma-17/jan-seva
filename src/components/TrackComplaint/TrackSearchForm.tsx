import React, { useState } from 'react';
import { isValidTicketFormat } from '../../services/complaintService';
import { useCityConfig } from '../../hooks/useCityConfig';

interface TrackSearchFormProps {
  onSearch: (complaintId: string) => void;
  onFindMyComplaints: () => void;
  verifiedName?: string;
  isVerified: boolean;
}

/**
 * The default state of `/track`.
 *
 * Note what is *not* here: no list of recent complaints, no sample tickets,
 * no "complaints near you". An unverified visitor sees only an empty field.
 * Anything else would hand out other citizens' complaints to anyone who
 * opens the page.
 */
export function TrackSearchForm({
  onSearch,
  onFindMyComplaints,
  verifiedName,
  isVerified,
}: TrackSearchFormProps) {
  const [complaintId, setComplaintId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const city = useCityConfig();

  const placeholder = `JS-${city.code}-${new Date().getFullYear()}-000000`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const clean = complaintId.trim().toUpperCase().replace(/\s+/g, '');

    if (!clean) {
      setErrorMessage('Enter your Complaint ID to continue.');
      return;
    }

    if (!isValidTicketFormat(clean)) {
      setErrorMessage('Enter a valid JAN-SEVA Complaint ID.');
      return;
    }

    onSearch(clean);
  };

  return (
    <div className="track-stack">
      <form className="track-search-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h2 className="track-card-title">Track your complaint</h2>
          <p className="track-card-subtitle">
            Enter your Complaint ID to see its current status.
          </p>
        </div>

        {errorMessage && (
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
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="track-input-group">
          <label className="input-field-label" htmlFor="input-complaint-id">
            Complaint ID
          </label>
          <div className="track-input-box">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="track-input-icon"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              id="input-complaint-id"
              className="track-input-elem track-input-elem--ticket"
              placeholder={placeholder}
              value={complaintId}
              onChange={(e) => setComplaintId(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="ticket-id-hint"
              aria-invalid={errorMessage !== null}
              autoFocus
            />
          </div>
          <p id="ticket-id-hint" className="input-field-hint">
            Find this on your acknowledgement slip or confirmation message.
          </p>
        </div>

        <button type="submit" className="report-btn report-btn--primary" id="btn-track-submit">
          <span>TRACK COMPLAINT</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      <div className="track-alt">
        <span className="track-alt__label">
          {isVerified && verifiedName
            ? `Signed in as ${verifiedName}`
            : 'Forgot your Complaint ID?'}
        </span>
        <button
          type="button"
          className="report-btn report-btn--outline"
          onClick={onFindMyComplaints}
          id="btn-find-my-complaints"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>FIND MY COMPLAINTS</span>
        </button>
      </div>
    </div>
  );
}
