import apiClient from "@/lib/axios";
import type { SiteSettings, TimezoneOption } from "@repo/shared-types/site-settings";
import type { LandingPageSettings } from "@repo/shared-types/landing-page";
export const siteSettingsService = {
  async timezones(lang: string) {
    return (await apiClient.get<{ data: TimezoneOption[] }>(
      "/admin/site-settings/timezones", { params: { lang } },
    )).data.data;
  },
  async adminRead() {
    return (await apiClient.get<{ data: SiteSettings }>("/admin/site-settings"))
      .data.data;
  },
  async save(settings: SiteSettings) {
    return (
      await apiClient.put<{ data: SiteSettings }>(
        "/admin/site-settings",
        settings,
      )
    ).data.data;
  },
  async read() {
    return (await apiClient.get<{ data: SiteSettings }>("/site-settings")).data
      .data;
  },
  async readLanding() {
    return (
      await apiClient.get<{ data: LandingPageSettings }>("/admin/site-settings/landing")
    ).data.data;
  },
  async saveLanding(settings: LandingPageSettings) {
    return (
      await apiClient.put<{ data: LandingPageSettings }>(
        "/admin/site-settings/landing",
        settings,
      )
    ).data.data;
  },
};
