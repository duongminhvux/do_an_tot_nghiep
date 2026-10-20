"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Shield,
  Swords,
  Gamepad2,
  LayoutDashboard,
  BookOpen,
  FileText,
  Layers,
  Users,
  LogOut,
  Globe,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  FolderTree,
  BarChart3,
  Trophy,
  DoorOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import LanguageSwitcher from "@/components/language-switcher";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logout } from "@/redux/features/auth/authSlice";
import { authService } from "@/services";
type NavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
};
type NavItem = Omit<NavLink, "href"> & { href?: string; children?: NavLink[] };
const menuClass =
  "h-9 gap-2.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 data-[active=true]:bg-blue-50 data-[active=true]:font-semibold data-[active=true]:text-blue-600 [&>svg]:size-4";
const subMenuClass =
  "h-8 gap-2 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600 data-[active=true]:bg-blue-50 data-[active=true]:font-semibold data-[active=true]:text-blue-600 [&>svg]:size-3.5 [&>svg]:shrink-0";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation("common");

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      dispatch(logout());
      router.replace(`/${locale}/login`);
    }
  };

  const active = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");
  const arenaBase = `/${locale}/arena`;
  const arenaIcons = [BarChart3, Trophy, Users, DoorOpen, Settings];
  const items: NavItem[] = [
    {
      label: t("nav.dashboard"),
      href: `/${locale}`,
      icon: LayoutDashboard,
      active: pathname === `/${locale}`,
    },
    {
      label: t("nav.games"),
      href: `/${locale}/games`,
      icon: Gamepad2,
      active: active(`/${locale}/games`),
      children: [
        {
          label: t("nav.gameManagement"),
          href: `/${locale}/games`,
          icon: Gamepad2,
          active: pathname === `/${locale}/games`,
        },
        {
          label: t("nav.gameScores"),
          href: `/${locale}/games/scores`,
          icon: Trophy,
          active: active(`/${locale}/games/scores`),
        },
        {
          label: t("nav.gameStatistics"),
          href: `/${locale}/games/statistics`,
          icon: BarChart3,
          active: active(`/${locale}/games/statistics`),
        },
      ],
    },
    {
      label: t("nav.arena"),
      icon: Swords,
      active: active(arenaBase),
      children: ["dashboard", "matches", "players", "rooms", "settings"].map(
        (key, index) => {
          const href = arenaBase + (key === "dashboard" ? "" : "/" + key);
          return {
            label: t("arena:" + key),
            href,
            icon: arenaIcons[index]!,
            active: key === "dashboard" ? pathname === href : active(href),
          };
        },
      ),
    },
    {
      label: t("nav.users"),
      href: `/${locale}/users`,
      icon: Users,
      active: active(`/${locale}/users`),
    },
    {
      label: t("nav.vocabulary"),
      icon: FileText,
      active: active(`/${locale}/vocabulary`),
      children: [
        {
          label: t("nav.curriculum"),
          href: `/${locale}/vocabulary/groups`,
          icon: Layers,
          active:
            active(`/${locale}/vocabulary/groups`) ||
            active(`/${locale}/vocabulary/collections`),
        },
        {
          label: t("nav.dictionary"),
          href: `/${locale}/vocabulary/words`,
          icon: BookOpen,
          active: active(`/${locale}/vocabulary/words`),
        },
      ],
    },
    {
      label: t("nav.dictation"),
      icon: Headphones,
      active: active(`/${locale}/dictation`),
      children: [
        {
          label: t("nav.dictation_lessons"),
          href: `/${locale}/dictation`,
          icon: BookOpen,
          active:
            active(`/${locale}/dictation`) &&
            !active(`/${locale}/dictation/structure`),
        },
        {
          label: t("nav.dictation_structure"),
          href: `/${locale}/dictation/structure`,
          icon: FolderTree,
          active: active(`/${locale}/dictation/structure`),
        },
      ],
    },
    {
      label: t("nav.assessment"),
      icon: ClipboardCheck,
      active: active(`/${locale}/assessment`),
      children: [
        {
          label: t("nav.exam_groups"),
          href: `/${locale}/assessment/groups`,
          icon: Layers,
          active: active(`/${locale}/assessment/groups`),
        },
        {
          label: t("nav.exams"),
          href: `/${locale}/assessment`,
          icon: FileText,
          active:
            active(`/${locale}/assessment`) &&
            !active(`/${locale}/assessment/groups`),
        },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      {/* Brand Header - perfectly aligned with menu items */}
      <SidebarHeader className="border-b border-slate-100 px-2 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 w-full">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
                {t("brand")}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {t("admin")}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {t("management_portal")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 group-data-[collapsible=icon]:hidden">
            {t("navigation")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) =>
                item.children ? (
                  <Collapsible
                    key={item.label}
                    asChild
                    defaultOpen={item.active}
                    className="group/nav"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={item.active}
                          className={menuClass}
                        >
                          <item.icon />
                          <span className="truncate group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                          <ChevronRight className="ml-auto size-4 text-slate-400 transition-transform duration-200 group-data-[state=open]/nav:rotate-90 group-data-[collapsible=icon]:hidden" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="mx-0 ml-4 mt-1 gap-1 border-l border-slate-200 px-0 pl-3 py-0">
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={child.active}
                                className={subMenuClass}
                              >
                                <Link
                                  href={child.href}
                                  aria-current={
                                    child.active ? "page" : undefined
                                  }
                                >
                                  <child.icon />
                                  <span className="truncate">
                                    {child.label}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={item.active}
                      className={menuClass}
                    >
                      <Link
                        href={item.href!}
                        aria-current={item.active ? "page" : undefined}
                      >
                        <item.icon />
                        <span className="truncate group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-slate-100 p-2.5 space-y-2.5 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:items-center">
        {/* Language Switcher */}
        <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:hidden">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            {t("language")}
          </span>
          <LanguageSwitcher />
        </div>

        <SidebarSeparator className="my-1 group-data-[collapsible=icon]:hidden" />

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:gap-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-sm">
              {(user?.username?.[0] || "A").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.username || "Administrator"}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.email || "admin@english.com"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 group-data-[collapsible=icon]:hidden"
            title={t("logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
