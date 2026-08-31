import { useEffect, useRef } from 'react';
import type { PublicComplaint } from '../../types';
import { statusLabel } from './StatusPill';
import { generateReceiptData } from '../../services/complaintService';
import { formatStamp } from '../../services/timeService';

interface ReceiptModalProps {
  complaint: PublicComplaint;
  onClose: () => void;
}

/**
 * The acknowledgement slip gets printed and handed over, so it is built
 * from the public projection only — it carries no name, no phone number and
 * no coordinates. Taking `PublicComplaint` rather than `Complaint` makes
 * that structural instead of a convention someone can forget.
 */
export function ReceiptModal({ complaint, onClose }: ReceiptModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const receipt = generateReceiptData(complaint);

  // Escape to dismiss, focus moved into the dialog, and Tab kept inside it.
  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Complaint ID', value: receipt.complaintId },
    { label: 'Reported on', value: formatStamp(receipt.reportedOn) },
    { label: 'Issue', value: receipt.issue },
    { label: 'Location', value: receipt.area },
    { label: 'Reported through', value: receipt.reportedThrough },
    { label: 'Current status', value: statusLabel(receipt.status) },
    { label: 'Department', value: `${receipt.department} — ${receipt.division}` },
  ];

  return (
    <div
      className="report-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="report-dialog receipt-print-area receipt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="receipt__header">
          <span className="receipt__brand">JAN-SEVA</span>
          <h3 id="receipt-title" className="receipt__title">
            Civic Complaint Acknowledgment
          </h3>
          <p className="receipt__org">Municipal Corporation — Citizen Grievance Redressal</p>
        </div>

        <div className="receipt__ticket">
          <span className="receipt__ticket-label">Complaint reference</span>
          <div className="receipt__ticket-id">{receipt.complaintId}</div>
        </div>

        <dl className="receipt__rows">
          {rows.map((row) => (
            <div key={row.label} className="receipt__row">
              <dt className="receipt__key">{row.label}</dt>
              <dd className="receipt__value">{row.value}</dd>
            </div>
          ))}
        </dl>

        <p className="receipt__footnote">
          Quote this reference in any correspondence about this complaint.
        </p>

        <div className="receipt__actions">
          <button
            ref={closeRef}
            type="button"
            className="report-btn report-btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="report-btn report-btn--primary"
            onClick={() => window.print()}
            id="btn-print-receipt"
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
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Print / save</span>
          </button>
        </div>
      </div>
    </div>
  );
}
