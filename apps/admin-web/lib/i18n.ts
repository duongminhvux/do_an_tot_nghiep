import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from '../locales/vi/common.json';
import viAuth from '../locales/vi/auth.json';
import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';

const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
  },
  en: {
    common: enCommon,
    auth: enAuth,
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
