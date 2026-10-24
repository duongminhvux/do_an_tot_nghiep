import apiClient from "@/lib/axios";
import type { SiteSettings } from "@repo/shared-types/site-settings";
export const siteSettingsService = {
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
};
