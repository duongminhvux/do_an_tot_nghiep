'use client';
import { SiteLogo } from "@/components/site-logo";
import { useSiteSettings } from "@/providers/site-settings-provider";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  LayoutDashboard,
  Headphones,
  LogOut,
  Search,
  Bookmark,
  ChevronDown,
  TrendingUp,
  GraduationCap,
  FileText,
  History,
  BarChart3,
  Swords,
  Gamepad2,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  useSidebar,
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
} from '@/components/ui/sidebar';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';
import { cn } from '@/lib/utils';

/** A leaf link; `active` is computed from the pathname by the caller. */
interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}

/** A collapsible section whose children are leaf links. */
interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
}

// One visual language for every row: neutral by default, a blue tint when
// active. Collapsed (icon) mode keeps a 32px square target with a tooltip.
const rowClass =
  'h-9 gap-2.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/60 [&>svg]:size-[18px] [&>svg]:text-slate-400 hover:[&>svg]:text-slate-600 data-[active=true]:bg-blue-50 data-[active=true]:font-semibold data-[active=true]:text-blue-700 data-[active=true]:[&>svg]:text-blue-600';

function NavLinkRow({ item }: { item: NavLink }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={item.active} tooltip={item.label} className={rowClass}>
        <Link href={item.href} aria-current={item.active ? 'page' : undefined}>
          <Icon aria-hidden />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavSectionRow({
  section,
  open,
  onToggle,
}: {
  section: NavSection;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const { state, setOpen, isMobile } = useSidebar();
  const Icon = section.icon;
  const sectionActive = section.items.some((item) => item.active);
  const collapsed = state === 'collapsed' && !isMobile;
  const submenuId = `sidebar-section-${section.id}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip={section.label}
        aria-expanded={collapsed ? false : open}
        aria-controls={submenuId}
        // In icon mode the submenu is hidden, so a click expands the sidebar
        // and reveals this section instead of toggling something invisible.
        isActive={collapsed && sectionActive}
        onClick={() => {
          if (collapsed) {
            setOpen(true);
            onToggle(true);
          } else onToggle(!open);
        }}
        className={cn(
          rowClass,
          'cursor-pointer',
          sectionActive && 'text-slate-900 [&>svg]:text-blue-600',
        )}
      >
        <Icon aria-hidden />
        <span className="flex-1 truncate">{section.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            '!size-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[collapsible=icon]:hidden motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </SidebarMenuButton>

      {open && (
        <SidebarMenuSub
          id={submenuId}
          className="ml-[19px] mr-0 mt-1 mb-1.5 gap-0.5 border-slate-200 pl-2.5 pr-0"
        >
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={item.active}
                  className={cn(
                    'relative h-8 gap-2 rounded-md px-2 text-[13px] font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/60 [&>svg]:size-4 [&>svg]:text-slate-400',
                    'data-[active=true]:bg-blue-50 data-[active=true]:font-semibold data-[active=true]:text-blue-700 data-[active=true]:[&>svg]:text-blue-600',
                    // Marker on the guide line for the current page.
                    'data-[active=true]:before:absolute data-[active=true]:before:-left-[11px] data-[active=true]:before:inset-y-1.5 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-blue-600',
                  )}
                >
                  <Link href={item.href} aria-current={item.active ? 'page' : undefined}>
                    <ItemIcon aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const siteSettings = useSiteSettings();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => { setOpenMobile(false); }, [pathname, setOpenMobile]);
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation('common');

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

  const isHomeActive = pathname === `/${locale}`;
  const isVocabExploreActive =
    pathname === `/${locale}/vocabulary` || pathname === `/${locale}/vocabulary/`;
  const isVocabMyWordsActive = !!pathname?.startsWith(`/${locale}/vocabulary/my-words`);
  const isPracticeActive =
    pathname === `/${locale}/dictation` ||
    (pathname?.startsWith(`/${locale}/dictation/`) && !pathname?.startsWith(`/${locale}/dictation/progress`));
  const isProgressActive = pathname?.startsWith(`/${locale}/dictation/progress`);
  const isArenaActive = pathname === `/${locale}/arena` || pathname?.startsWith(`/${locale}/arena/`);
  const isGamesListActive = pathname === `/${locale}/games` || pathname?.startsWith(`/${locale}/games/`);

  const isToeicExamsActive =
    pathname === `/${locale}/toeic` ||
    pathname === `/${locale}/toeic/exams` ||
    pathname?.startsWith(`/${locale}/toeic/exams/`);
  const isToeicHistoryActive =
    pathname?.startsWith(`/${locale}/toeic/history`) ||
    (pathname?.startsWith(`/${locale}/toeic/attempts/`) && pathname.endsWith('/result'));
  const isToeicStatsActive =
    pathname?.startsWith(`/${locale}/toeic/stats`) ||
    pathname?.startsWith(`/${locale}/toeic/analytics`);

  const isMistakesActive = pathname?.startsWith(`/${locale}/learning/mistakes`);

  const home: NavLink = {
    label: t('nav.home', 'Trang chủ'),
    href: `/${locale}`,
    icon: LayoutDashboard,
    active: isHomeActive,
  };
  const learnSections: NavSection[] = [
    {
      id: 'toeic',
      label: t('nav.toeic', 'TOEIC'),
      icon: GraduationCap,
      items: [
        { label: t('nav.toeic_exams', 'Đề thi'), href: `/${locale}/toeic`, icon: FileText, active: !!isToeicExamsActive },
        { label: t('nav.toeic_history', 'Lịch sử làm bài'), href: `/${locale}/toeic/history`, icon: History, active: !!isToeicHistoryActive },
        { label: t('nav.toeic_stats', 'Thống kê'), href: `/${locale}/toeic/stats`, icon: BarChart3, active: !!isToeicStatsActive },
      ],
    },
    {
      id: 'vocabulary',
      label: t('nav.vocabulary', 'Vocabulary'),
      icon: BookOpen,
      items: [
        // The section stays highlighted on deeper vocabulary pages via the explore link.
        { label: t('nav.explore', 'Khám phá'), href: `/${locale}/vocabulary`, icon: Search, active: !!isVocabExploreActive || (!!pathname?.startsWith(`/${locale}/vocabulary/`) && !isVocabMyWordsActive) },
        { label: t('nav.my_words', 'Từ vựng của tôi'), href: `/${locale}/vocabulary/my-words`, icon: Bookmark, active: isVocabMyWordsActive },
      ],
    },
    {
      id: 'dictation',
      label: t('nav.dictation', 'Dictation'),
      icon: Headphones,
      items: [
        { label: t('nav.dictation', 'Dictation'), href: `/${locale}/dictation`, icon: Headphones, active: !!isPracticeActive },
        { label: t('nav.dictation_progress'), href: `/${locale}/dictation/progress`, icon: TrendingUp, active: !!isProgressActive },
      ],
    },
  ];
  const practiceSections: NavSection[] = [
    {
      id: 'games',
      label: t('nav.games', 'Trò chơi'),
      icon: Gamepad2,
      items: [
        { label: t('nav.arena', 'Đấu trường từ vựng'), href: `/${locale}/arena`, icon: Swords, active: !!isArenaActive },
        { label: t('nav.game_list', 'Danh sách trò chơi'), href: `/${locale}/games`, icon: Gamepad2, active: !!isGamesListActive },
      ],
    },
  ];
  const mistakes: NavLink = {
    label: t('mistakes.title'),
    href: `/${locale}/learning/mistakes`,
    icon: NotebookPen,
    active: !!isMistakesActive,
  };

  // Sections start open; navigating into a section re-opens it if the learner
  // had collapsed it.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    toeic: true,
    vocabulary: true,
    dictation: true,
    games: true,
  });
  const activeSectionId = [...learnSections, ...practiceSections].find((section) =>
    section.items.some((item) => item.active),
  )?.id;
  React.useEffect(() => {
    if (activeSectionId) setOpenSections((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
  }, [activeSectionId]);
  const renderSection = (section: NavSection) => (
    <NavSectionRow
      key={section.id}
      section={section}
      open={!!openSections[section.id]}
      onToggle={(open) => setOpenSections((prev) => ({ ...prev, [section.id]: open }))}
    />
  );

  const displayName = (user as any)?.fullName || user?.username || user?.email?.split('@')[0] || t('student', 'Học viên');
  const secondaryLine = user?.email || t('student', 'Học viên');
  const groupLabelClass = 'h-7 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400';

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      {/* Brand — same height as the page top bar so the two lines align. The
          uploaded wordmark already contains the icon, so it is shown alone when
          expanded and the square icon alone when collapsed. */}
      <SidebarHeader className="h-14 shrink-0 justify-center border-b border-slate-200/80 px-3 group-data-[collapsible=icon]:px-2.5">
        <Link
          href={`/${locale}`}
          aria-label={siteSettings.siteName}
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          {siteSettings.logoUrl ? (
            <>
              <span className="hidden size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg group-data-[collapsible=icon]:flex">
                <SiteLogo compact fallback={<BookOpen className="size-[18px]" aria-hidden />} />
              </span>
              <span className="flex min-w-0 group-data-[collapsible=icon]:hidden">
                <SiteLogo
                  fallback={
                    <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                      {siteSettings.siteName}
                    </span>
                  }
                  className="h-10 w-auto max-w-44 object-contain object-left"
                />
              </span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                  !siteSettings.iconUrl && 'bg-blue-600 text-white',
                )}
              >
                <SiteLogo compact fallback={<BookOpen className="size-[18px]" aria-hidden />} />
              </span>
              <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                  {siteSettings.siteName}
                </span>
                <span className="truncate text-xs text-slate-500">{t('portal', 'Cổng học tập')}</span>
              </span>
            </>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent
        aria-label={t('nav_groups.main')}
        className="gap-0 px-3 py-3 group-data-[collapsible=icon]:px-2.5"
      >
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <NavLinkRow item={home} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 p-0 group-data-[collapsible=icon]:mt-2">
          <SidebarGroupLabel className={groupLabelClass}>{t('nav_groups.learn')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{learnSections.map(renderSection)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 p-0 group-data-[collapsible=icon]:mt-2">
          <SidebarGroupLabel className={groupLabelClass}>{t('nav_groups.practice')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {practiceSections.map(renderSection)}
              <NavLinkRow item={mistakes} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-slate-200/80 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2.5">
        <div className="flex items-center justify-between gap-2 pl-1 group-data-[collapsible=icon]:hidden">
          <span className="text-xs font-medium text-slate-500">{t('language', 'Ngôn ngữ')}</span>
          <LanguageSwitcher />
        </div>

        <div
          aria-label={t('nav_groups.account')}
          className="flex items-center gap-2.5 rounded-lg p-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:p-0"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-semibold text-white"
          >
            {(displayName[0] || 'U').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{secondaryLine}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('logout', 'Đăng xuất')}
            title={t('logout', 'Đăng xuất')}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 outline-none transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
