'use client';

import { useTranslation } from 'react-i18next';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpenText, Headphones, Search } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationTopicSummary } from '@/types/dictation';
import { EmptyState, LoadingState, PageHeader, PageShell, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function levelLabel(levels: string[]) {
  if (!levels?.length) return '—';
  if (levels.length === 1) return levels[0];
  return `${levels[0]}–${levels[levels.length - 1]}`;
}

export default function DictationTopicsPage() {
  const { t } = useTranslation('dictation');
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['dictation-topics'],
    queryFn: () => dictationService.getTopics(),
    staleTime: 30_000,
  });
  const topics = unwrap<DictationTopicSummary[]>(data) || [];
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return topics;
    return topics.filter((topic) => `${topic.title} ${topic.description || ''}`.toLowerCase().includes(keyword));
  }, [topics, search]);

  return (
    <PageShell>
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
        <PageHeader
          eyebrow="Dictation"
          icon={Headphones}
          title={t('title')}
          description={t('description')}
          actions={
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_topics')}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          }
        />
      </div>

      {isLoading ? (
        <LoadingState label={t('loading_topics')} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpenText} title={t('empty_topics')} description={t('empty_topics_description')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((topic) => {
            const completedPercent = topic.lessonCount ? Math.round((topic.completedLessons / topic.lessonCount) * 100) : 0;
            return (
              <Link
                key={topic._id}
                href={`/${locale}/dictation/topic/${topic.slug}`}
                className={cn(surface, 'group flex min-h-36 gap-4 p-5 transition hover:border-blue-300 hover:shadow-md')}
              >
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {topic.thumbnailUrl ? (
                    <img src={topic.thumbnailUrl} alt={topic.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-blue-50 text-blue-600"><Headphones className="h-8 w-8" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-slate-900 group-hover:text-blue-600">{topic.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{topic.description || t('topic_description')}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{t('levels')} {levelLabel(topic.levels)}</span>
                    <span className="text-slate-300">•</span>
                    <span>{topic.lessonCount} {t('lessons')}</span>
                    <span className="text-slate-300">•</span>
                    <span>{topic.sectionCount} {t('sections')}</span>
                  </div>
                  {completedPercent > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${completedPercent}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{completedPercent}%</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
