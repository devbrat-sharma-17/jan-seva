import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReportStep } from '../../types/report';

interface ReportHeaderProps {
  currentStep: ReportStep;
  hasPhotos: boolean;
  onBack: () => void;
}

export function ReportHeader({ currentStep, hasPhotos, onBack }: ReportHeaderProps) {
  const navigate = useNavigate();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Hide header buttons on processing or success
  if (currentStep === 'processing' || currentStep === 'success') {
    return null;
  }

  const handleBackClick = () => {
    if (currentStep === 1) {
      if (hasPhotos) {
        setShowExitConfirm(true);
      } else {
        navigate('/');
      }
    } else if (typeof currentStep === 'number') {
      onBack();
    } else {
      navigate('/');
    }
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    navigate('/');
  };

  const getStepText = () => {
    if (typeof currentStep === 'number') {
      return `${currentStep} / 5`;
    }
    return '';
  };

  return (
    <>
      <header className="report-header" aria-label="Report header">
        <button
          type="button"
          onClick={handleBackClick}
          className="report-header__back"
          aria-label="Go back"
          id="report-back-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        <h1 className="report-header__title">Report an Issue</h1>

        {typeof currentStep === 'number' ? (
          <span className="report-header__step" aria-label={`Step ${currentStep} of 5`}>
            {getStepText()}
          </span>
        ) : (
          <div style={{ width: '48px' }} />
        )}
      </header>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="report-dialog-overlay" role="dialog" aria-modal="true">
          <div className="report-dialog">
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              Leave report?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9375rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>
              Your photos and report draft will be saved temporarily on this device.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="report-btn report-btn--secondary"
                onClick={() => setShowExitConfirm(false)}
                style={{ flex: 1 }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="report-btn report-btn--primary"
                onClick={confirmExit}
                style={{ flex: 1, backgroundColor: 'var(--slate-800)' }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
