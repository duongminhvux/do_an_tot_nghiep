"use client";
import { useState, type ReactNode } from "react";
import { useSiteSettings } from "@/providers/site-settings-provider";
import { cn } from "@/lib/utils";
export function SiteLogo({
  compact = false,
  fallback,
  className,
}: {
  compact?: boolean;
  fallback: ReactNode;
  /** Overrides the image size, e.g. a taller wordmark in the sidebar. */
  className?: string;
}) {
  const settings = useSiteSettings();
  const [failedUrl, setFailedUrl] = useState("");
  const url = compact ? settings.iconUrl || settings.logoUrl : settings.logoUrl;
  return url && failedUrl !== url ? (
    <img
      src={url}
      onError={() => setFailedUrl(url)}
      alt={settings.siteName}
      className={cn(
        compact ? "size-full object-contain" : "h-7 max-w-36 object-contain",
        className,
      )}
    />
  ) : (
    <>{fallback}</>
  );
}
