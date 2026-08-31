interface DraftResumeModalProps {
  photoCount: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftResumeModal({ photoCount, onResume, onDiscard }: DraftResumeModalProps) {
  return (
    <div className="report-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="draft-dialog-title">
      <div className="report-dialog">
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          backgroundColor: 'var(--blue-50)',
          color: 'var(--blue-600)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <h3 id="draft-dialog-title" style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
          Continue your report?
        </h3>
        
        <p style={{ margin: '0 0 20px 0', fontSize: '0.9375rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>
          You have an unfinished report saved on this device{photoCount > 0 ? ` with ${photoCount} photo${photoCount > 1 ? 's' : ''}` : ''}.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="report-btn report-btn--primary"
            onClick={onResume}
            id="draft-resume-btn"
          >
            Continue Report
          </button>
          
          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={onDiscard}
            id="draft-discard-btn"
          >
            Discard &amp; Start New
          </button>
        </div>
      </div>
    </div>
  );
}
