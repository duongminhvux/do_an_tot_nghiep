'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService, wordService } from '@/services/vocabulary.service';
import { CollectionItem, WordListItem } from '@/types/vocabulary';
import {
  FolderKanban,
  FileText,
  ArrowRight,
  ExternalLink,
  Volume2,
} from 'lucide-react';

export default function VocabularyRecentPreview() {
  const { t } = useTranslation('vocabulary');
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';

  // Recent Collections
  const { data: colsRes, isLoading: loadingCols } = useQuery({
    queryKey: ['recent-cols-preview'],
    queryFn: () => collectionService.getAll({ limit: 4 }),
  });

  // Recent Words
  const { data: wordsRes, isLoading: loadingWords } = useQuery({
    queryKey: ['recent-words-preview'],
    queryFn: () => wordService.getAll({ limit: 4 }),
  });

  const collections: CollectionItem[] = colsRes?.data?.data || [];
  const words: WordListItem[] = wordsRes?.data?.data || [];

  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Collections */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900">
              {t('hub_featured_collections', 'Featured Collections')}
            </h4>
          </div>
          <Link
            href={`/${locale}/vocabulary/collections`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>{t('hub_view_all', 'View all')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingCols ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {t('hub_no_collections', 'No collections found.')}
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {c.coverUrl || c.thumbnail ? (
                    <div className="w-14 aspect-[16/9] rounded-lg overflow-hidden shrink-0 border border-slate-200">
                      <img
                        src={c.coverUrl || c.thumbnail}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 aspect-[16/9] rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-4 h-4 text-blue-600" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {c.name}
                      </p>
                      {c.slug && (
                        <span className="font-mono text-[10px] text-slate-400">
                          /{c.slug}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {c.lessonsCount ?? 0} {t('lessons_tab', 'Lessons').toLowerCase()}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/${locale}/vocabulary/collections`}
                  className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-white shrink-0"
                  title="Open in Collections"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Vocabulary Words */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">
              {t('hub_recent_words', 'Recent Words')}
            </h4>
          </div>
          <Link
            href={`/${locale}/vocabulary/words`}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <span>{t('hub_view_all', 'View all')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingWords ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : words.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {t('hub_no_words', 'No words in dictionary yet.')}
          </div>
        ) : (
          <div className="space-y-2">
            {words.map((w) => {
              const audioUrl = w.audio?.us || w.audio?.uk;

              return (
                <div
                  key={w._id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {w.word}
                      </p>
                      {w.level && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {w.level}
                        </span>
                      )}
                      {(w.ipa?.us || w.ipa?.uk) && (
                        <span className="font-mono text-[10px] text-slate-400">
                          /{w.ipa?.us || w.ipa?.uk}/
                        </span>
                      )}
                    </div>
                    {w.parts?.[0]?.meanings?.[0]?.definition && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {w.parts[0].meanings[0].definition}
                      </p>
                    )}
                  </div>

                  {audioUrl && (
                    <button
                      type="button"
                      onClick={() => handlePlayAudio(audioUrl)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors rounded-lg hover:bg-white cursor-pointer shrink-0"
                      title="Play Pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
