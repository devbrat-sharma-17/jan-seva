import { useEffect, useRef } from 'react';
import { mainNavLinks, secondaryNavLinks, portalLinks } from '../../data/navigation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { CitySelector } from './CitySelector';
import { useTranslation } from '../../hooks/useTranslation';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  cityName?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MobileMenu({ isOpen, onClose, cityName = 'Gwalior' }: MobileMenuProps) {
  const { locale, t, changeLocale } = useTranslation();
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

  const navKeyMap: Record<string, string> = {
    '/': 'nav.home',
    '/#how-it-works': 'nav.howItWorks',
    '/track': 'nav.track',
    '/initiatives': 'nav.initiatives',
    '/about': 'nav.about',
    '/help': 'nav.help',
  };

  const portalKeyMap: Record<string, { title: string; subtitle: string }> = {
    admin: { title: 'portal.admin.title', subtitle: 'portal.admin.subtitle' },
    department: { title: 'portal.dept.title', subtitle: 'portal.dept.subtitle' },
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`mobile-menu-backdrop ${isOpen ? 'mobile-menu-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Drawer */}
      <div
        ref={menuRef}
        id="mobile-menu"
        className={`mobile-menu ${isOpen ? 'mobile-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('lang.change')}
        inert={!isOpen}
      >
        <div className="mobile-menu__header">
          <CitySelector cityName={cityName} />

          <button
            ref={closeBtnRef}
            className="mobile-menu__close"
            onClick={onClose}
            aria-label={t('action.close')}
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
              <strong>{t('nav.report')}</strong>
              <small>{t('nav.reportCtaSub')}</small>
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
                {navKeyMap[link.href] ? t(navKeyMap[link.href]) : link.label}
                <svg className="icon icon--strong icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            ))}
          </nav>

          {/* Secondary pages */}
          <nav className="mobile-menu__nav mobile-menu__nav--secondary" aria-label={t('nav.more')}>
            {secondaryNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="mobile-menu__nav-link mobile-menu__nav-link--secondary"
                onClick={onClose}
              >
                {navKeyMap[link.href] ? t(navKeyMap[link.href]) : link.label}
                <svg className="icon icon--strong icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </a>
            ))}
          </nav>

          <div className="mobile-menu__divider" />

          {/* Portal Access */}
          <div className="mobile-menu__portals">
            <span className="mobile-menu__portals-label">{t('nav.portalAccess')}</span>
            {portalLinks.map((portal) => {
              const keys = portalKeyMap[portal.id];
              return (
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
                    <span className="mobile-menu__portal-title">
                      {keys ? t(keys.title) : portal.title}
                    </span>
                    <span className="mobile-menu__portal-subtitle">
                      {keys ? t(keys.subtitle) : portal.subtitle}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>

          {/* Language Selector */}
          <div className="mobile-menu__lang">
            <span className="mobile-menu__portals-label">{t('nav.language')}</span>
            <div className="mobile-menu__lang-options" role="group" aria-label={t('nav.language')}>
              <button
                type="button"
                className={`mobile-menu__lang-btn ${locale === 'en' ? 'mobile-menu__lang-btn--active' : ''}`}
                onClick={() => changeLocale('en')}
              >
                English
              </button>
              <button
                type="button"
                className={`mobile-menu__lang-btn ${locale === 'hi' ? 'mobile-menu__lang-btn--active' : ''}`}
                onClick={() => changeLocale('hi')}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
