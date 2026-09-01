import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import './MobileActionBar.css';

/**
 * Persistent bottom action bar for phones.
 */
export function MobileActionBar() {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const hero = document.getElementById('hero');

    // Fall back to a scroll threshold if the hero is not on this page
    if (!hero) {
      const onScroll = () => setVisible(window.scrollY > 400);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: '-40% 0px 0px 0px' }
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`action-bar ${visible ? 'action-bar--visible' : ''}`}
      // Hidden from AT while off-screen — the same links exist in the page
      inert={!visible}
    >
      <a href="/track" className="action-bar__secondary">
        <svg className="icon icon--sm" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span>{t('track.search')}</span>
      </a>

      <a href="/report" className="action-bar__primary">
        <svg className="icon icon--sm" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>{t('nav.report')}</span>
      </a>
    </div>
  );
}
