'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  GraduationCap,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Headphones,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { toeicService, ToeicAttemptSummary, ToeicExamSummary } from '@/services/toeic.service';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function ToeicHistoryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';

  const { data, isLoading } = useQuery({
    queryKey: ['toeic-attempts'],
    queryFn: () => toeicService.getAttempts({ limit: 100 }),
    staleTime: 15_000,
  });

  const rawAttempts = unwrap<any>(data);
  const attempts: ToeicAttemptSummary[] = Array.isArray(rawAttempts)
    ? rawAttempts
    : Array.isArray(rawAttempts?.data)
    ? rawAttempts.data
    : [];

  const stats = useMemo(() => {
    if (!attempts.length) {
      return { total: 0, highest: 0, avg: 0, totalCorrect: 0 };
    }
    const scores = attempts.map((a) => a.score || 0);
    const highest = Math.max(...scores);
    const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    const totalCorrect = attempts.reduce((sum, a) => sum + (a.totalCorrect || 0), 0);
    return {
      total: attempts.length,
      highest,
      avg,
      totalCorrect,
    };
  }, [attempts]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <History className="h-3.5 w-3.5" /> Luyện thi TOEIC
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
              Lịch sử làm bài
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Xem lại danh sách tất cả các bài thi thử TOEIC bạn đã thực hiện và theo dõi điểm số.
            </p>
          </div>
          <Link
            href={`/${locale}/toeic`}
            className="inline-flex items-center gap-2 rounded bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
          >
            <GraduationCap className="h-4 w-4" />
            Làm đề mới
          </Link>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Tổng lượt thi</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-600">
                <History className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Điểm cao nhất</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {stats.highest > 0 ? `${stats.highest}/990` : '—'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-50 text-emerald-600">
                <Award className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Điểm trung bình</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stats.avg > 0 ? `${stats.avg}/990` : '—'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-50 text-amber-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Tổng câu đúng</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalCorrect}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded bg-purple-50 text-purple-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Attempt History List */}
        <div className="rounded border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Danh sách bài đã hoàn thành</h2>
            <span className="text-xs font-medium text-slate-400">{attempts.length} lượt thi</span>
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Đang tải lịch sử...</span>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-blue-50 text-blue-600">
                <History className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">Chưa có lịch sử làm bài</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Bạn chưa hoàn thành bài thi thử TOEIC nào. Hãy bắt đầu một đề thi ngay hôm nay!
              </p>
              <Link
                href={`/${locale}/toeic`}
                className="mt-4 inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Bắt đầu làm bài thi →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attempts.map((attempt) => {
                const exam =
                  typeof attempt.examId === 'object' && attempt.examId
                    ? (attempt.examId as ToeicExamSummary)
                    : null;
                const examTitle = exam?.name || 'Đề thi TOEIC';
                const examCode = 'TOEIC';
                const dateStr = attempt.completedAt || attempt.createdAt;
                const formattedDate = dateStr
                  ? new Date(dateStr).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <div
                    key={attempt._id}
                    className="grid gap-4 p-5 transition hover:bg-slate-50/80 sm:grid-cols-[minmax(0,1fr)_120px_160px_100px] sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {examCode}
                        </span>
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{examTitle}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formattedDate}
                        </span>
                        {attempt.durationSpent && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.round(attempt.durationSpent / 60)} phút
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Số câu đúng</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-700">
                        {attempt.totalCorrect || 0}/{attempt.totalQuestions || 200}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-400">Listening / Reading</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1 text-blue-600">
                          <Headphones className="h-3 w-3" /> {attempt.listeningScore || 0}
                        </span>
                        <span>/</span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <BookOpen className="h-3 w-3" /> {attempt.readingScore || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="text-right">
                        <span className="text-lg font-black text-blue-600">
                          {attempt.score ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block -mt-1">/990</span>
                      </div>
                      <Link
                        href={`/${locale}/toeic/history/${attempt._id}`}
                        className="rounded-lg p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Xem chi tiết kết quả"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
