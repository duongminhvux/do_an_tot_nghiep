"use client";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/client";
export function AppTopbar({ onMenu }: { onMenu: () => void }) {
  const user = useSessionStore((state) => state.user);
  const clear = useSessionStore((state) => state.clear);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
      router.replace("/login");
    }
  };
  return (
    <header className="sticky top-0 z-20 flex h-20 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:ml-60 lg:px-8">
      <button
        onClick={onMenu}
        className="mr-3 grid size-10 place-items-center rounded-lg hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu />
      </button>
      <label className="relative hidden max-w-md flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <span className="sr-only">Search lessons, courses, or topics</span>
        <input
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white"
          placeholder="Search lessons, courses or topics..."
        />
      </label>
      <div className="ml-auto flex items-center gap-3">
        <button
          className="relative grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex min-h-11 items-center gap-3 rounded-xl px-1 hover:bg-slate-50"
            aria-expanded={open}
            aria-label="Open account menu"
          >
            <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-bold text-slate-800">
              {user?.fullName?.charAt(0) ?? "A"}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-bold">
                {user?.fullName?.split(" ")[0] ?? "Anna"}
              </div>
              <div className="text-xs text-slate-500">Student</div>
            </div>
            <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
          </button>
          {open && (
            <div className="surface top-13 absolute right-0 w-52 p-2 shadow-xl">
              <Link
                onClick={() => setOpen(false)}
                href="/app/profile"
                className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <UserRound className="size-4" />
                Profile
              </Link>
              <Link
                onClick={() => setOpen(false)}
                href="/app/settings"
                className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
