import apiClient from "@/lib/axios";
import type { LandingPageSettings } from "@repo/shared-types/landing-page";
export const landingPageService = {
  async read() {
    return (
      await apiClient.get<{ data: LandingPageSettings }>("/site-settings/landing")
    ).data.data;
  },
};
