import { cache } from "react";
import { normalizeSiteSettings } from "@repo/shared-types/site-settings";
export const getServerSiteSettings = cache(async () => {
  const base = process.env.MEDIA_JOBS_INTERNAL_URL
    ? `${process.env.MEDIA_JOBS_INTERNAL_URL.replace(/\/$/, "")}/api`
    : (
        process.env.API_INTERNAL_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:5000/api"
      ).replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/site-settings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return normalizeSiteSettings();
    const result = await response.json();
    return normalizeSiteSettings(result.data);
  } catch {
    return normalizeSiteSettings();
  }
});
