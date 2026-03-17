'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { SupportedLocale } from '@vizo/shared';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@vizo/shared';
import { translations, type TranslationKeys } from './translations';

// ─── GeoIP → locale mapping ──────────────────────────────

const COUNTRY_LOCALE_MAP: Record<string, SupportedLocale> = {
  PL: 'pl',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  FR: 'fr',
  BE: 'fr',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  IT: 'it',
  PT: 'pt',
  BR: 'pt',
  NL: 'nl',
  JP: 'ja',
  KR: 'ko',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
};

async function detectLocaleFromGeoIP(): Promise<SupportedLocale> {
  try {
    const response = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return DEFAULT_LOCALE;
    const data = await response.json() as { country_code?: string };
    const country = data.country_code?.toUpperCase();
    if (country && COUNTRY_LOCALE_MAP[country]) {
      return COUNTRY_LOCALE_MAP[country];
    }
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// ─── Context ──────────────────────────────────────────────

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: keyof TranslationKeys) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// ─── Provider ─────────────────────────────────────────────

interface I18nProviderProps {
  children: ReactNode;
  tenantLocale?: SupportedLocale | null;
  autoDetect?: boolean;
}

export function I18nProvider({ children, tenantLocale, autoDetect = true }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    tenantLocale || DEFAULT_LOCALE,
  );

  useEffect(() => {
    // If tenant has set an explicit locale, use that
    if (tenantLocale) {
      setLocaleState(tenantLocale);
      return;
    }

    // If auto-detect is enabled, use GeoIP
    if (autoDetect) {
      detectLocaleFromGeoIP().then((detected) => {
        setLocaleState(detected);
      });
    }
  }, [tenantLocale, autoDetect]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    if (SUPPORTED_LOCALES.includes(newLocale)) {
      setLocaleState(newLocale);
    }
  }, []);

  const t = useCallback(
    (key: keyof TranslationKeys): string => {
      const localeTranslations = translations[locale];
      if (localeTranslations && localeTranslations[key]) {
        return localeTranslations[key];
      }
      // Fallback to English
      return translations.en[key] || key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
