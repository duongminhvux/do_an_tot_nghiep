import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from '../locales/vi/common.json';
import viAuth from '../locales/vi/auth.json';
import viDashboard from '../locales/vi/dashboard.json';
import viVocabulary from '../locales/vi/vocabulary.json';

import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enDashboard from '../locales/en/dashboard.json';
import enVocabulary from '../locales/en/vocabulary.json';

const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
    dashboard: viDashboard,
    vocabulary: viVocabulary,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    vocabulary: enVocabulary,
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
} else {
  // Ensure resources are refreshed on client-side hot-reloads
  Object.entries(resources).forEach(([lng, namespaces]) => {
    Object.entries(namespaces).forEach(([ns, res]) => {
      i18n.addResourceBundle(lng, ns, res, true, true);
    });
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
