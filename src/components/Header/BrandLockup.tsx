import './BrandLockup.css';

interface BrandLockupProps {
  variant?: 'header' | 'footer' | 'default';
  showTagline?: boolean;
}

export function BrandLockup({
  variant = 'header',
  showTagline = true,
}: BrandLockupProps) {
  return (
    <div
      className={`brand-lockup brand-lockup--${variant}`}
      aria-label="JAN-SEVA — Aapki Samasya, Hamari Jimmedari"
    >
      {/* Brand Icon — aligned with wordmark */}
      <div className="brand-lockup__icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none" className="brand-lockup__icon">
          <circle className="brand-lockup__ring" cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="2" />
          <circle className="brand-lockup__ring-inner" cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <path d="M18 6 L21 14 L18 12 L15 14 Z" fill="currentColor" />
          <path d="M18 30 L15 22 L18 24 L21 22 Z" fill="currentColor" />
          <path className="brand-lockup__accent" d="M6 18 L14 15 L12 18 L14 21 Z" />
          <path className="brand-lockup__accent" d="M30 18 L22 21 L24 18 L22 15 Z" />
          <circle cx="18" cy="18" r="3" fill="currentColor" />
        </svg>
      </div>

      {/* Brand Text Column: Wordmark + Tagline */}
      <div className="brand-lockup__content">
        <span className="brand-lockup__wordmark">JAN-SEVA</span>
        {showTagline && (
          <span className="brand-lockup__tagline">
            Aapki Samasya, Hamari Jimmedari
          </span>
        )}
      </div>
    </div>
  );
}
