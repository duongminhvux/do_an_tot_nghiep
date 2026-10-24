"use client";
import type { SiteSettings } from "@repo/shared-types/site-settings";
import { SiteSettingsProvider } from "./site-settings-provider";

import React from "react";
import ReduxProvider from "@/redux/provider";
import QueryProvider from "./query-provider";
import I18nProvider from "./i18n-provider";

export function AppProviders({
  children,
  siteSettings,
}: {
  children: React.ReactNode;
  siteSettings: SiteSettings;
}) {
  return (
    <ReduxProvider>
      <QueryProvider>
        <SiteSettingsProvider initialSettings={siteSettings}>
          <I18nProvider>{children}</I18nProvider>
        </SiteSettingsProvider>
      </QueryProvider>
    </ReduxProvider>
  );
}

export default AppProviders;
