"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Clock3,
  FileAudio,
  GraduationCap,
  Settings,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
const nav = [
  { label: "Dashboard", href: "/app/dashboard", icon: BarChart3 },
  { label: "Courses", href: "/app/courses", icon: BookOpen },
  {
    label: "Lessons",
    href: "/app/courses",
    icon: GraduationCap,
  },
  {
    label: "TOEIC Practice",
    href: "/app/courses",
    icon: FileAudio,
  },
  { label: "History", href: "/app/history", icon: Clock3 },
  { label: "Profile", href: "/app/profile", icon: UserRound },
  { label: "Settings", href: "/app/settings", icon: Settings },
];
export function AppSidebar({
  mobile,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (label: string, href: string) => {
    if (label === "Dashboard") return pathname === href;
    if (label === "Courses")
      return (
        pathname === href ||
        (pathname.startsWith("/app/courses/") &&
          !pathname.includes("/lessons/"))
      );
    if (label === "Lessons") return pathname.includes("/lessons/");
    if (label === "TOEIC Practice")
      return pathname.includes("/exercises/toeic");
    return pathname.startsWith(href);
  };
  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-white",
        !mobile &&
          "fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 lg:flex",
      )}
    >
      <div className="flex h-20 items-center px-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = isActive(label, href);
          return (
            <Link
              onClick={onNavigate}
              key={label}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="size-4.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
