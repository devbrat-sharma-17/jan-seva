// ============================================================
// useTranslation — component access to the active locale
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '../i18n/strings';
import { getLocale, setLocale, subscribeToLocale, t as translate } from '../services/i18nService';

export interface UseTranslationResult {
  locale: Locale;
  t: (key: string) => string;
  changeLocale: (locale: Locale) => void;
}

export function useTranslation(): UseTranslationResult {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());

  useEffect(() => {
    // Re-read rather than trusting the event payload: another tab may
    // have set a locale this one has not seen.
    return subscribeToLocale(() => setLocaleState(getLocale()));
  }, []);

  const t = useCallback((key: string) => translate(key, locale), [locale]);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  }, []);

  return { locale, t, changeLocale };
}
