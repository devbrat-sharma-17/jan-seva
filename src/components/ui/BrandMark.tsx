import './BrandMark.css';

interface BrandMarkProps {
  /**
   * Rendered size in pixels. The mark is drawn on a 36-unit grid and
   * scales cleanly; below ~20px use `simplified`.
   */
  size?: number;
  /**
   * Drops the inner ring and the four compass points, keeping only the
   * outer ring and hub. At favicon/bottom-bar sizes the full mark turns
   * into mud, so small placements get the reduced cut instead.
   */
  simplified?: boolean;
  /**
   * `onDark` swaps the navy geometry for white so the mark keeps its
   * contrast on the sidebar and login rail.
   */
  tone?: 'brand' | 'onDark';
  className?: string;
}

/**
 * The JAN-SEVA mark for the staff-facing portals.
 *
 * Copies of this SVG had been pasted into the department shell and login
 * and had already drifted from the original — both were missing the inner
 * ring and hard-coded the saffron — while the admin portal substituted a
 * 🏛 emoji entirely. All four placements render this component now.
 *
 * The landing page still draws its own copies in `Logo` and `BrandLockup`;
 * their sizing is CSS-driven where this is prop-driven, so they were left
 * as they are rather than risk a regression on a page that reads correctly.
 */
export function BrandMark({
  size = 32,
  simplified = false,
  tone = 'brand',
  className,
}: BrandMarkProps) {
  return (
    <span
      className={`brandmark brandmark--${tone}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" fill="none" focusable="false">
        <circle className="brandmark__ring" cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="2" />

        {!simplified && (
          <>
            <circle
              className="brandmark__ring-inner"
              cx="18"
              cy="18"
              r="12"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <path d="M18 6 L21 14 L18 12 L15 14 Z" fill="currentColor" />
            <path d="M18 30 L15 22 L18 24 L21 22 Z" fill="currentColor" />
            <path className="brandmark__accent" d="M6 18 L14 15 L12 18 L14 21 Z" />
            <path className="brandmark__accent" d="M30 18 L22 21 L24 18 L22 15 Z" />
          </>
        )}

        <circle cx="18" cy="18" r={simplified ? 5 : 3} fill="currentColor" />
      </svg>
    </span>
  );
}
