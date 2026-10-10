'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Headphones, Loader2, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { DictationLessonSummary, DictationProgressOverview } from '@/types/dictation';

function unwrap<T>(value: any): T { return (value?.data ?? value) as T; }

export default function DictationProgressPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { data, isLoading } = useQuery({ queryKey: ['dictation-progress-overview'], queryFn: () => dictationService.getProgressOverview() });
  const overview = unwrap<DictationProgressOverview>(data) || { totalStarted: 0, completed: 0, totalCorrect: 0, totalAttempts: 0, items: [] };
  const accuracy = overview.totalAttempts ? Math.round((overview.totalCorrect / overview.totalAttempts) * 100) : 0;
  const statCards: Array<{ label: string; value: string | number; Icon: LucideIcon }> = [
    { label: 'Đã bắt đầu', value: overview.totalStarted, Icon: Headphones },
    { label: 'Hoàn thành', value: overview.completed, Icon: CheckCircle2 },
    { label: 'Câu đúng', value: overview.totalCorrect, Icon: Target },
    { label: 'Độ chính xác', value: `${accuracy}%`, Icon: BarChart3 },
  ];

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải tiến độ...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Tiến độ Dictation</h1><p className="mt-1 text-sm text-slate-500">Theo dõi các bài đã luyện và độ chính xác.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-slate-500">{String(label)}</p><p className="mt-1 text-2xl font-bold text-slate-900">{String(value)}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div></div></div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Bài đã luyện</h2></div>
          {overview.items.length === 0 ? (
            <div className="p-12 text-center"><Headphones className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Chưa có tiến độ</p><Link href={`/${locale}/dictation`} className="mt-3 inline-block text-xs font-bold text-blue-600">Chọn bài để bắt đầu →</Link></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.items.map((progress) => {
                const lesson = progress.lessonId as DictationLessonSummary;
                if (!lesson || typeof lesson === 'string') return null;
                const handled = new Set([...(progress.completedSegments || []), ...(progress.revealedSegments || [])]).size;
                const percent = lesson.sentenceCount ? Math.round((handled / lesson.sentenceCount) * 100) : 0;
                const rowAccuracy = progress.attempts ? Math.round((progress.correctCount / progress.attempts) * 100) : 0;
                return (
                  <Link key={progress._id || lesson._id} href={`/${locale}/dictation/${lesson.slug}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_130px_130px] sm:items-center">
                    <div><p className="text-sm font-bold text-slate-800">{lesson.title}</p><p className="mt-1 text-xs text-slate-400">{lesson.level} · {lesson.topic}</p><div className="mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>
                    <div><p className="text-[11px] text-slate-400">Hoàn thành</p><p className="mt-1 text-sm font-bold text-slate-700">{handled}/{lesson.sentenceCount} câu</p></div>
                    <div><p className="text-[11px] text-slate-400">Chính xác</p><p className="mt-1 text-sm font-bold text-slate-700">{rowAccuracy}%</p></div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
