import { Link, useLocation } from 'react-router-dom';
import { Header } from '../Header/Header';
import { Footer } from '../Footer/Footer';
import { MobileActionBar } from '../MobileActionBar/MobileActionBar';
import './PlaceholderPage.css';

interface PlaceholderPageProps {
  title: string;
  description: string;
  /** Shown when the route exists in the nav but the screen is not built yet. */
  variant?: 'coming-soon' | 'not-found';
}

/**
 * Honest destination for routes the navigation advertises but that have no
 * screen yet — the admin and department portals, About, Help, Privacy and
 * the rest.
 *
 * Previously every one of these fell through the `*` route and silently
 * re-rendered the landing page, so a citizen tapping "Privacy Policy" was
 * dropped back at the top of the homepage with no explanation and no way
 * to tell whether they had mis-tapped.
 */
export function PlaceholderPage({ title, description, variant = 'coming-soon' }: PlaceholderPageProps) {
  const location = useLocation();

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header />

      <main id="main-content" className="placeholder">
        <div className="container placeholder__inner">
          <div className={`placeholder__badge placeholder__badge--${variant}`}>
            {variant === 'not-found' ? 'Page not found' : 'Coming soon'}
          </div>

          <h1 className="placeholder__title">{title}</h1>
          <p className="placeholder__text">{description}</p>

          {variant === 'not-found' && (
            <p className="placeholder__path">
              No page exists at <code>{location.pathname}</code>
            </p>
          )}

          <div className="placeholder__actions">
            <Link to="/report" className="report-btn report-btn--primary placeholder__cta">
              Report an issue
            </Link>
            <Link to="/track" className="report-btn report-btn--secondary placeholder__cta">
              Track a complaint
            </Link>
          </div>

          <Link to="/" className="placeholder__home">
            &larr; Back to home
          </Link>
        </div>
      </main>

      <Footer />
      <MobileActionBar />
    </div>
  );
}
