import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { footerQuickLinks, footerImportantLinks } from '../../data/navigation';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useTranslation } from '../../hooks/useTranslation';
import './Footer.css';

export function Footer() {
  const city = useCityConfig();
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const navKeyMap: Record<string, string> = {
    '/': 'nav.home',
    '/#how-it-works': 'nav.howItWorks',
    '/track': 'nav.track',
    '/initiatives': 'nav.initiatives',
    '/about': 'nav.about',
    '/privacy': 'nav.privacy',
    '/terms': 'nav.terms',
    '/help': 'nav.help',
    '/contact': 'nav.contact',
  };

  return (
    <footer className="footer" aria-label="Site footer">
      <div className="footer__inner container">
        <div className="footer__top">
          {/* Brand */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo-link" aria-label="JAN-SEVA — Home">
              <Logo variant="lg" />
            </Link>
            <p className="footer__tagline">{t('app.tagline')}</p>
            <p className="footer__city">
              {t('app.serving').replace('{city}', city.name).replace('{state}', city.state)}
            </p>
          </div>

          {/* Link columns */}
          <nav className="footer__links" aria-label="Footer navigation">
            <div className="footer__col">
              <h2 className="footer__col-title">{t('nav.quickLinks')}</h2>
              <ul>
                {footerQuickLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="footer__link">
                      {navKeyMap[link.href] ? t(navKeyMap[link.href]) : link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer__col">
              <h2 className="footer__col-title">{t('nav.important')}</h2>
              <ul>
                {footerImportantLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="footer__link">
                      {navKeyMap[link.href] ? t(navKeyMap[link.href]) : link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">
            {t('app.copyright').replace('{year}', String(year)).replace('{city}', city.name)}
          </p>
          <div className="footer__portals">
            <a href="/admin/login" className="footer__portal-link">{t('nav.adminLogin')}</a>
            <span className="footer__dot" aria-hidden="true" />
            <a href="/department/login" className="footer__portal-link">{t('nav.departmentLogin')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
