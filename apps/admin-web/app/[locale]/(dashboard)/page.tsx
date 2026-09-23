'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  FolderKanban,
  FileText,
  Users,
  LayoutDashboard,
} from 'lucide-react';
import { useAppSelector } from '@/redux/hooks';

export default function AdminHomePage() {
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation('dashboard');

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('badge')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t('welcome', { name: user?.username || 'Admin' })}
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {t('description')}
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
            <span className="text-xs font-semibold text-slate-400">
              {t('cards.collections.tag')}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {t('cards.collections.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('cards.collections.desc')}
          </p>
        </div>

        {/* Lessons Card */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {t('cards.lessons.tag')}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {t('cards.lessons.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('cards.lessons.desc')}
          </p>
        </div>

        {/* Words Card */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {t('cards.vocabulary.tag')}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {t('cards.vocabulary.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('cards.vocabulary.desc')}
          </p>
        </div>

        {/* Users Card */}
        <div className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {t('cards.users.tag')}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {t('cards.users.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('cards.users.desc')}
          </p>
        </div>
      </div>
    </main>
  );
}
