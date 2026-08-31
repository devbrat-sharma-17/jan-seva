import { useEffect, useRef } from 'react';
import { mainNavLinks, secondaryNavLinks, portalLinks } from '../../data/navigation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { CitySelector } from './CitySelector';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  cityName?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MobileMenu({ isOpen, onClose, cityName = 'Gwalior' }: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember what opened the drawer so focus can go back there on close
    lastFocused.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap — Tab must cycle within the drawer, not fall through
      // to the page behind it.
      if (e.key !== 'Tab') return;

      const nodes = menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`mobile-menu-backdrop ${isOpen ? 'mobile-menu-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Drawer.
          `inert` while closed keeps the off-screen links out of the tab
          order and out of the accessibility tree. */}
      <div
        ref={menuRef}
        id="mobile-menu"
        className={`mobile-menu ${isOpen ? 'mobile-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!isOpen}
      >
        <div className="mobile-menu__header">
          <CitySelector cityName={cityName} />

          <button
            ref={closeBtnRef}
            className="mobile-menu__close"
            onClick={onClose}
            aria-label="Close menu"
            type="button"
          >
            <svg className="icon icon--strong icon--sm" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mobile-menu__content">
          {/* Primary CTA at top */}
          <a href="/report" className="mobile-menu__report-cta" onClick={onClose}>
            <span className="mobile-menu__report-icon" aria-hidden="true">
              <svg className="icon icon--md" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span className="mobile-menu__report-text">
              <strong>Report an Issue</strong>
              <small>Click. Describe. Submit in 60s.</small>
            </span>
            <svg className="icon icon--strong icon--sm mobile-menu__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>

          {/* Navigation Links */}
          <nav className="mobile-menu__nav" aria-label="Mobile navigation">
            {mainNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="mobile-menu__nav-link"
                onClick={onClose}
              >
                {link.label}
                <svg className="icon icon--strong icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            ))}
          </nav>

          {/* Secondary pages. These left the header bar (they did not fit
              and were duplicated in the footer) so the drawer is where
              they stay reachable on small screens. */}
          <nav className="mobile-menu__nav mobile-menu__nav--secondary" aria-label="More">
            {secondaryNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="mobile-menu__nav-link mobile-menu__nav-link--secondary"
                onClick={onClose}
              >
                {link.label}
                <svg className="icon icon--strong icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            ))}
          </nav>

          <div className="mobile-menu__divider" />

          {/* Portal Access */}
          <div className="mobile-menu__portals">
            <span className="mobile-menu__portals-label">Portal Access</span>
            {portalLinks.map((portal) => (
              <a
                key={portal.id}
                href={portal.href}
                className="mobile-menu__portal-link"
                onClick={onClose}
              >
                <span className="icon-tile icon-tile--sm mobile-menu__portal-icon" aria-hidden="true">
                  <CategoryIcon type={portal.icon} size="sm" />
                </span>
                <span className="mobile-menu__portal-text">
                  <span className="mobile-menu__portal-title">{portal.title}</span>
                  <span className="mobile-menu__portal-subtitle">{portal.subtitle}</span>
                </span>
              </a>
            ))}
          </div>

          {/* Language — mirrors the header control that is hidden on small phones */}
          <div className="mobile-menu__lang">
            <span className="mobile-menu__portals-label">Language</span>
            <div className="mobile-menu__lang-options" role="group" aria-label="Language">
              <button type="button" className="mobile-menu__lang-btn mobile-menu__lang-btn--active">
                English
              </button>
              <button type="button" className="mobile-menu__lang-btn">
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
