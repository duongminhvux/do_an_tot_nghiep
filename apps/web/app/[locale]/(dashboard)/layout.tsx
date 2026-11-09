'use client';

import React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { UserHeaderActions } from '@/components/user-header-actions';
import AuthGuard from '@/components/auth-guard';
import { RoomClosedNotice } from '@/components/room-closed-notice';
import { AppSidebar } from '@/components/app-sidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('common');

  const getPageTitle = () => {
    const isEn = locale === 'en';
    if (pathname === `/${locale}/account`) return t('account.profile');

    if (pathname === `/${locale}/games/typing-rush`) return t('minigames:title');

    if (pathname === `/${locale}/games` || pathname?.startsWith(`/${locale}/games/`)) {
      return t('nav.game_list_title');
    }

    if (pathname?.includes('/arena')) {
      return t('nav.arena', isEn ? 'Vocabulary Arena' : 'Đấu trường từ vựng');
    }

    if (pathname?.includes('/toeic/attempts/') && pathname.endsWith('/result')) {
      return t('nav.toeic_result', isEn ? 'Test Result' : 'Kết quả bài thi');
    }
    if (pathname?.includes('/toeic/history')) {
      return t('nav.toeic_history', isEn ? 'Test History' : 'Lịch sử làm bài');
    }
    if (pathname?.includes('/toeic/stats')) {
      return t('nav.toeic_stats', isEn ? 'Statistics' : 'Thống kê');
    }
    if (pathname?.includes('/toeic')) {
      return t('nav.toeic_exams', isEn ? 'Exams & Practice' : 'Đề thi');
    }
    if (pathname?.endsWith('/vocabulary/learned')) return t('vocabulary:library.title');
    if (pathname?.includes('/vocabulary')) {
      return t('nav.vocabulary', isEn ? 'Vocabulary' : 'Từ vựng');
    }
    if (pathname?.includes('/dictation/progress')) {
      return t('nav.dictation_progress', isEn ? 'Dictation Progress' : 'Tiến độ Dictation');
    }
    if (pathname?.includes('/dictation')) {
      return t('nav.dictation', 'Dictation');
    }
    if (pathname?.includes('/learning/mistakes')) {
      return t('mistakes.title');
    }
    if (pathname?.includes('/lessons')) {
      return t('nav.lessons', isEn ? 'Lessons' : 'Bài học');
    }
    return t('nav.home', isEn ? 'Home' : 'Trang chủ');
  };

  const listeningStudio = new RegExp(`^/${locale}/dictation/[^/]+$`).test(pathname) && !pathname.endsWith('/progress');
  // Focused learning sessions provide their own navigation.
  if (
    listeningStudio || (pathname?.startsWith(`/${locale}/toeic/attempts/`) &&
    !pathname.endsWith('/result'))
  ) {
    return (
      <AuthGuard>
        <RoomClosedNotice />
        {children}
      </AuthGuard>
    );
  }

  return (
      <AuthGuard>
        <RoomClosedNotice />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-background min-h-dvh flex flex-col">
            {/* Top Bar with Sidebar Trigger - Sticky Fixed to top */}
            <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-md sm:px-6">
              <SidebarTrigger className="-ml-1 text-slate-600 hover:text-slate-900 cursor-pointer" />
              <Separator orientation="vertical" className="hidden h-5 sm:block" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {getPageTitle()}
              </span>
              <UserHeaderActions />
            </header>

            {/* Page Content */}
            <div className="min-w-0 flex-1 w-full">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AuthGuard>
  );
}
