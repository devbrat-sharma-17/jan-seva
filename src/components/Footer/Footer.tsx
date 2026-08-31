import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { footerQuickLinks, footerImportantLinks } from '../../data/navigation';
import { useCityConfig } from '../../hooks/useCityConfig';
import './Footer.css';

export function Footer() {
  const city = useCityConfig();
  const year = new Date().getFullYear();

  return (
    <footer className="footer" aria-label="Site footer">
      <div className="footer__inner container">
        <div className="footer__top">
          {/* Brand */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo-link" aria-label="JAN-SEVA — Home">
              <Logo variant="lg" />
            </Link>
            <p className="footer__tagline">{city.localTagline}</p>
            <p className="footer__city">
              Serving {city.name}, {city.state}
            </p>
          </div>

          {/* Link columns */}
          <nav className="footer__links" aria-label="Footer navigation">
            <div className="footer__col">
              <h2 className="footer__col-title">Quick Links</h2>
              <ul>
                {footerQuickLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="footer__link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer__col">
              <h2 className="footer__col-title">Important</h2>
              <ul>
                {footerImportantLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="footer__link">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">
            © {year} JAN-SEVA. A civic grievance platform for {city.name}.
          </p>
          <div className="footer__portals">
            <a href="/admin/login" className="footer__portal-link">Admin Login</a>
            <span className="footer__dot" aria-hidden="true" />
            <a href="/department/login" className="footer__portal-link">Department Login</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
