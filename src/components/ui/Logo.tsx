import './Logo.css';

interface LogoProps {
  /** `compact` is used inside the fixed header; `lg` for footers and splash. */
  variant?: 'compact' | 'default' | 'lg';
  /** Hide the tagline entirely (e.g. very dense contexts). */
  showTagline?: boolean;
}

export function Logo({ variant = 'default', showTagline = true }: LogoProps) {
  return (
    <span className={`logo logo--${variant}`} aria-label="JAN-SEVA">
      {/* Blue geometry inherits `currentColor` from .logo__mark; the saffron
          points are tokenised via .logo__accent. No hex in the component. */}
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <circle className="logo__ring" cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="2" />
          <circle className="logo__ring-inner" cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          <path d="M18 6 L21 14 L18 12 L15 14 Z" fill="currentColor" />
          <path d="M18 30 L15 22 L18 24 L21 22 Z" fill="currentColor" />
          <path className="logo__accent" d="M6 18 L14 15 L12 18 L14 21 Z" />
          <path className="logo__accent" d="M30 18 L22 21 L24 18 L22 15 Z" />
          <circle cx="18" cy="18" r="3" fill="currentColor" />
        </svg>
      </span>

      <span className="logo__text">
        <span className="logo__wordmark">JAN-SEVA</span>
        {showTagline && (
          <span className="logo__tagline">Aapki Samasya, Hamari Jimmedari</span>
        )}
      </span>
    </span>
  );
}
