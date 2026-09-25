'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Flame,
  Target,
  ArrowRight,
} from 'lucide-react';
import { useAppSelector } from '@/redux/hooks';

export default function StudentHomePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { user } = useAppSelector((state) => state.auth);
  const { t } = useTranslation('common');

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('student', 'Học viên')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t('welcome_back', { name: user?.username || 'Student' })}
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {t('welcome_desc')}
          </p>
        </div>
      </div>

      {/* Quick Action / Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Vocabulary Card */}
        <Link
          href={`/${locale}/vocabulary`}
          className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-500 hover:shadow-md transition-all shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {t('nav.vocabulary', 'Từ vựng')}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
              {t('featured_collections', 'Bộ từ vựng')}
            </h3>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {t('featured_collections_desc')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600 group-hover:gap-1.5 transition-all">
            <span>{t('learn_now', 'Học ngay')}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </Link>

        {/* Lessons Card */}
        <Link
          href={`/${locale}/lessons`}
          className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-emerald-500 hover:shadow-md transition-all shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {t('lessons', 'Bài học')}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
              {t('explore_lessons', 'Khám phá bài học')}
            </h3>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {t('lessons')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-emerald-600 group-hover:gap-1.5 transition-all">
            <span>{t('learn_now', 'Học ngay')}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </Link>

        {/* Streak Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                <Flame className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {t('streak', 'Chuỗi ngày')}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {t('streak_val', { count: 1 })}
            </h3>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {t('daily_goal', 'Mục tiêu học tập')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-amber-600">
            <span>{t('streak', 'Chuỗi ngày')}</span>
          </div>
        </div>

        {/* Progress Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center">
                <Target className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {t('completion', 'Hoàn thành')}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {t('my_progress', 'Tiến độ học tập')}
            </h3>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {t('featured_collections_desc')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-violet-600">
            <span>{t('completion', 'Tiến độ')}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
