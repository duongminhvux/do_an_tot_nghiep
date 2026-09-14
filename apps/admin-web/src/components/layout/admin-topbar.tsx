"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useAdminSession } from "@/stores/admin-session";
import { adminAuthApi } from "@/lib/api/client";
export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const [open, setOpen] = useState(false);
  const user = useAdminSession((s) => s.user);
  const clear = useAdminSession((s) => s.clear);
  const router = useRouter();
  const logout = async () => {
    try {
      await adminAuthApi.logout();
    } finally {
      clear();
      router.replace("/login");
    }
  };
  return (
    <header className="h-18 sticky top-0 z-20 flex items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:ml-60 lg:px-6">
      <button
        onClick={onMenu}
        className="mr-3 grid size-10 place-items-center rounded-lg hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu />
      </button>
      <label className="relative hidden max-w-xl flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <span className="sr-only">Global search</span>
        <input
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 outline-none focus:border-blue-500 focus:bg-white"
          placeholder="Search students, teachers, courses, lessons..."
        />
      </label>
      <div className="ml-auto flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-full border border-slate-200"
        >
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            4
          </span>
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-1 hover:bg-slate-50"
            aria-expanded={open}
            aria-label="Open account menu"
          >
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-bold">
              {user?.fullName.charAt(0)}
            </span>
            <span className="hidden text-left sm:block">
              <strong className="block text-sm">{user?.fullName}</strong>
              <span className="text-[11px] font-bold text-blue-600">
                {user?.role}
              </span>
            </span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
          {open && (
            <div className="admin-surface absolute right-0 top-12 w-52 p-2 shadow-xl">
              <Link
                href="/profile"
                className="flex min-h-10 items-center gap-2 rounded-lg px-3 hover:bg-slate-50"
              >
                <UserRound className="size-4" />
                Profile
              </Link>
              <Link
                href="/settings"
                className="flex min-h-10 items-center gap-2 rounded-lg px-3 hover:bg-slate-50"
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-red-600 hover:bg-red-50"
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
