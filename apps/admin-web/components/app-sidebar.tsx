'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  FileText,
  Users,
  LogOut,
  Globe,
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

  const isDashboardActive = pathname === `/${locale}`;
  const isVocabActive = pathname?.includes(`/${locale}/vocabulary`);
  const isCollectionsActive =
    pathname === `/${locale}/vocabulary/collections` ||
    pathname?.startsWith(`/${locale}/vocabulary/collections/`);
  const isWordsActive =
    pathname === `/${locale}/vocabulary/words` ||
    pathname?.startsWith(`/${locale}/vocabulary/words/`);
  const isLessonsActive =
    pathname === `/${locale}/lessons` ||
    pathname?.startsWith(`/${locale}/lessons/`);
  const isUsersActive =
    pathname === `/${locale}/users` ||
    pathname?.startsWith(`/${locale}/users/`);

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
                {t('brand')}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {t('admin')}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {t('management_portal')}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1 group-data-[collapsible=icon]:hidden">
            {t('navigation')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isDashboardActive}
                  tooltip={t('nav.dashboard')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isDashboardActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}`} className="flex items-center gap-2.5">
                    <LayoutDashboard
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isDashboardActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.dashboard')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Vocabulary (Collapsible with Collections & Words) */}
              <Collapsible
                asChild
                defaultOpen={true}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={t('nav.vocabulary')}
                      isActive={isVocabActive}
                      className={cn(
                        'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm cursor-pointer',
                        isVocabActive && 'bg-blue-50/70 text-blue-600 font-semibold'
                      )}
                    >
                      <FileText
                        className={cn(
                          'h-4.5 w-4.5 shrink-0',
                          isVocabActive ? 'text-blue-600' : 'text-slate-500'
                        )}
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {t('nav.vocabulary')}
                      </span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden text-slate-400" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="pl-4 ml-3.5 border-l border-slate-200 space-y-1 mt-1">
                      {/* Sub-item: Collections */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isCollectionsActive}
                          className={cn(
                            'h-8 px-2 rounded-md text-xs font-medium transition-all text-slate-600 hover:text-blue-600 hover:bg-blue-50',
                            isCollectionsActive && 'bg-blue-50 text-blue-600 font-semibold'
                          )}
                        >
                          <Link
                            href={`/${locale}/vocabulary/collections`}
                            className="flex items-center gap-2"
                          >
                            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                            <span>{t('nav.collections', locale === 'en' ? 'Collections' : 'Bộ sưu tập')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Sub-item: Words */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isWordsActive}
                          className={cn(
                            'h-8 px-2 rounded-md text-xs font-medium transition-all text-slate-600 hover:text-blue-600 hover:bg-blue-50',
                            isWordsActive && 'bg-blue-50 text-blue-600 font-semibold'
                          )}
                        >
                          <Link
                            href={`/${locale}/vocabulary/words`}
                            className="flex items-center gap-2"
                          >
                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                            <span>{t('nav.words', locale === 'en' ? 'Words' : 'Từ mới')}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Lessons */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isLessonsActive}
                  tooltip={t('nav.lessons')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isLessonsActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}/lessons`} className="flex items-center gap-2.5">
                    <BookOpen
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isLessonsActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.lessons')}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* User Accounts */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isUsersActive}
                  tooltip={t('nav.users')}
                  className={cn(
                    'h-9 px-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm',
                    isUsersActive && 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  )}
                >
                  <Link href={`/${locale}/users`} className="flex items-center gap-2.5">
                    <Users
                      className={cn(
                        'h-4.5 w-4.5 shrink-0',
                        isUsersActive ? 'text-blue-600' : 'text-slate-500'
                      )}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {t('nav.users')}
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
            {t('language')}
          </span>
          <LanguageSwitcher />
        </div>

        <SidebarSeparator className="my-1 group-data-[collapsible=icon]:hidden" />

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:gap-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-sm">
              {(user?.username?.[0] || 'A').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.username || 'Administrator'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.email || 'admin@english.com'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 group-data-[collapsible=icon]:hidden"
            title={t('logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
