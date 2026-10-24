"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettings,
} from "@repo/shared-types/site-settings";
import { siteSettingsService } from "@/services/site-settings.service";
const SiteSettingsContext = createContext<SiteSettings>({
  ...DEFAULT_SITE_SETTINGS,
});
export function SiteSettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: SiteSettings;
  children: ReactNode;
}) {
  const query = useQuery({
    queryKey: ["site-settings"],
    queryFn: siteSettingsService.read,
    initialData: initialSettings,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const settings = normalizeSiteSettings(query.data);
  const previousName = useRef(initialSettings.siteName);
  useEffect(() => {
    if (previousName.current !== settings.siteName) {
      document.title = document.title.replace(
        previousName.current,
        settings.siteName,
      );
      previousName.current = settings.siteName;
    }
  }, [settings.siteName]);
  useEffect(() => {
    const url = settings.faviconUrl || "/favicon.ico";
    const icons = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"]',
    );
    if (icons.length)
      icons.forEach((icon) => {
        icon.href = url;
      });
    else {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.href = url;
      document.head.append(icon);
    }
  }, [settings.faviconUrl]);
  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}
export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
