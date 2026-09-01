import { useNavigate } from 'react-router-dom';
import type { Complaint } from '../../../types';
import type { AIAnalysis } from '../../../types/report';
import { useCityConfig } from '../../../hooks/useCityConfig';
import { useToast } from '../../ui/Toast';
import { useTranslation } from '../../../hooks/useTranslation';
import { StatusPill } from '../../TrackComplaint/StatusPill';
import { formatStamp } from '../../../services/timeService';
import './SuccessScreen.css';

interface SuccessScreenProps {
  complaint: Complaint | null;
  analysis: AIAnalysis | null;
}

export function SuccessScreen({ complaint, analysis }: SuccessScreenProps) {
  const navigate = useNavigate();
  const city = useCityConfig();
  const { t } = useTranslation();
  const { showToast } = useToast();

  if (!complaint) {
    return (
      <div className="success-screen">
        <div className="success-heading">
          <h2 className="success-title">Report not saved</h2>
          <p className="success-subtitle">
            Your report could not be stored on this device, so no ticket number was issued. Please
            go back and submit it again — your details are still filled in.
          </p>
        </div>

        <div className="success-actions">
          <button
            type="button"
            className="report-btn report-btn--primary"
            onClick={() => navigate(0)}
          >
            {t('action.tryAgain')}
          </button>
          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={() => navigate('/')}
          >
            {t('success.home')}
          </button>
        </div>
      </div>
    );
  }

  const isJoinedToExisting = complaint.duplicate?.isLinked === true;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(complaint.id);
      showToast(t('success.copied'), 'success');
    } catch {
      showToast(`${t('success.ticketLabel')} ${complaint.id}`, 'warning');
    }
  };

  return (
    <div className="success-screen">
      <div className="success-checkmark-wrapper">
        <svg
          className="success-checkmark-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path className="success-checkmark-path" d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <div className="success-heading">
        <h2 className="success-title">
          {isJoinedToExisting ? t('success.titleJoined') : t('success.title')}
        </h2>
        <p className="success-subtitle">
          {isJoinedToExisting
            ? t('success.subtitleJoined')
            : t('success.subtitle').replace('{city}', city.name)}
        </p>
      </div>

      <div className="success-ticket-card">
        <div className="success-ticket-header">
          <span className="success-ticket-label">{t('success.ticketLabel')}</span>
          <StatusPill status={complaint.status} />
        </div>

        <div className="success-ticket-id-row">
          <span className="success-ticket-id-val">{complaint.id}</span>
          <button
            type="button"
            className="success-copy-btn"
            onClick={copyToClipboard}
            aria-label={t('success.copyBtn')}
          >
            {t('success.copyBtn')}
          </button>
        </div>

        <div className="success-info-list">
          <div className="success-info-item">
            <span>{t('success.filedOn')}</span>
            <span className="success-info-val">{formatStamp(complaint.createdAt)}</span>
          </div>

          <div className="success-info-item">
            <span>{t('success.location')}</span>
            <span className="success-info-val">
              {complaint.location?.address ||
                `${complaint.location?.locality || 'City Centre'}, ${city.name}`}
            </span>
          </div>

          <div className="success-info-item">
            <span>{t('success.classifiedIssue')}</span>
            <span className="success-info-val">
              {analysis?.categoryTitle || complaint.issue?.title}
            </span>
          </div>

          <div className="success-info-item">
            <span>{t('success.department')}</span>
            <span className="success-info-val">{complaint.department?.name}</span>
          </div>
        </div>
      </div>

      <p className="success-note">
        {t('success.saveNote')}
      </p>

      {/* Trust & Guarantee Banner */}
      <div className="success-guarantee">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div>
          <strong>{t('success.guaranteeTitle')}</strong>
          <span>{t('success.guaranteeDesc')}</span>
        </div>
      </div>

      <div className="success-actions">
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={() => navigate(`/track?id=${complaint.id}`)}
          id="btn-success-track"
        >
          {t('success.track')}
        </button>

        <button
          type="button"
          className="report-btn report-btn--secondary"
          onClick={() => navigate('/')}
          id="btn-success-home"
        >
          {t('success.home')}
        </button>
      </div>
    </div>
  );
}
