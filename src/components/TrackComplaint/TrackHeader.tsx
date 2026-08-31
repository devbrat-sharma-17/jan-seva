import { useNavigate } from 'react-router-dom';

interface TrackHeaderProps {
  title?: string;
  onBack?: () => void;
  showHome?: boolean;
}

export function TrackHeader({
  title = 'Complaint Status',
  onBack,
  showHome = true,
}: TrackHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  return (
    <header className="track-header" aria-label="Tracking header">
      <button
        type="button"
        onClick={handleBack}
        className="track-header__back"
        aria-label="Go back"
        id="btn-track-back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>

      <h1 className="track-header__title">{title}</h1>

      {showHome ? (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="track-header__back"
          style={{ padding: '6px 8px' }}
          aria-label="Home"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      ) : (
        <div style={{ width: '40px' }} />
      )}
    </header>
  );
}
