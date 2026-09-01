import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from './BrandLockup';
import { CitySelector } from './CitySelector';
import { LanguageSelector } from './LanguageSelector';
import { MobileMenu } from './MobileMenu';
import { mainNavLinks } from '../../data/navigation';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useTranslation } from '../../hooks/useTranslation';
import './Header.css';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const city = useCityConfig();
  const { t } = useTranslation();

  const navKeyMap: Record<string, string> = {
    '/': 'nav.home',
    '/#how-it-works': 'nav.howItWorks',
    '/track': 'nav.track',
    '/initiatives': 'nav.initiatives',
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu open, preserving scroll position.
  // Plain `overflow: hidden` alone lets iOS Safari jump to the top.
  useEffect(() => {
    if (!menuOpen) return;

    const scrollY = window.scrollY;
    document.body.classList.add('menu-open');
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen]);

  // Close the drawer if the viewport grows past the mobile breakpoint
  // while it is open — otherwise it stays mounted and traps focus.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <>
      <header
        className={`header ${scrolled ? 'header--scrolled' : ''}`}
        id="main-header"
      >
        <div className="header__inner container">
          {/* Zone 1: Left Brand Lockup */}
          <Link to="/" className="header__logo" aria-label="JAN-SEVA — Home">
            <BrandLockup variant="header" />
          </Link>


          {/* Center: Navigation (desktop only) */}
          <nav className="header__nav" aria-label="Main navigation">
            {mainNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`header__nav-link header__nav-link--p${link.priority ?? 1}`}
              >
                {navKeyMap[link.href] ? t(navKeyMap[link.href]) : link.label}
              </a>
            ))}
          </nav>

          {/* Right: Controls */}
          <div className="header__controls">
            <CitySelector cityName={city.name} />

            <div className="header__lang">
              <LanguageSelector />
            </div>

            {/* Desktop portal buttons */}
            <div className="header__portal-btns">
              <a href="/admin/login" className="header__portal-btn">
                {t('nav.admin')}
              </a>
              <a href="/department/login" className="header__portal-btn header__portal-btn--primary">
                {t('nav.department')}
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              className={`header__hamburger ${menuOpen ? 'header__hamburger--open' : ''}`}
              onClick={toggleMenu}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              id="menu-toggle"
              type="button"
            >
              <span className="header__hamburger-box" aria-hidden="true">
                <span className="header__hamburger-line" />
                <span className="header__hamburger-line" />
                <span className="header__hamburger-line" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu isOpen={menuOpen} onClose={closeMenu} cityName={city.name} />
    </>
  );
}
