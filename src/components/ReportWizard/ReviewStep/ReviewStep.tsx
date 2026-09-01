import type { ReportDraft } from '../../../types/report';
import { useTranslation } from '../../../hooks/useTranslation';
import './ReviewStep.css';

interface ReviewStepProps {
  draft: ReportDraft;
  onEditStep: (step: 1 | 2 | 3 | 4) => void;
}

export function ReviewStep({ draft, onEditStep }: ReviewStepProps) {
  const { t } = useTranslation();

  const getMaskedTarget = () => {
    if (draft.identityMethod === 'aadhaar') {
      const last4 = draft.aadhaarNumber.replace(/\s+/g, '').slice(-4) || '3841';
      return `Aadhaar: XXXX XXXX ${last4}`;
    }
    const last4 = draft.mobileNumber.slice(-4) || '9810';
    return `Mobile: +91 XXXXX ${last4}`;
  };

  return (
    <div className="review-step">
      <div className="step-heading">
        <h2 className="step-heading__title">{t('report.review.title')}</h2>
        <p className="step-heading__subtitle">{t('report.review.subtitle')}</p>
      </div>

      <div className="review-cards-list">
        {/* Photos Card */}
        <div className="review-card">
          <div className="review-card-header">
            <span className="review-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {t('report.review.photos')} ({draft.photos.length})
            </span>
            <button
              type="button"
              className="review-edit-btn"
              onClick={() => onEditStep(1)}
              aria-label={t('action.edit')}
            >
              {t('action.edit')} →
            </button>
          </div>

          <div className="review-photos-strip">
            {draft.photos.map((p) => (
              <img key={p.id} src={p.url} alt="" className="review-photo-thumb" />
            ))}
          </div>
        </div>

        {/* Description Card */}
        <div className="review-card">
          <div className="review-card-header">
            <span className="review-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {t('report.review.description')}
            </span>
            <button
              type="button"
              className="review-edit-btn"
              onClick={() => onEditStep(2)}
              aria-label={t('action.edit')}
            >
              {t('action.edit')} →
            </button>
          </div>

          <p className="review-text-content">
            {draft.description || t('report.review.noDesc')}
          </p>
        </div>

        {/* Identity Card */}
        <div className="review-card">
          <div className="review-card-header">
            <span className="review-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {t('report.review.identity')}
            </span>
            <button
              type="button"
              className="review-edit-btn"
              onClick={() => onEditStep(3)}
              aria-label={t('action.edit')}
            >
              {t('action.edit')} →
            </button>
          </div>

          <p className="review-text-content">
            {draft.name || 'Citizen'}
          </p>
          <div className="review-sub-info">
            <span>{t('report.review.verifiedVia').replace('{target}', getMaskedTarget())}</span>
          </div>
        </div>

        {/* Location Card */}
        <div className="review-card">
          <div className="review-card-header">
            <span className="review-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {t('report.review.location')}
            </span>
            <button
              type="button"
              className="review-edit-btn"
              onClick={() => onEditStep(4)}
              aria-label={t('action.edit')}
            >
              {t('action.edit')} →
            </button>
          </div>

          <p className="review-text-content">
            📍 {draft.location?.confirmed?.address || draft.location?.address || draft.location?.locality || 'Gwalior, Madhya Pradesh'}
          </p>
          <div className="review-sub-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{draft.location?.confirmed?.locality || draft.location?.locality}, {draft.location?.confirmed?.city || draft.location?.city}, {draft.location?.confirmed?.state || draft.location?.state}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--blue-600)', background: 'var(--blue-50)', padding: '2px 8px', borderRadius: '12px' }}>
              {draft.location?.confirmed?.source === 'manual' ? t('report.loc.sourceManual') : t('report.loc.sourceGps')}
            </span>
          </div>
        </div>

      </div>

      {/* Trust & Routing promise */}
      <div className="review-promise-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>
          {t('report.review.routingPromise')}
        </span>
      </div>
    </div>
  );
}
