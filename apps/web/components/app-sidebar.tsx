'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  LogOut,
  Globe,
} from 'lucide-react';
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
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
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
  const isVocabActive =
    pathname === `/${locale}/vocabulary` ||
    pathname?.startsWith(`/${locale}/vocabulary/`);
  const isLessonsActive =
    pathname === `/${locale}/lessons` ||
    pathname?.startsWith(`/${locale}/lessons/`);

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-white">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-slate-100 px-2 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 w-full">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
                {t('brand', 'Daily English')}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {t('student', 'Học viên')}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {t('portal', 'Cổng học tập')}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-3 space-y-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold text-slate-600 tracking-wider uppercase group-data-[collapsible=icon]:hidden">
            {t('navigation', 'Điều hướng')}
          </SidebarGroupLabel>
          <SidebarGroupContent className="space-y-1 mt-1">
            <SidebarMenu>
              {/* Home (Trang chủ) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isHomeActive}
                  tooltip={t('nav.home', 'Trang chủ')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isHomeActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}`} className="flex items-center gap-2.5">
                    <LayoutDashboard
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isHomeActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.home', 'Trang chủ')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Vocabulary (Nút bấm trực tiếp tới /vocabulary) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isVocabActive}
                  tooltip={t('nav.vocabulary', 'Từ vựng')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isVocabActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}/vocabulary`} className="flex items-center gap-2.5">
                    <BookOpen
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isVocabActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.vocabulary', 'Từ vựng')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Lessons */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isLessonsActive}
                  tooltip={t('nav.lessons', 'Bài học')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isLessonsActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}/lessons`} className="flex items-center gap-2.5">
                    <GraduationCap
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isLessonsActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.lessons', 'Bài học')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
            {t('language', 'Ngôn ngữ')}
          </span>
          <LanguageSwitcher />
        </div>

        <SidebarSeparator className="my-1 group-data-[collapsible=icon]:hidden" />

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:gap-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-sm">
              {(user?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.username || t('student', 'Học viên')}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 group-data-[collapsible=icon]:hidden"
            title={t('logout', 'Đăng xuất')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
