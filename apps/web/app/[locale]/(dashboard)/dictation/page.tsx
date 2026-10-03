'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLessonSummary, DictationLevel } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

function formatDuration(ms: number) {
  if (!ms) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function DictationLibraryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'ALL' | DictationLevel>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['dictation-lessons'],
    queryFn: () => dictationService.getAll(),
    staleTime: 30_000,
  });
  const lessons = unwrap<DictationLessonSummary[]>(data) || [];

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesSearch = !keyword || `${lesson.title} ${lesson.topic} ${lesson.description}`.toLowerCase().includes(keyword);
      const matchesLevel = level === 'ALL' || lesson.level === level;
      return matchesSearch && matchesLevel;
    });
  }, [lessons, search, level]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <Headphones className="h-3.5 w-3.5" /> Listening · Dictation
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Nghe từng câu. Gõ lại chính xác.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Luyện nghe chủ động với audio được chia theo từng câu. Bạn có thể nghe lại, kiểm tra đáp án và theo dõi tiến độ của từng bài.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <Sparkles className="h-5 w-5 text-blue-300" />
              <p className="mt-3 text-sm font-semibold">Mẹo luyện hiệu quả</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">Nghe 2–3 lần trước khi xem transcript. Chỉ dùng “Hiện đáp án” khi thực sự bị kẹt.</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bài dictation..." className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['ALL','A1','A2','B1','B2','C1','C2'] as const).map((item) => (
              <button key={item} onClick={() => setLevel(item)} className={`h-9 rounded-lg px-3 text-xs font-bold transition ${level === item ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {item === 'ALL' ? 'Tất cả' : item}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải bài luyện...</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center">
            <Headphones className="mb-3 h-9 w-9 text-slate-300" />
            <p className="font-semibold text-slate-700">Chưa có bài Dictation phù hợp</p>
            <p className="mt-1 text-sm text-slate-400">Admin cần publish bài sau khi generate audio.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((lesson) => {
              const progress = lesson.progress;
              const completedCount = progress?.completedSegments?.length || 0;
              const percent = lesson.sentenceCount ? Math.round((completedCount / lesson.sentenceCount) * 100) : 0;
              return (
                <Link key={lesson._id} href={`/${locale}/dictation/${lesson.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Headphones className="h-5 w-5" /></div>
                    {progress?.completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Hoàn thành</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{lesson.level}</span>
                    )}
                  </div>
                  <h2 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-600">{lesson.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{lesson.description || `Chủ đề: ${lesson.topic}`}</p>
                  <div className="mt-4 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                    <span>{lesson.topic}</span><span>•</span><span>{lesson.sentenceCount} câu</span><span>•</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDuration(lesson.totalDurationMs)}</span>
                  </div>
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Tiến độ</span><span className="font-bold text-slate-700">{percent}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} /></div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-blue-600">
                    <span>{percent > 0 && percent < 100 ? 'Tiếp tục luyện' : percent === 100 ? 'Luyện lại' : 'Bắt đầu'}</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
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
