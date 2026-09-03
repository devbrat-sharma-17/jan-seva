// ============================================================
// useReportWizard — Centralized State Machine for Civic Reporting
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { ReportDraft, ReportPhoto, LocationData, IdentityMethod, ReportStep, AIAnalysis } from '../types/report';
import {
  saveDraftStorage,
  loadDraftStorage,
  clearDraftStorage,
  submitReport,
  joinExistingComplaint,
} from '../services/complaintService';
import { StorageQuotaError } from '../services/storage';
import { analyzeReportMock } from '../services/aiService';
import { screenSubmission, screenPhoto, recordFlaggedSubmission } from '../services/screeningPipeline';
import type { Complaint } from '../types';

const INITIAL_DRAFT: ReportDraft = {
  photos: [],
  description: '',
  identityMethod: 'mobile',
  aadhaarNumber: '',
  mobileNumber: '',
  otp: '',
  identityVerified: false,
  name: '',
  location: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function useReportWizard(cityId: string = 'gwalior', initialCategory?: string) {
  const [currentStep, setCurrentStep] = useState<ReportStep>(1);
  const [draft, setDraft] = useState<ReportDraft>(() => ({
    ...INITIAL_DRAFT,
    category: initialCategory,
  }));
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const [savedDraftCount, setSavedDraftCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [jumpedFromReview, setJumpedFromReview] = useState<boolean>(false);
  const [draftSaveFailed, setDraftSaveFailed] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** True while the photo step's screening call is in flight. */
  const [photoChecking, setPhotoChecking] = useState<boolean>(false);

  // Check for saved draft on initial mount
  useEffect(() => {
    const saved = loadDraftStorage();
    if (saved && (saved.photos?.length || saved.description?.trim())) {
      setHasSavedDraft(true);
      setSavedDraftCount(saved.photos?.length || 0);
    }
  }, []);

  // Restore saved draft
  const resumeDraft = useCallback(() => {
    const saved = loadDraftStorage();
    if (saved) {
      setDraft((prev) => ({
        ...prev,
        ...saved,
        photos: (saved.photos || []).map((p) => ({
          ...p,
          timestamp: p.timestamp || Date.now(),
        })),
      }));
    }
    setHasSavedDraft(false);
  }, []);

  // Discard saved draft
  const discardDraft = useCallback(() => {
    clearDraftStorage();
    setHasSavedDraft(false);
    setDraft({ ...INITIAL_DRAFT, category: initialCategory });
  }, [initialCategory]);

  // Persist draft on changes.
  // A failed autosave is not fatal to the session in progress, but the
  // citizen must know their work is no longer recoverable if they leave.
  useEffect(() => {
    if (currentStep === 'success' || currentStep === 'processing') return;
    try {
      saveDraftStorage(draft);
      setDraftSaveFailed(false);
    } catch {
      setDraftSaveFailed(true);
    }
  }, [draft, currentStep]);

  // Photo handlers
  const addPhoto = useCallback((photo: ReportPhoto) => {
    setDraft((prev) => {
      if (prev.photos.length >= 3) return prev;
      
      const newDraft = {
        ...prev,
        photos: [...prev.photos, photo],
      };

      // Automatically pre-fill location if the photo was geotagged and location is empty
      if (photo.location && !prev.location) {
        newDraft.location = {
          gps: photo.location,
          latitude: photo.location.latitude,
          longitude: photo.location.longitude,
          address: photo.location.address || 'Detected from photo',
          locality: photo.location.locality || 'Photo Location',
          city: photo.location.city || 'Gwalior',
          state: photo.location.state || 'Madhya Pradesh',
          pincode: '474001',
          confirmed: {
            latitude: photo.location.latitude,
            longitude: photo.location.longitude,
            address: photo.location.address || 'Detected from photo',
            locality: photo.location.locality || 'Photo Location',
            city: photo.location.city || 'Gwalior',
            state: photo.location.state || 'Madhya Pradesh',
            pincode: '474001',
            source: 'gps',
            confirmedAt: new Date().toISOString(),
          }
        };
      }
      
      return newDraft;
    });
    setStepError(null);
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  }, []);

  const replacePhoto = useCallback((photoId: string, newPhoto: ReportPhoto) => {
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.map((p) => (p.id === photoId ? newPhoto : p)),
    }));
  }, []);

  // Description handler
  const setDescription = useCallback((description: string) => {
    setDraft((prev) => ({ ...prev, description }));
    setStepError(null);
  }, []);

  // Identity handlers
  const setIdentityMethod = useCallback((identityMethod: IdentityMethod) => {
    setDraft((prev) => ({
      ...prev,
      identityMethod,
      otp: '',
      identityVerified: false,
    }));
    setStepError(null);
  }, []);

  const setMobileNumber = useCallback((mobileNumber: string) => {
    setDraft((prev) => ({ ...prev, mobileNumber }));
    setStepError(null);
  }, []);

  const setAadhaarNumber = useCallback((aadhaarNumber: string) => {
    setDraft((prev) => ({ ...prev, aadhaarNumber }));
    setStepError(null);
  }, []);

  const setOtp = useCallback((otp: string) => {
    setDraft((prev) => ({ ...prev, otp }));
    setStepError(null);
  }, []);

  const setIdentityVerified = useCallback(
    (verified: boolean, name?: string, attestation?: string) => {
      setDraft((prev) => ({
        ...prev,
        identityVerified: verified,
        // Cleared whenever verification is revoked, so a stale token cannot
        // outlive the state that justified it.
        identityAttestation: verified ? attestation ?? prev.identityAttestation : undefined,
        name: name !== undefined ? name : prev.name,
      }));
      setStepError(null);
    },
    []
  );

  const setName = useCallback((name: string) => {
    setDraft((prev) => ({ ...prev, name }));
    setStepError(null);
  }, []);

  // Location handler
  const setLocation = useCallback((location: LocationData | null) => {
    setDraft((prev) => ({ ...prev, location }));
    setStepError(null);
  }, []);

  // Step Validation
  const validateCurrentStep = useCallback((): boolean => {
    setStepError(null);
    if (currentStep === 1) {
      if (draft.photos.length === 0) {
        setStepError('Add at least one photo to continue.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!draft.description.trim() || draft.description.trim().length < 8) {
        setStepError('Please add a short description of the issue.');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!draft.identityVerified) {
        setStepError('Please verify your identity with OTP to continue.');
        return false;
      }
      if (!draft.name.trim()) {
        setStepError('Please enter your full name.');
        return false;
      }
      return true;
    }
    if (currentStep === 4) {
      if (!draft.location) {
        setStepError('Please confirm the issue location.');
        return false;
      }
      return true;
    }
    return true;
  }, [currentStep, draft]);

  // Next step navigation
  const nextStep = useCallback(async () => {
    if (!validateCurrentStep()) return;

    /* ----------------------------------------------------------
       Photo screening, at the photo step.

       Leaving the photo step is the last moment a bad photo costs the
       citizen only a retake. After this they write a description,
       verify an OTP and confirm a location — so a selfie caught at
       submit costs all four of those, and the citizen has already
       given us their phone number by then.

       Only the image is judged here; the description does not exist
       yet, and `screenSubmission` still runs at submit with it. This
       fails open: no provider, a timeout or an unsure model all
       continue to step 2.
       ---------------------------------------------------------- */
    if (currentStep === 1) {
      const photo = draft.photos[0]?.url;
      if (photo) {
        setPhotoChecking(true);
        try {
          const check = await screenPhoto(photo, {
            localityHint: draft.location?.locality,
          });
          if (check.blocked) {
            setStepError(check.message ?? null);
            return;
          }
        } finally {
          setPhotoChecking(false);
        }
      }
    }

    if (jumpedFromReview) {
      setJumpedFromReview(false);
      setCurrentStep(5);
      return;
    }

    if (currentStep === 1) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(3);
    else if (currentStep === 3) setCurrentStep(4);
    else if (currentStep === 4) setCurrentStep(5);
  }, [currentStep, validateCurrentStep, jumpedFromReview, draft.photos, draft.location]);

  // Previous step navigation
  const prevStep = useCallback(() => {
    setStepError(null);
    if (currentStep === 5) setCurrentStep(4);
    else if (currentStep === 4) setCurrentStep(3);
    else if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
  }, [currentStep]);

  // Direct jump from Review screen to edit specific section
  const jumpToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setJumpedFromReview(true);
    setCurrentStep(step);
  }, []);

  /** Turns a thrown value into a message the citizen can act on. */
  const describeFailure = (err: unknown): string => {
    if (err instanceof StorageQuotaError) return err.message;
    if (err instanceof Error && err.message) return err.message;
    return 'Something went wrong submitting your report. Please try again.';
  };

  // Submit and start the classification pipeline
  const submitComplaintReport = useCallback(async () => {
    setSubmitError(null);
    setCurrentStep('processing');
    setIsProcessing(true);

    try {
      /* --------------------------------------------------------
         Civic screening.

         Sits here and nowhere else: after the citizen has pressed
         submit, before a complaint exists. It adds no step and no
         field — a refusal surfaces through the same error path a
         failed write already uses, so the flow itself is unchanged.

         Only a BLOCK stops anything, and blocking is off by default
         (see featureFlags). Everything else continues down the
         existing path exactly as before.
         -------------------------------------------------------- */
      const screening = await screenSubmission(draft);

      if (screening.decision.action === 'BLOCK') {
        // No complaint record is created (spec §47). The citizen is
        // told what to photograph, not accused of anything.
        const message = screening.citizenMessage ?? screening.decision.citizenMessage;
        setSubmitError(message);
        setStepError(message);
        setCurrentStep(5);
        return;
      }

      const analysis = await analyzeReportMock(draft);
      setAiAnalysis(analysis);

      // A nearby open complaint pauses the flow for the citizen to decide.
      if (analysis.duplicateMatch) {
        setCurrentStep('duplicate');
        return;
      }

      const complaint = await submitReport(draft, analysis, cityId);

      // After the write, never before: a case pointing at a complaint
      // that failed to save would sit in the queue with nothing to open.
      recordFlaggedSubmission(complaint.id, screening);

      setSubmittedComplaint(complaint);
      setCurrentStep('success');
    } catch (err) {
      // Never advance to success on a failed write — the ticket number
      // would point at a complaint that was never stored.
      console.error('Submission failed', err);
      setSubmitError(describeFailure(err));
      setCurrentStep(5);
      setStepError(describeFailure(err));
    } finally {
      setIsProcessing(false);
    }
  }, [draft, cityId]);

  // Citizen adds their report as confirmation on the existing complaint
  const joinDuplicateReport = useCallback(async () => {
    if (!aiAnalysis) return;
    setIsProcessing(true);
    setSubmitError(null);
    try {
      const complaint = await joinExistingComplaint(draft, aiAnalysis, cityId);
      setSubmittedComplaint(complaint);
      setCurrentStep('success');
    } catch (err) {
      console.error('Joining existing complaint failed', err);
      setSubmitError(describeFailure(err));
      setStepError(describeFailure(err));
      setCurrentStep(5);
    } finally {
      setIsProcessing(false);
    }
  }, [draft, aiAnalysis, cityId]);

  // Citizen insists this is a separate issue
  const reportAsNewIssue = useCallback(async () => {
    if (!aiAnalysis) return;
    setIsProcessing(true);
    setSubmitError(null);
    try {
      const complaint = await submitReport(draft, aiAnalysis, cityId);
      setSubmittedComplaint(complaint);
      setCurrentStep('success');
    } catch (err) {
      console.error('Submission failed', err);
      setSubmitError(describeFailure(err));
      setStepError(describeFailure(err));
      setCurrentStep(5);
    } finally {
      setIsProcessing(false);
    }
  }, [draft, aiAnalysis, cityId]);

  return {
    currentStep,
    draft,
    hasSavedDraft,
    savedDraftCount,
    isProcessing,
    aiAnalysis,
    submittedComplaint,
    stepError,
    submitError,
    draftSaveFailed,
    jumpedFromReview,
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
  };
}
