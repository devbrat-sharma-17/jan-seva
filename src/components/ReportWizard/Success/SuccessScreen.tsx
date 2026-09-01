import { useNavigate } from 'react-router-dom';
import type { Complaint } from '../../../types';
import type { AIAnalysis } from '../../../types/report';
import { useCityConfig } from '../../../hooks/useCityConfig';
import { useToast } from '../../ui/Toast';
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
  const { showToast } = useToast();

  // Reaching this screen without a stored complaint means the write failed.
  // The old fallback invented the ticket number "JS-GWL-2026-001284", which
  // sent the citizen to a tracking page for a complaint that does not exist
  // — and, worse, is a real seeded ticket belonging to someone else.
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
            TRY AGAIN
          </button>
          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={() => navigate('/')}
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  const isJoinedToExisting = complaint.duplicate?.isLinked === true;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(complaint.id);
      showToast('Ticket ID copied.', 'success');
    } catch {
      showToast(`Your ticket ID is ${complaint.id}`, 'warning');
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
          {isJoinedToExisting ? 'Confirmation added' : 'Report submitted'}
        </h2>
        <p className="success-subtitle">
          {/* ------------------------------------------------------
              This used to say the report had "raised the priority" of
              an existing complaint. It had not: `priorityScore` was
              written once at submission and never touched again, so
              the screen was telling citizens something untrue about
              what their report had achieved.

              Two things changed. Priority is now genuinely recomputed
              from independence-weighted spread, and — more importantly
              — the citizen now keeps their OWN ticket rather than
              being folded into a stranger's. The copy says what
              actually happened.
              ------------------------------------------------------ */}
          {isJoinedToExisting
            ? `Others had already reported this issue, so it is being worked as one job. You keep your own ticket and your own say in whether it is fixed — it cannot be closed on your behalf.`
            : `Thank you for helping make ${city.name} a cleaner and safer city.`}
        </p>
      </div>

      <div className="success-ticket-card">
        <div className="success-ticket-header">
          <span className="success-ticket-label">Complaint ticket</span>
          {/* Reflects the complaint's real status — a joined report inherits
              the primary's, which is rarely "pending". */}
          <StatusPill status={complaint.status} />
        </div>

        <div className="success-ticket-id-row">
          <span className="success-ticket-id-val">{complaint.id}</span>
          <button
            type="button"
            className="success-copy-btn"
            onClick={copyToClipboard}
            aria-label="Copy complaint ID"
          >
            Copy ID
          </button>
        </div>

        <div className="success-info-list">
          <div className="success-info-item">
            <span>Filed on</span>
            <span className="success-info-val">{formatStamp(complaint.createdAt)}</span>
          </div>

          <div className="success-info-item">
            <span>Location</span>
            <span className="success-info-val">
              {complaint.location?.address ||
                `${complaint.location?.locality || 'City Centre'}, ${city.name}`}
            </span>
          </div>

          <div className="success-info-item">
            <span>Classified issue</span>
            <span className="success-info-val">
              {analysis?.categoryTitle || complaint.issue?.title}
            </span>
          </div>

          <div className="success-info-item">
            <span>Routed department</span>
            <span className="success-info-val">{complaint.department?.name}</span>
          </div>
        </div>
      </div>

      <p className="success-note">
        Save this ticket ID. You will need it to check progress, and it is the reference the
        department will use when they contact you.
      </p>

      {/* The one promise worth making on this screen, and the one this
          product can actually keep. */}
      <div className="success-guarantee">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div>
          <strong>This cannot be closed without you.</strong>
          <span>
            The department can submit a repair, but only you can accept it. Their photo must be
            taken live at this location and must not have been used anywhere before. We will ask
            you again in 30 days whether it is still fixed.
          </span>
        </div>
      </div>

      <div className="success-actions">
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={() => navigate(`/track?id=${complaint.id}`)}
          id="btn-success-track"
        >
          TRACK COMPLAINT
        </button>

        <button
          type="button"
          className="report-btn report-btn--secondary"
          onClick={() => navigate('/')}
          id="btn-success-home"
        >
          BACK TO HOME
        </button>
      </div>
    </div>
  );
}
