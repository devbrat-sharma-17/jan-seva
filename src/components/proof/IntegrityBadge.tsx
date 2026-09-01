import type { ReactNode } from 'react';
import type { CaptureIntegrity, CaptureIntegrityGrade } from '../../types/proof';
import { GRADE_COPY } from '../../services/proofService';
import './proof.css';

interface IntegrityBadgeProps {
  grade: CaptureIntegrityGrade;
  size?: 'sm' | 'md';
  /** Show the one-line explanation under the label. */
  withBlurb?: boolean;
}

const ICONS: Record<CaptureIntegrityGrade, ReactNode> = {
  verified: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  unverified: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  disputed: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </>
  ),
};

/**
 * The verdict on a resolution photo, rendered wherever that photo is.
 *
 * This is the single most important piece of UI in the release: it is
 * the visible difference between a platform that accepts a department's
 * photo and one that checks it.
 */
export function IntegrityBadge({ grade, size = 'md', withBlurb = false }: IntegrityBadgeProps) {
  const copy = GRADE_COPY[grade];

  return (
    <div className={`integrity-badge integrity-badge--${grade} integrity-badge--${size}`}>
      <span className="integrity-badge__row">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[grade]}
        </svg>
        <span className="integrity-badge__label">
          {size === 'sm' ? copy.short : copy.label}
        </span>
      </span>
      {withBlurb && <span className="integrity-badge__blurb">{copy.blurb}</span>}
    </div>
  );
}

interface IntegrityChecklistProps {
  integrity: CaptureIntegrity;
}

/**
 * The five checks, itemised.
 *
 * An unavailable check renders as unavailable rather than as a pass.
 * Showing "could not be checked" is the difference between a claim a
 * judge can trust and one they cannot: a system that never admits a gap
 * is a system that is hiding one.
 */
export function IntegrityChecklist({ integrity }: IntegrityChecklistProps) {
  return (
    <div className="integrity-checklist">
      <div className="integrity-checklist__head">
        <IntegrityBadge grade={integrity.grade} />
        <p className="integrity-checklist__summary">{integrity.summary}</p>
      </div>

      <ul className="integrity-checklist__list">
        {integrity.checks.map((check) => {
          const state = check.passed === null ? 'unknown' : check.passed ? 'pass' : 'fail';
          return (
            <li key={check.id} className={`integrity-check integrity-check--${state}`}>
              <span className="integrity-check__mark" aria-hidden="true">
                {check.passed === null ? '–' : check.passed ? '✓' : '✕'}
              </span>
              <span className="integrity-check__body">
                <span className="integrity-check__label">
                  {check.label}
                  {check.passed === null && (
                    <span className="integrity-check__tag">not checked</span>
                  )}
                  {check.passed === false && check.severity === 'blocking' && (
                    <span className="integrity-check__tag integrity-check__tag--block">blocking</span>
                  )}
                </span>
                <span className="integrity-check__detail">{check.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="integrity-checklist__caveat">
        These checks run on the device. They are a usability filter, not a security control —
        they defeat a reused photo, a photographed screen or a closure filed from the depot,
        not a determined technical attacker. Server-issued capture nonces, server-side hashing
        and RFC 3161 timestamping are the production version.
      </p>
    </div>
  );
}
