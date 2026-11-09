import viImageCropper from '../locales/vi/image-cropper.json';
import enImageCropper from '../locales/en/image-cropper.json';
import viIam from '../locales/vi/iam.json';
import enIam from '../locales/en/iam.json';
import viSiteSettings from '../locales/vi/site-settings.json';
import enSiteSettings from '../locales/en/site-settings.json';
import viArena from '../locales/vi/arena.json';
import enArena from '../locales/en/arena.json';
import viGames from '../locales/vi/games.json';
import enGames from '../locales/en/games.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from '../locales/vi/common.json';
import viAuth from '../locales/vi/auth.json';
import viDashboard from '../locales/vi/dashboard.json';
import viVocabulary from '../locales/vi/vocabulary.json';
import viUsers from '../locales/vi/users.json';
import viAssessment from '../locales/vi/assessment.json';
import viActivityLog from '../locales/vi/activity-log.json';

import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enDashboard from '../locales/en/dashboard.json';
import enVocabulary from '../locales/en/vocabulary.json';
import enUsers from '../locales/en/users.json';
import enAssessment from '../locales/en/assessment.json';
import enActivityLog from '../locales/en/activity-log.json';

export const resources = {
  vi: {
    imageCropper: viImageCropper,
    iam: viIam,
    common: viCommon,
    games: viGames,
    arena: viArena,
    siteSettings: viSiteSettings,
    auth: viAuth,
    dashboard: viDashboard,
    vocabulary: viVocabulary,
    users: viUsers,
    assessment: viAssessment,
    activityLog: viActivityLog,
  },
  en: {
    imageCropper: enImageCropper,
    iam: enIam,
    common: enCommon,
    games: enGames,
    arena: enArena,
    siteSettings: enSiteSettings,
    auth: enAuth,
    dashboard: enDashboard,
    vocabulary: enVocabulary,
    users: enUsers,
    assessment: enAssessment,
    activityLog: enActivityLog,
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
