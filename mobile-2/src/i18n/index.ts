import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  TranslationKey,
  TRANSLATIONS,
  LanguageOption,
} from './translations';

export { SUPPORTED_LANGUAGES, TRANSLATIONS };
export type { SupportedLanguage, TranslationKey, LanguageOption };

const LANGUAGE_STORAGE_KEY = 'palmsight.language';

let currentLanguage: SupportedLanguage = 'vi';
let initialized = false;
const listeners = new Set<(lang: SupportedLanguage) => void>();

export function isValidLanguage(code: string | null | undefined): code is SupportedLanguage {
  if (!code) return false;
  return SUPPORTED_LANGUAGES.some((item) => item.code === code);
}

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export async function loadSavedLanguage(): Promise<SupportedLanguage> {
  if (initialized) return currentLanguage;
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isValidLanguage(saved)) {
      currentLanguage = saved;
    }
  } catch {
    // Fallback to default language if AsyncStorage is unavailable
  }
  initialized = true;
  for (const listener of listeners) {
    listener(currentLanguage);
  }
  return currentLanguage;
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  if (!isValidLanguage(lang)) return;
  currentLanguage = lang;
  initialized = true;
  for (const listener of listeners) {
    listener(currentLanguage);
  }
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage error in non-persistent environments
  }
}

export function subscribeLanguage(
  listener: (lang: SupportedLanguage) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Synchronous translation lookup with `{param}` interpolation (Playbook §9).
 */
export function t(
  key: TranslationKey | string,
  params?: Record<string, string | number>,
  langOverride?: SupportedLanguage,
): string {
  const lang = langOverride ?? currentLanguage;
  const dict = (TRANSLATIONS[lang] ?? TRANSLATIONS.en) as Record<string, string>;
  const template = dict[key] ?? (TRANSLATIONS.en as Record<string, string>)[key] ?? key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const val = params[token];
    return val !== undefined && val !== null ? String(val) : `{${token}}`;
  });
}

export function useI18n() {
  const [language, setLangState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    void loadSavedLanguage();
    return subscribeLanguage((nextLang) => {
      setLangState(nextLang);
    });
  }, []);

  const translate = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>) =>
      t(key, params, language),
    [language],
  );

  const changeLanguage = useCallback(async (nextLang: SupportedLanguage) => {
    await setLanguage(nextLang);
  }, []);

  return {
    language,
    setLanguage: changeLanguage,
    t: translate,
    languages: SUPPORTED_LANGUAGES,
  };
}
