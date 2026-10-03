'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AudioLines,
  CheckCircle2,
  Clock3,
  FileAudio,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLesson, DictationStatus } from '@/types/dictation';
import type { LucideIcon } from 'lucide-react';

const statusStyle: Record<DictationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PROCESSING_AUDIO: 'bg-blue-50 text-blue-700',
  READY: 'bg-emerald-50 text-emerald-700',
  PUBLISHED: 'bg-indigo-50 text-indigo-700',
  AUDIO_FAILED: 'bg-rose-50 text-rose-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function AdminDictationPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dictation'],
    queryFn: () => dictationService.getAll(),
  });

  const lessons = unwrap<DictationLesson[]>(data) || [];
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return lessons;
    return lessons.filter((lesson) =>
      `${lesson.title} ${lesson.topic} ${lesson.level}`.toLowerCase().includes(keyword),
    );
  }, [lessons, search]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => dictationService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dictation'] }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      publish ? dictationService.publish(id) : dictationService.unpublish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-dictation'] }),
  });

  const stats = {
    total: lessons.length,
    published: lessons.filter((item) => item.status === 'PUBLISHED').length,
    ready: lessons.filter((item) => item.status === 'READY').length,
    sentences: lessons.reduce((sum, item) => sum + (item.sentenceCount || 0), 0),
  };
  const statCards: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: 'Tổng bài', value: stats.total, Icon: FileAudio },
    { label: 'Đã xuất bản', value: stats.published, Icon: CheckCircle2 },
    { label: 'Sẵn sàng', value: stats.ready, Icon: Sparkles },
    { label: 'Tổng số câu', value: stats.sentences, Icon: AudioLines },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dictation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo bài nghe, tự tách câu và sinh audio Kokoro cho từng câu.
          </p>
        </div>
        <Link
          href={`/${locale}/dictation/create`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Tạo bài Dictation
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{String(label)}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{String(value)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, chủ đề, level..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <p className="text-xs text-slate-400">{filtered.length} bài</p>
        </div>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center text-center">
            <FileAudio className="mb-3 h-9 w-9 text-slate-300" />
            <p className="font-semibold text-slate-700">Chưa có bài Dictation</p>
            <p className="mt-1 text-sm text-slate-400">Tạo bài đầu tiên và generate audio bằng Kokoro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bài luyện</th>
                  <th className="px-4 py-3 font-semibold">Level</th>
                  <th className="px-4 py-3 font-semibold">Audio</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((lesson) => (
                  <tr key={lesson._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-4">
                      <Link href={`/${locale}/dictation/${lesson._id}`} className="font-semibold text-slate-900 hover:text-blue-600">
                        {lesson.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span>{lesson.topic}</span>
                        <span>•</span>
                        <span>{lesson.sentenceCount} câu</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{lesson.level}</span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {lesson.totalDurationMs ? `${Math.round(lesson.totalDurationMs / 1000)}s` : 'Chưa generate'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[lesson.status]}`}>
                        {lesson.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {lesson.status === 'READY' && (
                          <button
                            onClick={() => publishMutation.mutate({ id: lesson._id, publish: true })}
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Publish
                          </button>
                        )}
                        {lesson.status === 'PUBLISHED' && (
                          <button
                            onClick={() => publishMutation.mutate({ id: lesson._id, publish: false })}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Unpublish
                          </button>
                        )}
                        <Link
                          href={`/${locale}/dictation/${lesson._id}`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Chi tiết
                        </Link>
                        <button
                          onClick={() => {
                            if (window.confirm(`Xóa bài "${lesson.title}"?`)) removeMutation.mutate(lesson._id);
                          }}
                          className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
