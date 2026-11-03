import { cache } from "react";
import { normalizeLandingPageSettings } from "@repo/shared-types/landing-page";
import { siteSettingsApiBase } from "@/lib/site-settings-server";
/** Landing images rendered on the server so the first paint already uses the admin's choices. */
export const getServerLandingPageSettings = cache(async () => {
  try {
    const response = await fetch(`${siteSettingsApiBase()}/site-settings/landing`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return normalizeLandingPageSettings();
    const result = await response.json();
    return normalizeLandingPageSettings(result.data);
  } catch {
    return normalizeLandingPageSettings();
  }
});
