'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  FileText,
  ArrowRight,
  BookOpen,
  Layers,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

export default function VocabularyQuickNav() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('vocabulary');

  const navModules = [
    {
      title: t('collections_title', { defaultValue: 'Vocabulary Collections' }),
      description: t('hub_nav_collections_desc', {
        defaultValue:
          'Manage Oxford 3000, Destination B1/B2, IELTS, thematic curriculums, and structured lessons.',
      }),
      href: `/${locale}/vocabulary/collections`,
      tag: t('hub_nav_collections_tag', { defaultValue: 'Curriculum & Lessons' }),
      badge: t('hub_nav_collections_badge', { defaultValue: 'Organized' }),
      icon: FolderKanban,
      gradient: 'from-blue-600 via-indigo-600 to-blue-800',
      features: [
        t('lessons_tab', { defaultValue: 'Lessons' }),
        t('cover_image', { defaultValue: 'Cover images' }),
        t('slug_label', { defaultValue: 'Slugs' }),
        t('manage_words', { defaultValue: 'Word assignment' }),
      ],
      actionText: t('hub_nav_collections_btn', { defaultValue: 'Manage Collections' }),
    },
    {
      title: t('words_title', { defaultValue: 'Vocabulary Dictionary' }),
      description: t('hub_nav_words_desc', {
        defaultValue:
          'Global dictionary word bank with phonetic IPA, native US/UK audios, English definitions, and examples.',
      }),
      href: `/${locale}/vocabulary/words`,
      tag: t('hub_nav_words_tag', { defaultValue: 'Dictionary Bank' }),
      badge: t('hub_nav_words_badge', { defaultValue: 'Comprehensive' }),
      icon: FileText,
      gradient: 'from-emerald-600 via-teal-600 to-emerald-800',
      features: [
        t('sec_pronunciation', { defaultValue: 'IPA Pronunciation' }),
        t('test_audio', { defaultValue: 'Audio playback' }),
        t('all_levels', { defaultValue: 'CEFR Level filters' }),
        t('search_placeholder', { defaultValue: 'Quick search' }),
      ],
      actionText: t('hub_nav_words_btn', { defaultValue: 'Browse Word Bank' }),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {navModules.map((item, idx) => {
        const Icon = item.icon;

        return (
          <div
            key={idx}
            className="group relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 hover:border-slate-300 hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden"
          >
            {/* Top row */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center shadow-md`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {item.tag}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                    {item.badge}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {item.features.map((feat, fIdx) => (
                  <span
                    key={fIdx}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg"
                  >
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>{feat}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={item.href}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group/btn"
              >
                <span>{item.actionText}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
