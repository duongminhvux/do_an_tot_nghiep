'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpenText, Headphones, Loader2, Search } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import type { DictationTopicSummary } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function levelLabel(levels: string[]) {
  if (!levels?.length) return '—';
  if (levels.length === 1) return levels[0];
  return `${levels[0]}–${levels[levels.length - 1]}`;
}

export default function DictationTopicsPage() {
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
    <div className="min-h-screen bg-slate-50/40 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <Headphones className="h-3.5 w-3.5" /> Dictation
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Chọn chủ đề luyện nghe</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Mỗi Topic được chia thành nhiều Section và Lesson. Trong mỗi Lesson bạn sẽ nghe và gõ lại từng câu một.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm Topic..." className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải Topic...</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
            <BookOpenText className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">Chưa có Topic Dictation</p>
            <p className="mt-1 text-sm text-slate-400">Admin cần tạo Topic, Section và publish ít nhất một Lesson.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((topic) => {
              const completedPercent = topic.lessonCount ? Math.round((topic.completedLessons / topic.lessonCount) * 100) : 0;
              return (
                <Link key={topic._id} href={`/${locale}/dictation/topic/${topic.slug}`} className="group flex min-h-36 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {topic.thumbnailUrl ? (
                      <img src={topic.thumbnailUrl} alt={topic.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-500"><Headphones className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <h2 className="truncate text-lg font-bold text-slate-900 group-hover:text-blue-600">{topic.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{topic.description || 'Luyện nghe theo từng câu với nhiều bài học được sắp xếp theo Section.'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-400">
                      <span>Levels: {levelLabel(topic.levels)}</span><span>•</span><span>{topic.lessonCount} lessons</span><span>•</span><span>{topic.sectionCount} sections</span>
                    </div>
                    {completedPercent > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${completedPercent}%` }} /></div>
                        <span className="text-[10px] font-bold text-slate-500">{completedPercent}%</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
