import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import './BrandHomeLink.css';

interface BrandHomeLinkProps {
  /** Small label set beside the wordmark, e.g. "Operations". */
  sub?: string;
  tone?: 'brand' | 'onDark';
  size?: 'sm' | 'md';
  /** Fired after navigation starts — used to close the mobile drawer. */
  onNavigate?: () => void;
}

/**
 * The JAN-SEVA wordmark, always linking to the public homepage.
 *
 * Both portals previously pointed their brand somewhere else — the admin
 * sidebar linked to its own dashboard, the department login was not a link
 * at all — so clicking the logo did different things depending on where you
 * stood. It goes home from everywhere now.
 */
export function BrandHomeLink({
  sub,
  tone = 'brand',
  size = 'md',
  onNavigate,
}: BrandHomeLinkProps) {
  return (
    <Link
      to="/"
      className={`brandhome brandhome--${tone} brandhome--${size}`}
      title="Go to the JAN-SEVA home page"
      onClick={onNavigate}
    >
      <BrandMark size={size === 'sm' ? 24 : 30} tone={tone} />
      <span className="brandhome__word">JAN-SEVA</span>
      {sub && <span className="brandhome__sub">{sub}</span>}
    </Link>
  );
}
