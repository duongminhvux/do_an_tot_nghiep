"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { canAccessStudentApp } from "@/domain/permissions";
import { authApi } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session-store";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [ready, setReady] = useState(false);
  const user = useSessionStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        let current = useSessionStore.getState().user;
        if (!current) {
          try {
            const session = await authApi.refreshSession();
            if ("accessToken" in session && "user" in session) {
              useSessionStore
                .getState()
                .setSession(session.accessToken, session.user);
              current = session.user;
            }
          } catch {
            useSessionStore.getState().clear();
          }
        }
        if (!active) return;
        setReady(true);
        if (!current) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else if (!canAccessStudentApp(current)) {
          router.replace("/403");
        }
      })();
    }, 50);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pathname, router]);
  if (!ready || !user) {
    return (
      <div className="min-h-screen animate-pulse bg-slate-50">
        <div className="h-20 border-b bg-white" />
        <div className="mx-auto mt-8 max-w-5xl space-y-4 px-5">
          <div className="h-10 w-1/3 rounded bg-slate-200" />
          <div className="h-56 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }
  return (
    <>
      <AppSidebar />
      <AppTopbar onMenu={() => setDrawer(true)} />
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(88vw,300px)] bg-white shadow-xl">
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 z-10 grid size-10 place-items-center rounded-lg"
              aria-label="Close navigation"
            >
              <X />
            </button>
            <AppSidebar mobile onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <main className="min-h-[calc(100vh-5rem)] px-4 py-6 lg:ml-60 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </>
  );
}
