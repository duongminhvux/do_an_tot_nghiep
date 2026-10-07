'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Award } from 'lucide-react';
import { ToeicAttemptSummary } from '@/services/toeic.service';
import { cn } from '@/lib/utils';

interface LeaderboardItem {
  rank: number;
  name: string;
  avatarColor: string;
  badge: string;
  listening: number;
  reading: number;
  totalScore: number;
  durationMinutes: number;
  date: string;
}

const LEADERBOARD_DATA: LeaderboardItem[] = [
  {
    rank: 1,
    name: 'Nguyễn Hoàng Nam',
    avatarColor: 'bg-amber-500',
    badge: '950+ Club',
    listening: 485,
    reading: 470,
    totalScore: 955,
    durationMinutes: 104,
    date: '2 ngày trước',
  },
  {
    rank: 2,
    name: 'Trần Thị Mai Anh',
    avatarColor: 'bg-slate-400',
    badge: '900+ Club',
    listening: 475,
    reading: 460,
    totalScore: 935,
    durationMinutes: 112,
    date: '3 ngày trước',
  },
  {
    rank: 3,
    name: 'Lê Minh Tuấn',
    avatarColor: 'bg-amber-700',
    badge: '900+ Club',
    listening: 460,
    reading: 450,
    totalScore: 910,
    durationMinutes: 115,
    date: '4 ngày trước',
  },
  {
    rank: 4,
    name: 'Phạm Quốc Huy',
    avatarColor: 'bg-blue-600',
    badge: '850+ Club',
    listening: 455,
    reading: 440,
    totalScore: 895,
    durationMinutes: 118,
    date: '5 ngày trước',
  },
  {
    rank: 5,
    name: 'Đỗ Thu Thảo',
    avatarColor: 'bg-emerald-600',
    badge: '850+ Club',
    listening: 445,
    reading: 430,
    totalScore: 875,
    durationMinutes: 109,
    date: '1 tuần trước',
  },
];

interface ExamLeaderboardProps {
  rawAttempts: ToeicAttemptSummary[];
}

export function ExamLeaderboard({ rawAttempts }: ExamLeaderboardProps) {
  const { t } = useTranslation('toeic');
  const [leaderboardTab, setLeaderboardTab] = useState<'ranking' | 'history'>('ranking');

  return (
    <div className="rounded border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-50 text-amber-600">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('exam_detail.leaderboard_title')}</h2>
            <p className="text-xs text-slate-500">Bảng xếp hạng điểm cao và lịch sử làm bài</p>
          </div>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center gap-1 rounded bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setLeaderboardTab('ranking')}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
              leaderboardTab === 'ranking'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {t('exam_detail.tab_top_ranking')}
          </button>
          <button
            type="button"
            onClick={() => setLeaderboardTab('history')}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer',
              leaderboardTab === 'history'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {t('exam_detail.tab_my_history')}
            {rawAttempts.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                {rawAttempts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {leaderboardTab === 'ranking' ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 text-left w-16">{t('exam_detail.col_rank')}</th>
                <th className="px-4 py-3 text-left">{t('exam_detail.col_candidate')}</th>
                <th className="px-4 py-3 text-center">{t('exam_detail.col_listening')}</th>
                <th className="px-4 py-3 text-center">{t('exam_detail.col_reading')}</th>
                <th className="px-4 py-3 text-center">{t('exam_detail.col_total_score')}</th>
                <th className="px-4 py-3 text-center">{t('exam_detail.col_duration')}</th>
                <th className="px-5 py-3 text-right">{t('exam_detail.col_date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {LEADERBOARD_DATA.map((item) => {
                const rankBadge =
                  item.rank === 1 ? '🥇 #1' :
                  item.rank === 2 ? '🥈 #2' :
                  item.rank === 3 ? '🥉 #3' : `#${item.rank}`;
                const rankStyle =
                  item.rank === 1 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  item.rank === 2 ? 'bg-slate-100 text-slate-700 border-slate-200' :
                  item.rank === 3 ? 'bg-amber-50 text-amber-900 border-amber-100' :
                  'bg-slate-50 text-slate-500 border-slate-200';

                return (
                  <tr key={item.rank} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold border', rankStyle)}>
                        {rankBadge}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs', item.avatarColor)}>
                          {item.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {item.badge}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                      {item.listening}/495
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-600">
                      {item.reading}/495
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-extrabold text-blue-600 text-base">{item.totalScore}</span>
                      <span className="text-xs text-slate-400">/990</span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-500">
                      {item.durationMinutes} phút
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                      {item.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* History Tab */
        <div className="p-6">
          {rawAttempts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">Lần làm</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-center">Điểm số</th>
                    <th className="px-4 py-3 text-center">Thời gian</th>
                    <th className="px-4 py-3 text-right">Ngày nộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {rawAttempts.map((att, idx) => (
                    <tr key={att._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-700">
                        Lần {rawAttempts.length - idx}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
                          att.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        )}>
                          {att.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang làm'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-blue-600">
                        {att.score ?? '—'} / 990
                      </td>
                      <td className="px-4 py-3.5 text-center text-xs text-slate-500">
                        {att.durationSpent ? `${Math.round(att.durationSpent / 60)} phút` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-slate-400">
                        {att.completedAt ? new Date(att.completedAt).toLocaleDateString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">{t('exam_detail.no_history_title')}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">{t('exam_detail.no_history_desc')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
