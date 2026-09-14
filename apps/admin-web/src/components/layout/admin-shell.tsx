"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserRole } from "@listenup/domain";
import { adminAuthApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [ready, setReady] = useState(false);
  const user = useAdminSession((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        let current = useAdminSession.getState().user;
        if (!current) {
          try {
            const session = await adminAuthApi.refresh();
            if ("accessToken" in session && "user" in session) {
              useAdminSession
                .getState()
                .setSession(session.accessToken, session.user);
              current = session.user;
            }
          } catch {
            useAdminSession.getState().clear();
          }
        }
        if (!active) return;
        setReady(true);
        if (!current) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        } else if (current.role === UserRole.STUDENT) {
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
        <div className="h-18 border-b bg-white" />
        <div className="ml-60 p-6">
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="mt-5 h-80 rounded-xl bg-white" />
        </div>
      </div>
    );
  }
  return (
    <>
      <AdminSidebar />
      <AdminTopbar onMenu={() => setDrawer(true)} />
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(88vw,300px)]">
            <AdminSidebar mobile onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <main className="min-h-[calc(100vh-4.5rem)] p-4 lg:ml-60 lg:p-6">
        <div className="mx-auto max-w-[1560px]">{children}</div>
      </main>
    </>
  );
}
