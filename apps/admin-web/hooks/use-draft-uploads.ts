'use client';

import { useEffect, useRef } from 'react';
import { uploadService } from '@/services/upload.service';
import { DraftUploads } from '@/lib/draft-uploads';

// Only assets uploaded by this form belong to the draft. Pasted URLs are never deleted.
export function useDraftUploads(urls: Array<string | undefined>, active = true) {
  const trackerRef = useRef<DraftUploads | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = new DraftUploads((url, keepalive) =>
      uploadService.deleteFile(url, undefined, keepalive));
  }
  const tracker = trackerRef.current;

  useEffect(() => {
    if (!active) {
      tracker.unmount();
      return;
    }
    tracker.mount();
    const onPageHide = () => tracker.cleanup(true);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      tracker.unmount();
    };
  }, [tracker, active]);

  useEffect(() => { tracker.setUrls(urls); }, [tracker, urls]);

  return {
    track: (url: string) => tracker.track(url),
    commit: (savedUrls: Array<string | undefined>) => tracker.commit(savedUrls),
    startSaving: () => tracker.startSaving(),
    finishSaving: () => tracker.finishSaving(),
  };
}
