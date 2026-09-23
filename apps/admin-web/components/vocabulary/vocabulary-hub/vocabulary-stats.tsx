'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService, wordService } from '@/services/vocabulary.service';
import {
  FolderKanban,
  FileText,
  BookOpen,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function VocabularyStats() {
  const { t } = useTranslation('vocabulary');

  // Query Collections count
  const { data: colsRes, isLoading: loadingCols } = useQuery({
    queryKey: ['collections-hub-stats'],
    queryFn: () => collectionService.getAll({ limit: 1 }),
  });

  // Query Words count
  const { data: wordsRes, isLoading: loadingWords } = useQuery({
    queryKey: ['words-hub-stats'],
    queryFn: () => wordService.getAll({ limit: 1 }),
  });

  const totalCols = colsRes?.data?.total ?? 0;
  const totalWords = wordsRes?.data?.total ?? 0;

  const stats = [
    {
      title: t('total_collections', { defaultValue: 'Total Collections' }),
      value: loadingCols ? '...' : totalCols.toLocaleString(),
      subtitle: t('hub_stat_cols_sub', { defaultValue: 'Structured curriculum & topics' }),
      icon: FolderKanban,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      title: t('total_words', { defaultValue: 'Vocabulary Words' }),
      value: loadingWords ? '...' : totalWords.toLocaleString(),
      subtitle: t('hub_stat_words_sub', { defaultValue: 'Dictionary entries with IPA & Audio' }),
      icon: FileText,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      title: t('hub_stat_cefr_title', { defaultValue: 'CEFR Standards' }),
      value: 'A1 — C2',
      subtitle: t('hub_stat_cefr_sub', { defaultValue: '6 Official proficiency levels' }),
      icon: BookOpen,
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
    {
      title: t('sec_pronunciation', { defaultValue: 'Audio Pronunciations' }),
      value: 'US & UK',
      subtitle: 'Audio streaming (US / UK)',
      icon: Sparkles,
      color: 'amber',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div
                className={`w-11 h-11 rounded-xl ${item.bgColor} ${item.textColor} border ${item.borderColor} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                {t('active', { defaultValue: 'Active' })}
              </span>
            </div>

            <div>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {item.value}
              </p>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {item.title}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {item.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
