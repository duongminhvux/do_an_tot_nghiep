'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/redux/hooks';
import { activityLogService } from '@/services/activity-log.service';

function InnerActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);

  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastLoggedPathRef = useRef<string>('');
  const isSessionStartedRef = useRef<boolean>(false);

  // 1. Session Start on Mount
  useEffect(() => {
    sessionStartTimeRef.current = Date.now();

    if (!isSessionStartedRef.current) {
      isSessionStartedRef.current = true;
      activityLogService.logSessionStart({
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
      });
    }

    // 2. Session End on Unload / Page Hide via Beacon
    const handlePageHide = () => {
      const durationMs = Date.now() - sessionStartTimeRef.current;
      activityLogService.logSessionEnd(durationMs, {
        lastPath: typeof window !== 'undefined' ? window.location.pathname : '',
      });
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    // 3. Periodic Heartbeat every 5 minutes if tab is active
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        activityLogService.logHeartbeat({
          activePath: typeof window !== 'undefined' ? window.location.pathname : '',
          uptimeMs: Date.now() - sessionStartTimeRef.current,
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      clearInterval(heartbeatInterval);
    };
  }, []);

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
