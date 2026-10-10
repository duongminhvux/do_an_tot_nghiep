'use client';

import React from 'react';
import ReduxProvider from '@/redux/provider';
import QueryProvider from './query-provider';
import I18nProvider from './i18n-provider';
import ActivityTrackerProvider from './activity-tracker-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <QueryProvider>
        <I18nProvider>
          <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
        </I18nProvider>
      </QueryProvider>
    </ReduxProvider>
  );
}

export default AppProviders;
