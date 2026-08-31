import { useState } from 'react';
import type { Complaint, PublicComplaint } from '../../types';
import { submitFeedback, requestReinspection } from '../../services/complaintService';
import { useToast } from '../ui/Toast';

interface ResolutionVerificationCardProps {
  complaint: PublicComplaint;
  verifiedComplaint: Complaint | null;
  identityReference?: string;
  onVerifyIdentity: () => void;
  onChanged: () => void;
}

/**
 * Closing the loop on a resolution.
 *
 * Two gates before this renders anything actionable:
 *   - the department must have marked the work done, otherwise "has this
 *     been resolved?" invites a "no" against work nobody has started;
 *   - the viewer must be the verified reporter, because confirming or
 *     reopening someone else's complaint is exactly what verification
 *     exists to prevent.
 */
export function ResolutionVerificationCard({
  complaint,
  verifiedComplaint,
  identityReference,
  onVerifyIdentity,
  onChanged,
}: ResolutionVerificationCardProps) {
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const isResolved = complaint.status === 'resolved';
  const alreadyConfirmed = complaint.resolution?.citizenVerifiedResolved === true;
  const reinspectionRequested = verifiedComplaint?.feedback?.reinspectionRequested === true;

  // Nothing to verify until the work is reported done.
  if (!isResolved && !reinspectionRequested) return null;

  if (alreadyConfirmed) {
    return (
      <div
        id="resolution-verification"
        className="resolution-verify-box resolution-verify-box--confirmed"
      >
        <h3 className="resolution-verify-title">Verification complete</h3>
        <p className="resolution-verify-text">
          {verifiedComplaint?.feedback?.rating
            ? `Thank you for confirming. Your ${verifiedComplaint.feedback.rating}-star rating is recorded against this department's performance.`
            : 'This resolution was confirmed by the citizen who reported it.'}
        </p>
        {verifiedComplaint?.feedback?.comment && (
          <p className="resolution-verify-quote">“{verifiedComplaint.feedback.comment}”</p>
        )}
      </div>
    );
  }

  if (reinspectionRequested) {
    return (
      <div
        id="resolution-verification"
        className="resolution-verify-box resolution-verify-box--reinspect"
      >
        <h3 className="resolution-verify-title">Reinspection requested</h3>
        <p className="resolution-verify-text">
          This issue is marked for reinspection and the field supervisor has been notified. The
          department has a fresh 24-hour target.
        </p>
      </div>
    );
  }

  // Resolved, but this viewer has not proved they filed it.
  if (!verifiedComplaint || !identityReference) {
    return (
      <div id="resolution-verification" className="resolution-verify-box">
        <h3 className="resolution-verify-title">Has the issue been resolved?</h3>
        <p className="resolution-verify-text">
          The field team reported this issue as attended. Only the citizen who filed it can confirm
          the fix or send it back for reinspection.
        </p>
        <button type="button" className="report-btn report-btn--primary" onClick={onVerifyIdentity}>
          VERIFY TO CONFIRM
        </button>
      </div>
    );
  }

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const updated = await submitFeedback(
        complaint.id,
        identityReference,
        rating,
        comment.trim() || undefined
      );
      if (!updated) {
        showToast('Could not record your confirmation. Please try again.', 'error');
        return;
      }
      showToast('Thank you — your confirmation has been recorded.', 'success');
      onChanged();
    } catch {
      showToast('Could not submit your feedback. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReinspection = async () => {
    setBusy(true);
    try {
      const updated = await requestReinspection(
        complaint.id,
        identityReference,
        comment.trim() || undefined
      );
      if (!updated) {
        showToast('Could not request a reinspection. Please try again.', 'error');
        return;
      }
      showToast('Reinspection requested. A senior inspector has been notified.', 'success');
      onChanged();
    } catch {
      showToast('Could not request a reinspection. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="resolution-verification" className="resolution-verify-box">
      <h3 className="resolution-verify-title">Has the issue been resolved?</h3>
      <p className="resolution-verify-text">
        The field team reported this issue as attended. A complaint is only closed once you confirm
        it.
      </p>

      {choice === null && (
        <div className="resolution-choice-row">
          <button
            type="button"
            className="report-btn report-btn--confirm"
            onClick={() => setChoice('yes')}
            id="btn-confirm-fixed"
          >
            YES, IT&apos;S FIXED
          </button>
          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={() => setChoice('no')}
            id="btn-confirm-not-fixed"
          >
            NO, STILL AN ISSUE
          </button>
        </div>
      )}

      {choice === 'yes' && (
        <div className="resolution-form">
          <p className="resolution-form__lead">Thank you for confirming. How was the resolution?</p>

          <div className="star-rating-row" role="radiogroup" aria-label="Rate the resolution">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                className={`star-btn ${rating >= star ? 'star-btn--active' : ''}`}
                onClick={() => setRating(star)}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
            <span className="star-rating-row__value" aria-hidden="true">
              {rating}/5
            </span>
          </div>

          <label className="sr-only" htmlFor="resolution-comment">
            Additional comments
          </label>
          <input
            id="resolution-comment"
            type="text"
            className="resolution-input"
            placeholder="Tell us more… (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={280}
          />

          <div className="resolution-actions">
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={() => setChoice(null)}
            >
              Back
            </button>
            <button
              type="button"
              className="report-btn report-btn--confirm"
              onClick={() => void handleConfirm()}
              disabled={busy}
              id="btn-submit-resolution-feedback"
            >
              {busy ? 'Submitting…' : 'SUBMIT FEEDBACK'}
            </button>
          </div>
        </div>
      )}

      {choice === 'no' && (
        <div className="resolution-form">
          <div className="resolution-notice">
            Thanks for letting us know. The issue will be marked for reinspection and the department
            gets a fresh 24-hour deadline.
          </div>

          <label className="sr-only" htmlFor="reinspection-comment">
            What is still unresolved
          </label>
          <textarea
            id="reinspection-comment"
            className="desc-textarea resolution-textarea"
            placeholder="Tell us what is still unresolved — for example, debris left behind, or the leak has restarted."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
          />

          <div className="resolution-actions">
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={() => setChoice(null)}
            >
              Back
            </button>
            <button
              type="button"
              className="report-btn report-btn--warn"
              onClick={() => void handleReinspection()}
              disabled={busy}
              id="btn-request-reinspection"
            >
              {busy ? 'Requesting…' : 'REQUEST REINSPECTION'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
