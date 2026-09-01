import { useEffect, useRef, useState } from 'react';
import { LOCALES, type Locale } from '../../i18n/strings';
import { useTranslation } from '../../hooks/useTranslation';
import './LanguageSelector.css';

/**
 * Language switcher.
 *
 * This was `useState('EN')` with no handler — a dead button on a product
 * built for a Hindi-speaking Tier-2 city, sitting in the header where a
 * citizen meets it first. It now switches the citizen-facing surfaces
 * (landing, report wizard, tracking) between English and Hindi, persists
 * the choice, and sets `documentElement.lang` so screen readers and
 * Devanagari shaping behave.
 *
 * The department and admin portals stay in English on purpose — that is
 * how municipal staff in MP actually work, and machine-translated
 * administrative vocabulary no officer would use is worse than none.
 */
export function LanguageSelector() {
  const { locale, t, changeLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  // Dismiss on outside click and on Escape. A menu that can only be
  // closed by choosing something is a trap on a touch device.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (next: Locale) => {
    changeLocale(next);
    setOpen(false);
  };

  return (
    <div className="language-selector-root" ref={rootRef}>
      <button
        className="language-selector"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.change')} — ${active.label}`}
      >
        <span className="language-selector__label">{active.id.toUpperCase()}</span>
        <svg
          className={`icon icon--xs language-selector__chevron${open ? ' is-open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="language-selector__menu" role="listbox" aria-label={t('lang.change')}>
          {LOCALES.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === locale}
                className={`language-selector__option${option.id === locale ? ' is-active' : ''}`}
                onClick={() => select(option.id)}
                /* The native name is shown in its own script: a citizen
                   looking for Hindi is looking for हिन्दी, not for the
                   English word "Hindi". */
                lang={option.id}
              >
                <span className="language-selector__option-native">{option.nativeLabel}</span>
                <span className="language-selector__option-code">{option.id.toUpperCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
