interface NotFoundNoticeProps {
  complaintId: string;
  onBack: () => void;
  onFindMine: () => void;
}

/**
 * Deliberately says nothing beyond "we could not find this". No hint about
 * whether a similar ID exists, and no partial match suggestions — that
 * would turn the ID field into a way to enumerate other people's tickets.
 */
export function NotFoundNotice({ complaintId, onBack, onFindMine }: NotFoundNoticeProps) {
  return (
    <div className="track-empty track-empty--error" role="alert">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="track-empty__icon"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <h3 className="track-empty__title">Couldn&apos;t find that complaint</h3>

      <p className="track-empty__text">
        No complaint matches <strong className="track-empty__code">{complaintId}</strong>. Check the
        ID on your acknowledgement slip, or look it up with your mobile number.
      </p>

      <div className="track-empty__actions">
        <button type="button" className="report-btn report-btn--secondary" onClick={onBack}>
          Check the ID
        </button>
        <button type="button" className="report-btn report-btn--primary" onClick={onFindMine}>
          Find my complaints
        </button>
      </div>
    </div>
  );
}
