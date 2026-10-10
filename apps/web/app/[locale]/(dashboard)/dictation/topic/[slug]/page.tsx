'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Headphones, Loader2, Search } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationLevel, DictationTopicDetail } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function formatDuration(ms: number) {
  if (!ms) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function DictationTopicPage() {
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
    if (topic?.sections?.length && openSections.size === 0) {
      setOpenSections(new Set([topic.sections[0]._id]));
    }
  }, [topic?._id]);

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

  if (isLoading) return <div className="flex min-h-[65vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải Topic...</div>;
  if (isError || !topic) return <div className="p-8 text-center text-sm text-rose-600">Không tìm thấy Topic Dictation.</div>;

  return (
    <div className="min-h-screen bg-slate-50/40 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="text-xs text-slate-400"><Link href={`/${locale}/dictation`} className="font-semibold text-blue-600 hover:underline">Tất cả Topic</Link><span className="mx-2">/</span>{topic.title}</div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {topic.thumbnailUrl ? <img src={topic.thumbnailUrl} alt={topic.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-blue-50 text-blue-500"><Headphones className="h-9 w-9" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{topic.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{topic.description || 'Luyện nghe theo từng câu, chia thành các Section để học tuần tự.'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-full bg-slate-100 px-2.5 py-1">{topic.sectionCount} sections</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{topic.lessonCount} lessons</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{topic.completedLessons} completed</span></div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm Lesson..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
          <div className="flex flex-wrap gap-1.5">{(['ALL','A1','A2','B1','B2','C1','C2'] as const).map((item) => <button key={item} onClick={() => setLevel(item)} className={`h-8 rounded-md px-2.5 text-[11px] font-bold ${level === item ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{item === 'ALL' ? 'Tất cả' : item}</button>)}</div>
        </div>

        <div className="space-y-3">
          {sections.map((section) => {
            const open = openSections.has(section._id);
            return (
              <section key={section._id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <button onClick={() => setOpenSections((current) => { const next = new Set(current); if (next.has(section._id)) next.delete(section._id); else next.add(section._id); return next; })} className={`flex w-full items-center justify-between px-4 py-3 text-left ${open ? 'border-b border-blue-100 bg-blue-50/60' : 'bg-white'}`}>
                  <div><h2 className="text-sm font-bold text-slate-800">{section.title} <span className="ml-1 font-medium text-slate-400">({section.lessons.length} lessons)</span></h2>{section.description && <p className="mt-0.5 text-xs text-slate-400">{section.description}</p>}</div>
                  {open ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {open && (
                  <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                    {section.lessons.map((lesson, index) => {
                      const handled = new Set([
                        ...(lesson.progress?.completedSegments || []),
                        ...(lesson.progress?.revealedSegments || []),
                      ]).size;
                      const percent = lesson.sentenceCount ? Math.round((handled / lesson.sentenceCount) * 100) : 0;
                      return (
                        <Link key={lesson._id} href={`/${locale}/dictation/${lesson.slug}`} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/20">
                          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold text-blue-600">{index + 1}. {lesson.level}</p><h3 className="mt-1 truncate text-sm font-bold text-slate-800 group-hover:text-blue-600">{lesson.title}</h3></div>{lesson.progress?.completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}</div>
                          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400"><span>{lesson.sentenceCount} câu</span><span>•</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDuration(lesson.totalDurationMs)}</span></div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          {sections.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">Không có Lesson phù hợp bộ lọc.</div>}
        </div>
      </div>
    </div>
  );
}
