"use client";
import { canVisit } from "@/lib/admin-permissions";
import { SiteLogo } from "@/components/site-logo";
import { useSiteSettings } from "@/providers/site-settings-provider";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Shield,
  ShieldCheck,
  UserCog,
  KeyRound,
  Swords,
  Gamepad2,
  LayoutDashboard,
  BookOpen,
  FileText,
  Layers,
  Users,
  ChevronRight,
  ClipboardCheck,
  Headphones,
  FolderTree,
  BarChart3,
  Trophy,
  DoorOpen,
  Settings,
  Images,
  LayoutTemplate,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  useSidebar,
  SidebarContent,
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
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAppSelector } from "@/redux/hooks";
import { cn } from "@/lib/utils";
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
  const siteSettings = useSiteSettings();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation("common");

  const active = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");
  const arenaBase = `/${locale}/arena`;
  const arenaIcons = [BarChart3, Trophy, Users, DoorOpen, Settings];
  const items: NavItem[] = [
    // Daily work first (people, then content in the learner sidebar order),
    // then analytics, then system tools.
    {
      label: t("nav.dashboard"),
      href: `/${locale}`,
      icon: LayoutDashboard,
      active: pathname === `/${locale}`,
    },
    {
      label: t("nav.users"),
      href: `/${locale}/users`,
      icon: Users,
      active: active(`/${locale}/users`),
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
    {
      label: t("nav.vocabulary"),
      icon: FileText,
      active: active(`/${locale}/vocabulary`),
      children: [
        {
          label: t("nav.curriculum"),
          href: `/${locale}/vocabulary/groups`,
          icon: Layers,
          active: active(`/${locale}/vocabulary/groups`),
        },
        {
          label: t("nav.collections"),
          href: `/${locale}/vocabulary/collections`,
          icon: FolderTree,
          active: active(`/${locale}/vocabulary/collections`),
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
      label: t("recommendations.learningManagement"),
      icon: BookOpen,
      active: active(`/${locale}/learning`),
      children: [
        {
          label: t("mistakes.adminTitle"),
          href: `/${locale}/learning/mistakes`,
          icon: ClipboardCheck,
          active: active(`/${locale}/learning/mistakes`),
        },
        {
          label: t("recommendations.title"),
          href: `/${locale}/learning/recommendations`,
          icon: Settings,
          active: active(`/${locale}/learning/recommendations`),
        },
      ],
    },
    {
      label: t("contentQuality.content"),
      icon: ClipboardCheck,
      active: active(`/${locale}/content`),
      children: [
        {
          label: t("contentQuality.title"),
          href: `/${locale}/content/quality`,
          icon: ClipboardCheck,
          active: active(`/${locale}/content/quality`),
        },
      ],
    },
    {
      label: locale === "en" ? "Media library" : "Quản lý media",
      href: `/${locale}/media`,
      icon: Images,
      active: active(`/${locale}/media`),
    },
    {
      label: "Workers & Queue",
      href: `/${locale}/infrastructure`,
      icon: Settings,
      active: active(`/${locale}/infrastructure`),
    },
    {
      label: t("nav.systemSettings"),
      icon: Settings,
      active: active(`/${locale}/settings`),
      children: [
        {
          label: t("siteSettings:landing.navGeneral"),
          href: `/${locale}/settings`,
          icon: SlidersHorizontal,
          active: pathname === `/${locale}/settings`,
        },
        {
          label: t("siteSettings:landing.nav"),
          href: `/${locale}/settings/landing`,
          icon: LayoutTemplate,
          active: active(`/${locale}/settings/landing`),
        },
      ],
    },
  ];

  items.push({
    label: t("iam:group"),
    icon: ShieldCheck,
    active: active(`/${locale}/iam`),
    children: [
      {
        label: t("iam:admins"),
        href: `/${locale}/iam/admins`,
        icon: UserCog,
        active: active(`/${locale}/iam/admins`),
      },
      {
        label: t("iam:roles"),
        href: `/${locale}/iam/roles`,
        icon: KeyRound,
        active: active(`/${locale}/iam/roles`),
      },
    ],
  });
  const visibleItems = items
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) =>
              canVisit(user, child.href.replace(`/${locale}`, "") || "/"),
            ),
          }
        : item,
    )
    .filter((item) =>
      item.children
        ? item.children.length > 0
        : !!item.href &&
          canVisit(user, item.href.replace(`/${locale}`, "") || "/"),
    );
  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      {/* Brand: the uploaded wordmark already contains the icon, so it is shown
          alone when expanded and the square icon alone when collapsed. The
          icon square sits on the same 8px inset as the menu buttons. */}
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-slate-100 px-2">
        <Link
          href={`/${locale}`}
          aria-label={siteSettings.siteName}
          className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          {siteSettings.logoUrl ? (
            <>
              <span className="hidden size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg group-data-[collapsible=icon]:flex">
                <SiteLogo compact fallback={<Shield className="size-4" />} />
              </span>
              <span className="flex min-w-0 group-data-[collapsible=icon]:hidden">
                <SiteLogo
                  fallback={
                    <span className="truncate text-sm font-bold tracking-tight text-slate-900">
                      {siteSettings.siteName}
                    </span>
                  }
                  className="h-10 w-auto max-w-40 object-contain object-left"
                />
              </span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg",
                  !siteSettings.iconUrl && "bg-blue-600 text-white",
                )}
              >
                <SiteLogo compact fallback={<Shield className="size-4" />} />
              </span>
              <span className="min-w-0 truncate text-sm font-bold tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
                {siteSettings.siteName}
              </span>
            </>
          )}
          <span className="ml-auto shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 group-data-[collapsible=icon]:hidden">
            {t("admin")}
          </span>
        </Link>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 group-data-[collapsible=icon]:hidden">
            {t("navigation")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleItems.map((item) =>
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

      <SidebarRail />
    </Sidebar>
  );
}
