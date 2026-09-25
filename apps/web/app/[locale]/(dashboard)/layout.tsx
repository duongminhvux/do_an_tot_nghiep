'use client';

import React from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
    const isEn = locale === 'en';

    if (pathname?.includes('/vocabulary')) {
      return t('nav.vocabulary', isEn ? 'Vocabulary' : 'Từ vựng');
    }
    if (pathname?.includes('/lessons')) {
      return t('nav.lessons', isEn ? 'Lessons' : 'Bài học');
    }
    return t('nav.home', isEn ? 'Home' : 'Trang chủ');
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-slate-50 min-h-screen flex flex-col">
          {/* Top Bar with Sidebar Trigger - Sticky Fixed to top */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md shadow-xs">
            <SidebarTrigger className="-ml-1 text-slate-600 hover:text-slate-900 cursor-pointer" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-xs font-semibold text-slate-700">
              {getPageTitle()}
            </span>
          </header>

          {/* Page Content */}
          <div className="flex-1 w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
