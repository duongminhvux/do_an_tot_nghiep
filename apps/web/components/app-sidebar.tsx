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
  Globe,
  Search,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Dumbbell,
  TrendingUp,
  GraduationCap,
  FileText,
  History,
  BarChart3,
  Swords,
  Gamepad2,
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
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const siteSettings = useSiteSettings();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, state, setOpen, isMobile } = useSidebar();
  React.useEffect(() => { setOpenMobile(false); }, [pathname, setOpenMobile]);
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation('common');

  const [vocabMenuOpen, setVocabMenuOpen] = useState(true);
  const [toeicMenuOpen, setToeicMenuOpen] = useState(true);
  const [gamesMenuOpen, setGamesMenuOpen] = useState(true);
  const [dictationMenuOpen, setDictationMenuOpen] = useState(true);

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
  const isVocabMyWordsActive = pathname === `/${locale}/vocabulary/my-words`;
  const isVocabSectionActive = isVocabExploreActive || isVocabMyWordsActive || pathname?.startsWith(`/${locale}/vocabulary`);
  const isPracticeActive =
    pathname === `/${locale}/dictation` ||
    (pathname?.startsWith(`/${locale}/dictation/`) && !pathname?.startsWith(`/${locale}/dictation/progress`));
  const isProgressActive = pathname?.startsWith(`/${locale}/dictation/progress`);
  React.useEffect(() => {
    if (pathname?.startsWith(`/${locale}/dictation`)) setDictationMenuOpen(true);
  }, [pathname, locale]);
  const isArenaActive = pathname === `/${locale}/arena` || pathname?.startsWith(`/${locale}/arena/`);
  const isGamesListActive = pathname === `/${locale}/games` || pathname?.startsWith(`/${locale}/games/`);
  const isGamesSectionActive = isArenaActive || isGamesListActive;

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
  const isToeicSectionActive =
    pathname?.startsWith(`/${locale}/toeic`) ||
    isToeicExamsActive ||
    isToeicHistoryActive ||
    isToeicStatsActive;

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-slate-100 px-3.5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
            <SiteLogo compact fallback={<BookOpen className="h-5 w-5" />} />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900 truncate">
                <SiteLogo fallback={siteSettings.siteName} />
              </span>
              <span className="text-[11px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {t('student', 'Học viên')}
              </span>
            </div>
            <span className="text-xs text-slate-500 truncate">
              {t('portal', 'Cổng học tập')}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-3 py-4 space-y-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="space-y-1">
            <SidebarMenu className="space-y-1.5">
              {/* 1. Trang chủ */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isHomeActive}
                  tooltip={t('nav.home', 'Trang chủ')}
                  className={cn(
                    'h-10 px-3 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-all font-medium text-sm',
                    isHomeActive && 'bg-blue-50/80 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}`} className="flex items-center gap-3">
                    <LayoutDashboard
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isHomeActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.home', 'Trang chủ')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* 2. TOEIC (Collapsible Level 1 with 3 sub-pages: Đề thi, Lịch sử làm bài, Thống kê) */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith(`/${locale}/learning/mistakes`)} tooltip={t('mistakes.title')} className="h-10 rounded-lg px-3 text-sm font-medium">
                  <Link href={`/${locale}/learning/mistakes`}><Bookmark className="h-5 w-5 shrink-0" /><span>{t('mistakes.title')}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <div>
                  <button
                    type="button"
                    onClick={() => setToeicMenuOpen(!toeicMenuOpen)}
                    className={cn(
                      'w-full flex items-center justify-between h-10 px-3 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all font-semibold text-sm cursor-pointer group',
                      isToeicSectionActive && 'text-blue-600'
                    )}
                    title={t('nav.toeic', 'TOEIC')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GraduationCap
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isToeicSectionActive ? 'text-blue-600' : 'text-slate-500'
                        )}
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden font-semibold">
                        {t('nav.toeic', 'TOEIC')}
                      </span>
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden text-slate-400 group-hover:text-blue-600 transition-colors">
                      {toeicMenuOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {/* Submenu: Đề thi, Lịch sử làm bài, Thống kê */}
                  {toeicMenuOpen && (
                    <div className="pl-7 pr-1 pt-1.5 space-y-1 group-data-[collapsible=icon]:hidden">
                      <Link
                        href={`/${locale}/toeic`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isToeicExamsActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <FileText
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isToeicExamsActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.toeic_exams', 'Đề thi')}</span>
                      </Link>

                      <Link
                        href={`/${locale}/toeic/history`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isToeicHistoryActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <History
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isToeicHistoryActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.toeic_history', 'Lịch sử làm bài')}</span>
                      </Link>

                      <Link
                        href={`/${locale}/toeic/stats`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isToeicStatsActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <BarChart3
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isToeicStatsActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.toeic_stats', 'Thống kê')}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </SidebarMenuItem>

              {/* 3. Trò chơi (Collapsible with Vocabulary Arena & Game List) */}
              <SidebarMenuItem>
                <div>
                  <button
                    type="button"
                    onClick={() => setGamesMenuOpen(!gamesMenuOpen)}
                    className={cn(
                      'w-full flex items-center justify-between h-10 px-3 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all font-semibold text-sm cursor-pointer group',
                      isGamesSectionActive && 'text-blue-600'
                    )}
                    title={t('nav.games', 'Trò chơi')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Gamepad2
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isGamesSectionActive ? 'text-blue-600' : 'text-slate-500'
                        )}
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden font-semibold">
                        {t('nav.games', 'Trò chơi')}
                      </span>
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden text-slate-400 group-hover:text-blue-600 transition-colors">
                      {gamesMenuOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {gamesMenuOpen && (
                    <div className="pl-7 pr-1 pt-1.5 space-y-1 group-data-[collapsible=icon]:hidden">
                      <Link
                        href={`/${locale}/arena`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isArenaActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <Swords
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isArenaActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.arena', 'Đấu trường từ vựng')}</span>
                      </Link>

                      <Link
                        href={`/${locale}/games`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isGamesListActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <Gamepad2
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isGamesListActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.game_list', 'Danh sách trò chơi')}</span>
                      </Link>


                    </div>
                  )}
                </div>
              </SidebarMenuItem>

              {/* 3. Vocabulary (Collapsible with Explore & My Words) */}
              <SidebarMenuItem>
                <div>
                  <button
                    type="button"
                    onClick={() => setVocabMenuOpen(!vocabMenuOpen)}
                    className={cn(
                      'w-full flex items-center justify-between h-10 px-3 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all font-semibold text-sm cursor-pointer group',
                      isVocabSectionActive && 'text-blue-600'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BookOpen
                        className={cn(
                          'h-5 w-5 shrink-0',
                          isVocabSectionActive ? 'text-blue-600' : 'text-slate-500'
                        )}
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden font-semibold">
                        {t('nav.vocabulary', 'Vocabulary')}
                      </span>
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden text-slate-400 group-hover:text-blue-600 transition-colors">
                      {vocabMenuOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {/* Submenu: Khám phá & Từ vựng của tôi */}
                  {vocabMenuOpen && (
                    <div className="pl-7 pr-1 pt-1.5 space-y-1 group-data-[collapsible=icon]:hidden">
                      <Link
                        href={`/${locale}/vocabulary`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isVocabExploreActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <Search
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isVocabExploreActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.explore', 'Khám phá')}</span>
                      </Link>

                      <Link
                        href={`/${locale}/vocabulary/my-words`}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          isVocabMyWordsActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <Bookmark
                          className={cn(
                            'w-4 h-4 shrink-0',
                            isVocabMyWordsActive ? 'text-blue-600' : 'text-slate-400'
                          )}
                        />
                        <span>{t('nav.my_words', 'Từ vựng của tôi')}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </SidebarMenuItem>

              {/* 3. Luyện tập */}
              <SidebarMenuItem>
                <div>
                  <SidebarMenuButton
                    onClick={() => {
                      if (state === 'collapsed' && !isMobile) {
                        setOpen(true);
                        setDictationMenuOpen(true);
                      } else setDictationMenuOpen(open => !open);
                    }}
                    isActive={!!(isPracticeActive || isProgressActive)}
                    tooltip={t('nav.dictation', 'Dictation')}
                    aria-expanded={dictationMenuOpen}
                    aria-controls="dictation-submenu"
                    className={cn('h-10 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600',
                      (isPracticeActive || isProgressActive) && 'text-blue-600')}
                  >
                    <Headphones className="h-5 w-5 shrink-0" />
                    <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{t('nav.dictation', 'Dictation')}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden', dictationMenuOpen && 'rotate-180')} />
                  </SidebarMenuButton>
                  {dictationMenuOpen && (
                    <div id="dictation-submenu" className="space-y-1 pl-7 pr-1 pt-1.5 group-data-[collapsible=icon]:hidden">
                      <Link href={`/${locale}/dictation`} aria-current={isPracticeActive ? 'page' : undefined}
                        className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          isPracticeActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
                        <Headphones className="h-4 w-4 shrink-0" />
                        <span>{t('nav.dictation', 'Dictation')}</span>
                      </Link>
                      <Link href={`/${locale}/dictation/progress`} aria-current={isProgressActive ? 'page' : undefined}
                        className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          isProgressActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>
                        <TrendingUp className="h-4 w-4 shrink-0" />
                        <span>{t('nav.dictation_progress')}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-slate-100 p-3 space-y-3 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:items-center">
        {/* Language Switcher */}
        <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:hidden">
          <span className="text-sm text-slate-600 font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            {t('language', 'Ngôn ngữ')}
          </span>
          <LanguageSwitcher />
        </div>

        <SidebarSeparator className="my-1 group-data-[collapsible=icon]:hidden" />

        {/* User Card Matching Mockup */}
        <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-0 cursor-pointer">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow-xs">
              {(user?.username?.[0] || 'N').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-bold text-slate-900 truncate">
                {(user as any)?.fullName || user?.username || 'Nguyễn Văn A'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                Student
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 group-data-[collapsible=icon]:hidden">
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title={t('logout', 'Đăng xuất')}
            >
              <LogOut className="h-4 w-4" />
            </button>
            <ChevronRight className="w-4.5 h-4.5 text-slate-300" />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
