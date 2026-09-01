import { useMemo } from 'react';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useCinematicStats, type StatItem } from '../../hooks/useCountUp';
import { useDeferredCityStats } from '../../hooks/useDeferredCityStats';
import { useTranslation } from '../../hooks/useTranslation';
import { getProgrammeStats } from '../../services/programmeStats';
import { PrimaryCTA } from '../ui/PrimaryCTA';
import { SecondaryCTA } from '../ui/SecondaryCTA';
import './Hero.css';

export function Hero() {
  const city = useCityConfig();
  const { t } = useTranslation();

  /* --------------------------------------------------------------
     Every number in the trust bar is DERIVED from the complaint store
     on each read. The previous version animated three constants —
     12,480 / 94% / 42 — one of which contradicted another constant in
     the same object. Constants on a trust bar are the one place a
     civic product cannot afford them.

     The middle figure is deliberately the least flattering one
     available: resolutions the CITIZEN confirmed, not resolutions a
     department claimed. It is the product thesis stated as a number.

     Reading the store is deferred to an idle callback, because it pulls
     in the seeded asset registry, repair ledger and complaint history —
     none of which should block the first paint. The bar is below the
     fold and counts up on scroll, so the placeholder is never seen in
     practice. See `useDeferredCityStats`.
     -------------------------------------------------------------- */
  const { stats: live, ready } = useDeferredCityStats(city.id);

  // Programme totals need no store, so they render in the first paint.
  const programme = useMemo(() => getProgrammeStats(city), [city]);

  const statItems = useMemo<StatItem[]>(
    () => [
      { target: live?.reported ?? 0, duration: 1900 },
      { target: live?.verifiedRatePercent ?? 0, suffix: '%', duration: 1700 },
      { target: live?.repeatFailures ?? 0, duration: 1600 },
    ],
    [live?.reported, live?.verifiedRatePercent, live?.repeatFailures]
  );

  const { containerRef, displayValues } = useCinematicStats<HTMLDListElement>(statItems, {
    threshold: 0.25,
    duration: 1800,
    // The animation runs once. Arming it before the figures arrive
    // would count up to zero and leave it there.
    enabled: ready,
  });

  /* An em dash until the figures are real. Rendering 0 for "not loaded
     yet" would be the same class of mistake as rendering 94% for a rate
     nobody had computed. */
  const show = (index: number) => (ready ? displayValues[index] : '—');

  return (
    <section className="hero" id="hero" aria-label="Hero">
      {/* Background Image */}
      <div className="hero__bg">
        <img
          src={city.heroImage}
          alt=""
          className="hero__bg-image"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          aria-hidden="true"
        />
        <div className="hero__bg-overlay" />
      </div>

      {/* Content */}
      <div className="hero__content container">
        <div className="hero__text">
          {/* City Badge */}
          <div className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" />
            <svg className="icon icon--xs" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{city.name}, {city.state}</span>
          </div>

          {/* Headline */}
          <h1 className="hero__headline">
            <span className="hero__headline-line">{t('hero.line1')}</span>
            <span className="hero__headline-line">{t('hero.line2')}</span>
            <span className="hero__headline-line">
              {t('hero.line3')}{' '}
              <span className="hero__headline-accent">{t('app.name')}</span>.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="hero__description">
            {/* The city name is interpolated rather than concatenated so
                Hindi word order does not have to match English. */}
            {t('hero.description').replace('{city}', city.name)}
          </p>

          {/* CTAs */}
          <div className="hero__ctas">
            <PrimaryCTA
              label={t('hero.cta.report')}
              subtitle={t('hero.cta.report.sub')}
              href="/report"
              size="lg"
              fullWidth
              id="hero-report-cta"
              icon={
                <svg className="icon icon--sm" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              }
            />
            <SecondaryCTA
              label={t('hero.cta.track')}
              subtitle={t('hero.cta.track.sub')}
              href="/track"
              fullWidth
              id="hero-track-cta"
              icon={
                <svg className="icon icon--sm" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              }
            />
          </div>

          {/* Trust bar — live figures only */}
          <dl className="hero__trust" ref={containerRef}>
            <div className="hero__trust-item">
              <dt className="hero__trust-label">{t('hero.stat.reported')}</dt>
              <dd className="hero__trust-number">{show(0)}</dd>
            </div>
            <div className="hero__trust-divider" aria-hidden="true" />
            <div className="hero__trust-item">
              <dt className="hero__trust-label">{t('hero.stat.resolved')}</dt>
              <dd className="hero__trust-number hero__trust-number--success">
                {/* A city with nothing reported has no rate. Rendering a
                    dash is the honest answer; rendering 100% is not. */}
                {live?.verifiedRatePercent == null ? '—' : show(1)}
              </dd>
            </div>
            <div className="hero__trust-divider" aria-hidden="true" />
            <div className="hero__trust-item">
              <dt className="hero__trust-label">{t('hero.stat.initiatives')}</dt>
              <dd className="hero__trust-number">{show(2)}</dd>
            </div>
          </dl>

          <p className="hero__trust-note">
            {t('hero.trust.note')}{' '}
            <span className="hero__trust-note-aside">
              {city.name} programme totals ({programme.reported.toLocaleString('en-IN')} reported,{' '}
              {programme.resolutionRatePercent}% resolved) are illustrative municipal figures.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
