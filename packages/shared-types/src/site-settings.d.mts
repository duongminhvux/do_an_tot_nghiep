export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  iconUrl: string;
  faviconUrl: string;
  timezone: string;
}
export declare const DEFAULT_SITE_SETTINGS: Readonly<SiteSettings>;
export declare function normalizeSiteSettings(input?: unknown): SiteSettings;
