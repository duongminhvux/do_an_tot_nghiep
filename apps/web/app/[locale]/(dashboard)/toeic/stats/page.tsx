'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Headphones,
  BookOpen,
  Award,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { toeicService, ToeicAttemptSummary } from '@/services/toeic.service';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function ToeicStatsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const [targetScore, setTargetScore] = useState<number>(750);

  const { data, isLoading } = useQuery({
    queryKey: ['toeic-attempts'],
    queryFn: () => toeicService.getAttempts({ limit: 50 }),
    staleTime: 30_000,
  });

  const rawAttempts = unwrap<any>(data);
  const attempts: ToeicAttemptSummary[] = Array.isArray(rawAttempts)
    ? rawAttempts
    : Array.isArray(rawAttempts?.data)
    ? rawAttempts.data
    : [];

  const analysis = useMemo(() => {
    if (!attempts.length) {
      return {
        total: 0,
        highest: 0,
        avgScore: 0,
        avgListening: 0,
        avgReading: 0,
        listeningPercent: 0,
        readingPercent: 0,
        progressPercent: 0,
      };
    }

    const scores = attempts.map((a) => a.score || 0);
    const highest = Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const listenings = attempts.map((a) => a.listeningScore || 0);
    const avgListening = Math.round(listenings.reduce((a, b) => a + b, 0) / listenings.length);

    const readings = attempts.map((a) => a.readingScore || 0);
    const avgReading = Math.round(readings.reduce((a, b) => a + b, 0) / readings.length);

    const listeningPercent = Math.min(100, Math.round((avgListening / 495) * 100));
    const readingPercent = Math.min(100, Math.round((avgReading / 495) * 100));
    const progressPercent = Math.min(100, Math.round((highest / targetScore) * 100));

    return {
      total: attempts.length,
      highest,
      avgScore,
      avgListening,
      avgReading,
      listeningPercent,
      readingPercent,
      progressPercent,
    };
  }, [attempts, targetScore]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <BarChart3 className="h-3.5 w-3.5" /> Báo cáo năng lực
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
              Thống kê & Phân tích TOEIC
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi sự tiến bộ giữa 2 kỹ năng Listening & Reading qua các bài thi thử.
            </p>
          </div>
          <Link
            href={`/${locale}/toeic`}
            className="inline-flex items-center gap-2 rounded bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
          >
            <GraduationCap className="h-4 w-4" />
            Luyện thêm đề thi
          </Link>
        </div>

        {/* Target Band Setting Card */}
        <div className="rounded border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Mục tiêu điểm số
              </span>
              <h3 className="text-xl font-black text-slate-900">
                Mục tiêu: {targetScore}+ TOEIC
              </h3>
              <p className="text-xs text-slate-600">
                {analysis.highest >= targetScore
                  ? '🎉 Chúc mừng! Bạn đã đạt hoặc vượt mục tiêu điểm số đặt ra!'
                  : `Bạn còn cách mục tiêu ${Math.max(0, targetScore - analysis.highest)} điểm nữa.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Đổi mục tiêu:</span>
              {[550, 650, 750, 850, 950].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTargetScore(val)}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                    targetScore === val
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {val}+
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Tiến độ hoàn thành mục tiêu</span>
              <span>{analysis.progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                style={{ width: `${analysis.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2 Main Skill Breakdown Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Listening Skill */}
          <div className="rounded border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-blue-600">
                  <Headphones className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Listening Comprehension</h3>
                  <p className="text-xs text-slate-400">Part 1, 2, 3, 4 (Tối đa 495 điểm)</p>
                </div>
              </div>
              <span className="text-2xl font-black text-blue-600">
                {analysis.avgListening || 0}
                <span className="text-xs text-slate-400 font-normal">/495</span>
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Mức độ thông thạo</span>
                  <span>{analysis.listeningPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${analysis.listeningPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed border border-slate-100">
                💡 <span className="font-semibold text-slate-800">Lời khuyên:</span> Hãy luyện nghe chép chính tả (Dictation) hàng ngày và tập trung nghe bắt từ khóa (keywords) trong Part 3 & Part 4 để tối ưu thời gian đọc trước câu hỏi.
              </div>
            </div>
          </div>

          {/* Reading Skill */}
          <div className="rounded border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-emerald-50 text-emerald-600">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reading Comprehension</h3>
                  <p className="text-xs text-slate-400">Part 5, 6, 7 (Tối đa 495 điểm)</p>
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-600">
                {analysis.avgReading || 0}
                <span className="text-xs text-slate-400 font-normal">/495</span>
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Mức độ thông thạo</span>
                  <span>{analysis.readingPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${analysis.readingPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed border border-slate-100">
                💡 <span className="font-semibold text-slate-800">Lời khuyên:</span> Phân bổ thời gian Part 5 (12 phút), Part 6 (8 phút) để dành trọn vẹn 55 phút cho các đoạn văn đơn và kép trong Part 7.
              </div>
            </div>
          </div>
        </div>

        {/* Progress Timeline Table */}
        <div className="rounded border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Tiến trình các bài thi gần đây</h2>
            <Link
              href={`/${locale}/toeic/history`}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              Xem tất cả →
            </Link>
          </div>

          {isLoading ? (
            <div className="flex min-h-[180px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Đang tải thống kê...</span>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-700">Chưa đủ dữ liệu thống kê</p>
              <p className="mt-1 text-xs text-slate-400">
                Làm ít nhất 1 bài thi thử để hệ thống vẽ biểu đồ và phân tích năng lực chi tiết.
              </p>
              <Link
                href={`/${locale}/toeic`}
                className="mt-4 inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Vào làm bài thi ngay
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attempts.slice(0, 5).map((att, idx) => {
                const exam =
                  typeof att.examId === 'object' && att.examId ? (att.examId as any) : null;
                const dateStr = att.completedAt || att.createdAt;
                return (
                  <div
                    key={att._id || idx}
                    className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {exam?.title || `Bài thi #${attempts.length - idx}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '—'}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Nghe / Đọc</span>
                        <span className="text-xs font-bold text-slate-700">
                          {att.listeningScore || 0} / {att.readingScore || 0}
                        </span>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <span className="text-base font-black text-blue-600">
                          {att.score || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block -mt-1">/990</span>
                      </div>
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
