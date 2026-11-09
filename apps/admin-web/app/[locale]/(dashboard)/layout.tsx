'use client';

import React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AdminHeaderActions } from '@/components/admin-header-actions';
import AuthGuard from '@/components/auth-guard';
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
    if (pathname?.includes('/iam/admins')) return t('iam:admins');
    if (pathname?.includes('/iam/roles')) return t('iam:roles');
    if (pathname?.includes('/media')) return locale === 'en' ? 'Media library' : 'Quản lý media';
    if (pathname?.includes('/arena')) return t('nav.arena');
    if (pathname?.includes('/games')) return t('nav.games');
    const isEn = locale === 'en';
    const vocabTitle = t('nav.vocabulary', isEn ? 'Vocabulary' : 'Từ vựng');

    if (pathname?.includes('/vocabulary/collections')) {
      const collectionsTitle = t('nav.collections', isEn ? 'Collections' : 'Bộ sưu tập');
      return `${vocabTitle} / ${collectionsTitle}`;
    }
    if (pathname?.includes('/vocabulary/words')) {
      const wordsTitle = t('nav.words', isEn ? 'Words' : 'Từ mới');
      return `${vocabTitle} / ${wordsTitle}`;
    }
    if (pathname?.includes('/vocabulary')) {
      return vocabTitle;
    }
    if (pathname?.includes('/lessons')) {
      return t('nav.lessons', isEn ? 'Lessons' : 'Bài học');
    }
    if (pathname?.includes('/dictation')) {
      return t('nav.dictation', 'Dictation');
    }
    if (pathname?.includes('/assessment/create')) {
      const assessTitle = t('nav.assessment', isEn ? 'Assessment' : 'Đánh giá');
      return `${assessTitle} / ${isEn ? 'Create TOEIC Exam' : 'Tạo đề thi TOEIC'}`;
    }
    if (pathname?.match(/\/assessment\/[^/]+$/)) {
      const assessTitle = t('nav.assessment', isEn ? 'Assessment' : 'Đánh giá');
      return `${assessTitle} / ${isEn ? 'Exam Details' : 'Chi tiết đề thi'}`;
    }
    if (pathname?.includes('/assessment')) {
      return t('nav.assessment', isEn ? 'Assessment' : 'Đánh giá');
    }
    if (pathname?.includes('/users')) {
      return t('nav.users', isEn ? 'User Accounts' : 'Người dùng');
    }
    return t('nav.dashboard', isEn ? 'Dashboard' : 'Bảng điều khiển');
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-slate-50 min-h-dvh">
          {/* Top Bar with Sidebar Trigger - Sticky Fixed to top */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 sm:px-6 backdrop-blur-md">
            <SidebarTrigger className="-ml-1 text-slate-600 hover:text-slate-900 cursor-pointer" />
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
              {getPageTitle()}
            </span>
            <AdminHeaderActions />
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
