'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { ActiveTimeMeter } from '@/lib/active-time';
import { ACTIVE_TIME_PULSE_MS } from '@repo/shared-types/active-time';
import { learningActivityService } from '@/services/learning-activity.service';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/redux/hooks';
import { store } from '@/redux/store';
import { activityLogService } from '@/services/activity-log.service';

function InnerActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);

  const lastLoggedPathRef = useRef<string>('');
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return;
    const foreground = () => document.visibilityState === 'visible' && document.hasFocus() && navigator.onLine;
    const meter = new ActiveTimeMeter(performance.now(), foreground());
    let inFlight = false;
    let sessionEnded = false;
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
    activityLogService.logSessionStart({ referrer: document.referrer });
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
      if (!sessionEnded) {
        sessionEnded = true;
        activityLogService.logSessionEnd(Math.floor(meter.totalMs), { lastPath: window.location.pathname });
      }
    };
    const onPageShow = () => { sessionEnded = false; onForeground(); };
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

  // 4. Page View Tracker on Pathname / SearchParams change
  useEffect(() => {
    if (!pathname) return;

    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

    if (lastLoggedPathRef.current === fullPath) return;
    lastLoggedPathRef.current = fullPath;

    const timer = setTimeout(() => {
      const pageTitle = typeof document !== 'undefined' ? document.title : '';
      activityLogService.logPageView(fullPath, pageTitle, {
        userId: user?._id,
        userEmail: user?.email,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, user]);

  return null;
}

export function ActivityTrackerProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <InnerActivityTracker />
      </Suspense>
      {children}
    </>
  );
}

export default ActivityTrackerProvider;
