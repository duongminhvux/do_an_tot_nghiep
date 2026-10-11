"use client";
import React from "react";
import ReduxProvider from "@/redux/provider";
import QueryProvider from "./query-provider";
import I18nProvider from "./i18n-provider";
import ActivityTrackerProvider from "./activity-tracker-provider";
import { AuthProvider } from "./auth-provider";
import { ArenaSocketProvider } from "./arena-socket-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <AuthProvider>
        <ArenaSocketProvider>
          <QueryProvider>
            <I18nProvider>
              <ActivityTrackerProvider>{children}</ActivityTrackerProvider>
            </I18nProvider>
          </QueryProvider>
        </ArenaSocketProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}

export default AppProviders;
