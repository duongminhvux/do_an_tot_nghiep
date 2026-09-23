'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  FolderKanban,
  FileText,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';

// Skeletons for Lazy Loading
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 rounded-2xl bg-slate-100 border border-slate-200" />
      ))}
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
      <div className="h-64 rounded-3xl bg-slate-100 border border-slate-200" />
      <div className="h-64 rounded-3xl bg-slate-100 border border-slate-200" />
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
      <div className="h-56 rounded-2xl bg-slate-100 border border-slate-200" />
      <div className="h-56 rounded-2xl bg-slate-100 border border-slate-200" />
    </div>
  );
}

// Dynamic Imports with Lazy Loading
const VocabularyStats = dynamic(
  () => import('@/components/vocabulary/vocabulary-hub/vocabulary-stats'),
  {
    loading: () => <StatsSkeleton />,
    ssr: false,
  },
);

const VocabularyQuickNav = dynamic(
  () => import('@/components/vocabulary/vocabulary-hub/vocabulary-quick-nav'),
  {
    loading: () => <NavSkeleton />,
    ssr: false,
  },
);

const VocabularyRecentPreview = dynamic(
  () => import('@/components/vocabulary/vocabulary-hub/vocabulary-recent-preview'),
  {
    loading: () => <PreviewSkeleton />,
    ssr: false,
  },
);

export default function VocabularyPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('vocabulary');

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 w-full max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-10 text-white shadow-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('hub_badge', { defaultValue: 'Vocabulary Management Hub' })}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t('hub_title', { defaultValue: 'Vocabulary & Curriculums' })}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
            {t('hub_desc', {
              defaultValue:
                'Centralized hub for managing English curriculum collections, structured lessons, and the comprehensive 3,000+ vocabulary dictionary with IPA and audio.',
            })}
          </p>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <Link
              href={`/${locale}/vocabulary/collections`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>{t('hub_btn_collections', { defaultValue: 'Collections' })}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href={`/${locale}/vocabulary/words`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/10"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('hub_btn_words', { defaultValue: 'Word Bank' })}</span>
            </Link>
          </div>
        </div>

        {/* Decorative backdrop shapes */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Lazy-loaded Stats */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>{t('hub_metrics_title', { defaultValue: 'Overview Metrics' })}</span>
        </h2>
        <VocabularyStats />
      </section>

      {/* Lazy-loaded Quick Navigation Modules */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>{t('hub_modules_title', { defaultValue: 'Core Modules' })}</span>
        </h2>
        <VocabularyQuickNav />
      </section>

      {/* Lazy-loaded Live Previews */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>{t('hub_recent_title', { defaultValue: 'Recent Activity & Preview' })}</span>
        </h2>
        <VocabularyRecentPreview />
      </section>
    </div>
  );
}
