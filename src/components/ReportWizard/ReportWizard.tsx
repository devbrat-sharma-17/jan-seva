import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReportWizard } from '../../hooks/useReportWizard';
import { useToast } from '../ui/Toast';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useTranslation } from '../../hooks/useTranslation';
import { ReportHeader } from './ReportHeader';
import { ProgressIndicator } from './ProgressIndicator';
import { DraftResumeModal } from './DraftResumeModal';
import { PhotoStep } from './PhotoStep/PhotoStep';
import { DescriptionStep } from './DescriptionStep/DescriptionStep';
import { IdentityStep } from './IdentityStep/IdentityStep';
import { LocationStep } from './LocationStep/LocationStep';
import { ReviewStep } from './ReviewStep/ReviewStep';
import { ProcessingScreen } from './Processing/ProcessingScreen';
import { DuplicateIssueCard } from './Duplicate/DuplicateIssueCard';
import { SuccessScreen } from './Success/SuccessScreen';
import './ReportWizard.css';

export function ReportWizard() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || undefined;
  const city = useCityConfig();
  const { t } = useTranslation();

  const {
    currentStep,
    draft,
    hasSavedDraft,
    savedDraftCount,
    aiAnalysis,
    submittedComplaint,
    stepError,
    submitError,
    draftSaveFailed,
    resumeDraft,
    discardDraft,
    addPhoto,
    removePhoto,
    replacePhoto,
    setDescription,
    setIdentityMethod,
    setMobileNumber,
    setAadhaarNumber,
    setOtp,
    setIdentityVerified,
    setName,
    setLocation,
    nextStep,
    photoChecking,
    prevStep,
    jumpToStep,
    submitComplaintReport,
    joinDuplicateReport,
    reportAsNewIssue,
  } = useReportWizard(city.id, initialCategory);

  const { showToast } = useToast();

  // A submission that could not be stored must be announced, not just
  // rendered as inline text on a step the citizen has already scrolled past.
  useEffect(() => {
    if (submitError) showToast(submitError, 'error');
  }, [submitError, showToast]);

  // Autosave failure is warned about once per session, not on every keystroke.
  const warnedAboutDraft = useRef(false);
  useEffect(() => {
    if (draftSaveFailed && !warnedAboutDraft.current) {
      warnedAboutDraft.current = true;
      showToast(
        'Your progress cannot be saved on this device. Finish the report in one go, or remove a photo.',
        'warning'
      );
    }
  }, [draftSaveFailed, showToast]);

  // Render specific step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PhotoStep
            photos={draft.photos}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
            onReplacePhoto={replacePhoto}
          />
        );
      case 2:
        return (
          <DescriptionStep
            description={draft.description}
            onChange={setDescription}
          />
        );
      case 3:
        return (
          <IdentityStep
            identityMethod={draft.identityMethod}
            aadhaarNumber={draft.aadhaarNumber}
            mobileNumber={draft.mobileNumber}
            otp={draft.otp}
            identityVerified={draft.identityVerified}
            name={draft.name}
            onMethodChange={setIdentityMethod}
            onAadhaarChange={setAadhaarNumber}
            onMobileChange={setMobileNumber}
            onOtpChange={setOtp}
            onVerified={setIdentityVerified}
            onNameChange={setName}
          />
        );
      case 4:
        return (
          <LocationStep
            location={draft.location}
            onLocationChange={setLocation}
          />
        );
      case 5:
        return (
          <ReviewStep
            draft={draft}
            onEditStep={jumpToStep}
          />
        );
      case 'processing':
        return <ProcessingScreen />;
      case 'duplicate':
        return aiAnalysis?.duplicateMatch ? (
          <DuplicateIssueCard
            match={aiAnalysis.duplicateMatch}
            onJoin={joinDuplicateReport}
            onReportNew={reportAsNewIssue}
          />
        ) : null;
      case 'success':
        return (
          <SuccessScreen
            complaint={submittedComplaint}
            analysis={aiAnalysis}
          />
        );
      default:
        return null;
    }
  };

  // Determine bottom bar CTA label & handler
  const getBottomAction = () => {
    if (typeof currentStep !== 'number') return null;

    if (currentStep === 5) {
      return (
        <div className="report-bottom-bar">
          <button
            type="button"
            className="report-btn report-btn--primary"
            onClick={submitComplaintReport}
            id="btn-submit-report"
          >
            <span>{t('report.bottom.submit')}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
          <p className="report-bottom-bar__support">{t('report.bottom.supportNote')}</p>
        </div>
      );
    }

    let btnLabel = t('report.bottom.continue');
    if (currentStep === 4) btnLabel = t('report.bottom.confirmLocation');
    // The photo check is a network call. Saying so beats a button that
    // looks broken for a second.
    if (photoChecking) btnLabel = t('report.photo.checking');

    const isStep1Disabled = currentStep === 1 && draft.photos.length === 0;
    const isStep4Disabled = currentStep === 4 && (!draft.location || !draft.location.confirmed);

    return (
      <div className="report-bottom-bar">
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={() => void nextStep()}
          disabled={isStep1Disabled || isStep4Disabled || photoChecking}
          id="btn-step-next"
        >
          <span>{btnLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="report-wizard">
      <div className="report-wizard__shell">
        {/* Top Header */}
        <ReportHeader
          currentStep={currentStep}
          hasPhotos={draft.photos.length > 0}
          onBack={prevStep}
        />

        {/* Thin Progress Indicator */}
        <ProgressIndicator currentStep={currentStep} />

        {/* Step Body */}
        <div className="report-wizard__body">
          {/* Inline Step Error Message */}
          {stepError && (
            <div className="step-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{stepError}</span>
            </div>
          )}

          <div className="report-step">
            {renderStepContent()}
          </div>
        </div>

        {/* Fixed / Sticky Bottom Bar */}
        {getBottomAction()}

        {/* Draft Resume Modal Prompt */}
        {hasSavedDraft && (
          <DraftResumeModal
            photoCount={savedDraftCount}
            onResume={resumeDraft}
            onDiscard={discardDraft}
          />
        )}
      </div>
    </div>
  );
}
