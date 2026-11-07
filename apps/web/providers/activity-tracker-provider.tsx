'use client';

import React, { useEffect } from 'react';
import { ActiveTimeMeter } from '@/lib/active-time';
import { ACTIVE_TIME_PULSE_MS } from '@repo/shared-types/active-time';
import { learningActivityService } from '@/services/learning-activity.service';
import { useAppSelector } from '@/redux/hooks';
import { store } from '@/redux/store';

/**
 * Measures active learning time only (feeds streak/time statistics).
 * Page views, tab switches and session open/close are deliberately NOT logged:
 * the activity log keeps meaningful events (sign-in, vocabulary sessions,
 * dictation, TOEIC attempts, games, arena) which are recorded server-side.
 */
function InnerActivityTracker() {
  const userId = useAppSelector((state) => state.auth.user?._id);

  useEffect(() => {
    if (!userId) return;
    const foreground = () => document.visibilityState === 'visible' && document.hasFocus() && navigator.onLine;
    const meter = new ActiveTimeMeter(performance.now(), foreground());
    let inFlight = false;
    let lastPulse = performance.now();

    const flush = (keepalive = false, baseline = false) => {
      if (store.getState().auth.user?._id !== userId) return;
      if (inFlight && !keepalive) return;
      const activeMs = meter.take(performance.now());
      if (!baseline && !activeMs) return;
      const pulse = { requestId: crypto.randomUUID(), activeMs };
      if (!keepalive) inFlight = true;
      // Do not replay an offline backlog as if it were current online activity.
      void learningActivityService.reportActiveTime(pulse, keepalive)
        .catch(() => {})
        .finally(() => { if (!keepalive) inFlight = false; });
    };
    flush(false, true);

    const onInput = (event: Event) => {
      if (!event.isTrusted || !foreground()) return;
      meter.interact(performance.now());
    };
    const onForeground = () => {
      meter.setForeground(performance.now(), foreground());
      if (!foreground()) flush(true);
    };
    const onPageHide = () => {
      meter.setForeground(performance.now(), false);
      flush(true);
    };
    const onPageShow = () => onForeground();
    const inputs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove'];
    inputs.forEach((name) => window.addEventListener(name, onInput, { passive: true }));
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onForeground);
    window.addEventListener('offline', onForeground);
    window.addEventListener('blur', onForeground);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    const timer = setInterval(() => {
      meter.setForeground(performance.now(), foreground());
      if (performance.now() - lastPulse >= ACTIVE_TIME_PULSE_MS) {
        lastPulse = performance.now();
        flush();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      inputs.forEach((name) => window.removeEventListener(name, onInput));
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
      window.removeEventListener('offline', onForeground);
      window.removeEventListener('blur', onForeground);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      onPageHide();
    };
  }, [userId]);

  return null;
}

export function ActivityTrackerProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InnerActivityTracker />
      {children}
    </>
  );
}

export default ActivityTrackerProvider;
