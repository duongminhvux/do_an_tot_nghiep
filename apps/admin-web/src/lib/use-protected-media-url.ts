"use client";

import { useEffect, useState } from "react";
import { resolveAdminMediaSource } from "./api/client";

export function useProtectedMediaUrl(source?: string): {
  url?: string;
  loading: boolean;
  error: string;
} {
  const [url, setUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let ownedUrl: string | undefined;
    setUrl(undefined);
    setError("");
    setLoading(Boolean(source));

    void resolveAdminMediaSource(source)
      .then((resolved) => {
        if (!resolved) {
          if (active) setLoading(false);
          return;
        }
        if (resolved.revoke) ownedUrl = resolved.url;
        if (!active) {
          if (ownedUrl) URL.revokeObjectURL(ownedUrl);
          return;
        }
        setUrl(resolved.url);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load media.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [source]);

  return { url, loading, error };
}
