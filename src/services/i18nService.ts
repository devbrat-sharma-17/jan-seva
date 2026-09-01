// ============================================================
// i18n Service — locale state and lookup
// ============================================================
// Locale lives here rather than in React context so that non-component
// code (the classifier's category titles, service-layer copy) can read
// it too, and so a language change survives a reload.

import { STRINGS, type Locale } from '../i18n/strings';
import { readJSON, writeJSON, subscribeToKey } from './storage';

const LOCALE_KEY = 'jan_seva_locale_v1';

const listeners = new Set<() => void>();

/**
 * The active locale.
 *
 * Falls back to English rather than to the browser's language: a Hindi
 * browser locale does not mean the citizen wants a Hindi civic form, and
 * a surprise language switch on a government service is worse than a
 * default the user can change in one tap.
 */
export function getLocale(): Locale {
  const stored = readJSON<string>(LOCALE_KEY, 'en');
  return stored === 'hi' ? 'hi' : 'en';
}

export function setLocale(locale: Locale): void {
  try {
    writeJSON(LOCALE_KEY, locale);
  } catch {
    // A locale that cannot be persisted still applies to this session.
  }
  if (typeof document !== 'undefined') {
    // Screen readers and hyphenation need this. Devanagari rendering is
    // materially worse without a correct lang attribute.
    document.documentElement.lang = locale;
  }
  listeners.forEach((fn) => fn());
}

/**
 * Looks up a key in the active locale.
 *
 * A missing Hindi string falls through to English rather than rendering
 * blank — a partially translated screen is usable, an empty one is not.
 * A key missing from BOTH returns the key itself, so the gap is visible
 * in review rather than silent in production.
 */
export function t(key: string, locale: Locale = getLocale()): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}

/** Subscribes to locale changes, in this tab and across tabs. */
export function subscribeToLocale(onChange: () => void): () => void {
  listeners.add(onChange);
  const unsubscribeStore = subscribeToKey(LOCALE_KEY, onChange);

  return () => {
    listeners.delete(onChange);
    unsubscribeStore();
  };
}

/**
 * BCP-47 tag for speech recognition and Intl formatting.
 * `hi-IN` is what the browser's ASR expects for Hindi.
 */
export function speechLocaleTag(locale: Locale = getLocale()): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}
