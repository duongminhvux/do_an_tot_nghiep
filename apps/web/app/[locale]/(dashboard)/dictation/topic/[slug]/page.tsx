'use client';

import { useTranslation } from 'react-i18next';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Headphones, Search, SearchX } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationLevel, DictationTopicDetail } from '@/types/dictation';
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, PageShell, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function formatDuration(ms: number) {
  if (!ms) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function DictationTopicPage() {
  const { t } = useTranslation('dictation');
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const slug = String(params?.slug || '');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'ALL' | DictationLevel>('ALL');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dictation-topic', slug],
    queryFn: () => dictationService.getTopicBySlug(slug),
    enabled: Boolean(slug),
  });
  const topic = unwrap<DictationTopicDetail>(data);

  useEffect(() => {
    const firstSectionId = topic?.sections?.[0]?._id;
    if (!firstSectionId) return;

    setOpenSections((current) =>
      current.size === 0 ? new Set([firstSectionId]) : current,
    );
  }, [topic?._id, topic?.sections]);

  const sections = useMemo(() => {
    if (!topic?.sections) return [];
    const keyword = search.trim().toLowerCase();
    return topic.sections
      .map((section) => ({
        ...section,
        lessons: section.lessons.filter((lesson) => {
          const matchesSearch = !keyword || `${lesson.title} ${lesson.description || ''}`.toLowerCase().includes(keyword);
          const matchesLevel = level === 'ALL' || lesson.level === level;
          return matchesSearch && matchesLevel;
        }),
      }))
      .filter((section) => section.lessons.length > 0);
  }, [topic, search, level]);

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label={t('loading_topics')} className="min-h-[60vh]" />
      </PageShell>
    );
  }
  if (isError || !topic) {
    return (
      <PageShell>
        <PageHeader breadcrumbs={[{ label: t('all_topics'), href: `/${locale}/dictation` }]} title="Dictation" />
        <ErrorState message={t('topic_not_found')} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: t('all_topics'), href: `/${locale}/dictation` }, { label: topic.title }]}
        title={topic.title}
        description={topic.description || t('section_description')}
      />

      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {topic.thumbnailUrl ? (
            <img src={topic.thumbnailUrl} alt={topic.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-blue-50 text-blue-600"><Headphones className="h-9 w-9" /></div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{topic.sectionCount} {t('sections')}</Badge>
            <Badge>{topic.lessonCount} {t('lessons')}</Badge>
            <Badge tone="emerald">{topic.completedLessons} {t('completed_unit')}</Badge>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_lessons')}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={level === item}
                  onClick={() => setLevel(item)}
                  className={cn(
                    'h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors',
                    level === item
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600',
                  )}
                >
                  {item === 'ALL' ? t('all') : item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {sections.map((section) => {
          const open = openSections.has(section._id);
          return (
            <section key={section._id} className={cn(surface, 'overflow-hidden')}>
              <button
                type="button"
                onClick={() => setOpenSections((current) => { const next = new Set(current); if (next.has(section._id)) next.delete(section._id); else next.add(section._id); return next; })}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors',
                  open ? 'border-b border-slate-100 bg-blue-50/50' : 'bg-white hover:bg-slate-50',
                )}
              >
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">
                    {section.title}{' '}
                    <span className="ml-1 text-sm font-normal text-slate-500">({section.lessons.length} {t('lessons')})</span>
                  </h2>
                  {section.description && <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>}
                </div>
                {open ? <ChevronUp className="h-4 w-4 shrink-0 text-blue-600" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
              {open && (
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {section.lessons.map((lesson, index) => {
                    const handled = new Set([
                      ...(lesson.progress?.completedSegments || []),
                      ...(lesson.progress?.revealedSegments || []),
                    ]).size;
                    const percent = lesson.sentenceCount ? Math.round((handled / lesson.sentenceCount) * 100) : 0;
                    return (
                      <Link
                        key={lesson._id}
                        href={`/${locale}/dictation/${lesson.slug}`}
                        className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-blue-600">{index + 1}. {lesson.level}</p>
                            <h3 className="mt-1 truncate text-sm font-semibold text-slate-800 group-hover:text-blue-600">{lesson.title}</h3>
                          </div>
                          {lesson.progress?.completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <span>{lesson.sentenceCount} {t('sentences')}</span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDuration(lesson.totalDurationMs)}</span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {sections.length === 0 && <EmptyState icon={SearchX} title={t('no_matching_lessons')} />}
      </div>
    </PageShell>
  );
}
