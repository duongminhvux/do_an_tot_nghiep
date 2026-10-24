"use client";
import { useState, type ReactNode } from "react";
import { useSiteSettings } from "@/providers/site-settings-provider";
export function SiteLogo({
  compact = false,
  fallback,
}: {
  compact?: boolean;
  fallback: ReactNode;
}) {
  const settings = useSiteSettings();
  const [failedUrl, setFailedUrl] = useState("");
  const url = compact ? settings.iconUrl || settings.logoUrl : settings.logoUrl;
  return url && failedUrl !== url ? (
    <img
      src={url}
      onError={() => setFailedUrl(url)}
      alt={settings.siteName}
      className={
        compact ? "size-full object-contain" : "h-7 max-w-36 object-contain"
      }
    />
  ) : (
    <>{fallback}</>
  );
}
