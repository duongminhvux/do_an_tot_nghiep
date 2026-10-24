"use client";
import type { SiteSettings } from "@repo/shared-types/site-settings";
import { SiteSettingsProvider } from "./site-settings-provider";
import React from "react";
import ReduxProvider from "@/redux/provider";
import QueryProvider from "./query-provider";
import I18nProvider from "./i18n-provider";
import ActivityTrackerProvider from "./activity-tracker-provider";
import { AuthProvider } from "./auth-provider";
import { ArenaSocketProvider } from "./arena-socket-provider";

export function AppProviders({
  children,
  siteSettings,
}: {
  children: React.ReactNode;
  siteSettings: SiteSettings;
}) {
  return (
    <ReduxProvider>
      <AuthProvider>
        <ArenaSocketProvider>
          <QueryProvider>
            <SiteSettingsProvider initialSettings={siteSettings}>
              <I18nProvider>
                <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
              </I18nProvider>
            </SiteSettingsProvider>
          </QueryProvider>
        </ArenaSocketProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}

export default AppProviders;
