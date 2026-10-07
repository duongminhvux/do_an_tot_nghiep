import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from '../locales/vi/common.json';
import viAuth from '../locales/vi/auth.json';
import viVocabulary from '../locales/vi/vocabulary.json';
import viProgress from '../locales/vi/progress.json';
import viToeic from '../locales/vi/toeic.json';
import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enVocabulary from '../locales/en/vocabulary.json';
import enProgress from '../locales/en/progress.json';
import enToeic from '../locales/en/toeic.json';

const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
    vocabulary: viVocabulary,
    progress: viProgress,
    toeic: viToeic,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    vocabulary: enVocabulary,
    progress: enProgress,
    toeic: enToeic,
  },
};

const getSavedLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('i18nextLng');
    if (saved === 'en' || saved === 'vi') return saved;
  }
  return 'vi';
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getSavedLanguage(),
    fallbackLng: 'vi',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export const changeLanguage = (lng: 'vi' | 'en') => {
  i18n.changeLanguage(lng);
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nextLng', lng);
    document.documentElement.lang = lng;
  }
};

export default i18n;
