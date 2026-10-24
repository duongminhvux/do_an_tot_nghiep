import apiClient from "@/lib/axios";
import type { SiteSettings } from "@repo/shared-types/site-settings";
export const siteSettingsService = {
  async read() {
    return (await apiClient.get<{ data: SiteSettings }>("/site-settings")).data
      .data;
  },
};
