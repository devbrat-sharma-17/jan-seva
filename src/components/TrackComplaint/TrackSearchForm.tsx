import React, { useState } from 'react';
import { isValidTicketFormat } from '../../services/complaintService';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useTranslation } from '../../hooks/useTranslation';

interface TrackSearchFormProps {
  onSearch: (complaintId: string) => void;
  onFindMyComplaints: () => void;
  verifiedName?: string;
  isVerified: boolean;
}

export function TrackSearchForm({
  onSearch,
  onFindMyComplaints,
  verifiedName,
  isVerified,
}: TrackSearchFormProps) {
  const [complaintId, setComplaintId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const city = useCityConfig();
  const { t } = useTranslation();

  const placeholder = `JS-${city.code}-${new Date().getFullYear()}-000000`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const clean = complaintId.trim().toUpperCase().replace(/\s+/g, '');

    if (!clean) {
      setErrorMessage(t('track.enterIdPrompt'));
      return;
    }

    if (!isValidTicketFormat(clean)) {
      setErrorMessage(t('track.invalidIdPrompt'));
      return;
    }

    onSearch(clean);
  };

  return (
    <div className="track-stack">
      <form className="track-search-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h2 className="track-card-title">{t('track.title')}</h2>
          <p className="track-card-subtitle">{t('track.subtitle')}</p>
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
            {t('track.idLabel')}
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
            {t('track.hint')}
          </p>
        </div>

        <button type="submit" className="report-btn report-btn--primary" id="btn-track-submit">
          <span>{t('track.btn')}</span>
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
            ? `${t('track.signedInAs')} ${verifiedName}`
            : t('track.forgotId')}
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
          <span>{t('track.findMine')}</span>
        </button>
      </div>
    </div>
  );
}
