import { useMemo } from 'react';
import { useCityConfig } from '../../hooks/useCityConfig';
import { useCinematicStats, type StatItem } from '../../hooks/useCountUp';
import { PrimaryCTA } from '../ui/PrimaryCTA';
import { SecondaryCTA } from '../ui/SecondaryCTA';
import './Hero.css';

export function Hero() {
  const city = useCityConfig();

  const statItems = useMemo<StatItem[]>(
    () => [
      {
        target: city.statistics.issuesReported,
        suffix: '+',
        duration: 1900,
      },
      {
        target: city.statistics.resolutionRate,
        suffix: '%',
        duration: 1700,
      },
      {
        target: city.statistics.activeInitiatives,
        duration: 1600,
      },
    ],
    [city.statistics.issuesReported, city.statistics.resolutionRate, city.statistics.activeInitiatives]
  );

  const { containerRef, displayValues } = useCinematicStats<HTMLDListElement>(statItems, {
    threshold: 0.25,
    duration: 1800,
  });

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
            <span className="hero__headline-line">YOUR CITY.</span>
            <span className="hero__headline-line">YOUR VOICE.</span>
            <span className="hero__headline-line">
              OUR <span className="hero__headline-accent">JAN-SEVA</span>.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="hero__description">
            Report civic issues in {city.name} — potholes, garbage, water leaks,
            broken streetlights — and watch them get resolved.
          </p>

          {/* CTAs */}
          <div className="hero__ctas">
            <PrimaryCTA
              label="REPORT AN ISSUE"
              subtitle="Click a photo &amp; submit in 60 seconds"
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
              label="TRACK COMPLAINT"
              subtitle="Check your complaint status"
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

          {/* Trust bar */}
          <dl className="hero__trust" ref={containerRef}>
            <div className="hero__trust-item">
              <dt className="hero__trust-label">Issues Reported</dt>
              <dd className="hero__trust-number">
                {displayValues[0]}
              </dd>
            </div>
            <div className="hero__trust-divider" aria-hidden="true" />
            <div className="hero__trust-item">
              <dt className="hero__trust-label">Resolution Rate</dt>
              <dd className="hero__trust-number hero__trust-number--success">
                {displayValues[1]}
              </dd>
            </div>
            <div className="hero__trust-divider" aria-hidden="true" />
            <div className="hero__trust-item">
              <dt className="hero__trust-label">Active Initiatives</dt>
              <dd className="hero__trust-number">
                {displayValues[2]}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
