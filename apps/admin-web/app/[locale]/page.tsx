'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  LogOut,
  BookOpen,
  FolderKanban,
  FileText,
  Users,
  LayoutDashboard,
} from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import LanguageSwitcher from '@/components/language-switcher';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/authSlice';
import { authService } from '@/services';

export default function AdminHomePage() {
  const router = useRouter();
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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-slate-900">
                    English Platform
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {locale === 'en' ? 'Management Portal' : 'Hệ thống Quản trị'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <LanguageSwitcher />

              {/* User Info & Logout */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-slate-900">
                    {user?.username || 'Administrator'}
                  </div>
                  <div className="text-[11px] text-slate-500">{user?.email}</div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 text-xs font-medium transition-all cursor-pointer shadow-sm"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Welcome Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                <span>{locale === 'en' ? 'Administration Dashboard' : 'Bảng điều khiển Quản trị'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {locale === 'en'
                  ? `Welcome back, ${user?.username || 'Admin'}!`
                  : `Chào mừng trở lại, ${user?.username || 'Admin'}!`}
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {locale === 'en'
                  ? 'Manage vocabulary collections, lessons, word definitions, and user accounts from one unified portal.'
                  : 'Quản lý bộ sưu tập từ vựng, bài học, từ mới và tài khoản người dùng từ một trang quản trị tập trung.'}
              </p>
            </div>
          </div>

          {/* Quick Management Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Collections Card */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-400">Modules</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {locale === 'en' ? 'Collections' : 'Bộ sưu tập'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'en'
                  ? 'Manage topic collections and categories'
                  : 'Quản lý các chủ đề và danh mục học'}
              </p>
            </div>

            {/* Lessons Card */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-400">Curriculum</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {locale === 'en' ? 'Lessons' : 'Bài học'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'en'
                  ? 'Create and organize structured lessons'
                  : 'Tạo và sắp xếp lộ trình bài học'}
              </p>
            </div>

            {/* Words Card */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-400">Database</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {locale === 'en' ? 'Vocabulary' : 'Từ vựng'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'en'
                  ? 'Word bank, meanings, phonetics and examples'
                  : 'Kho từ vựng, phiên âm, nghĩa và ví dụ'}
              </p>
            </div>

            {/* Users Card */}
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-400">Accounts</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {locale === 'en' ? 'User Accounts' : 'Người dùng'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === 'en'
                  ? 'Monitor registered learners and permissions'
                  : 'Theo dõi tài khoản học viên và phân quyền'}
              </p>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
