'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExamItem } from '@/types';
import { Info } from 'lucide-react';

interface ExamStructureSidebarProps {
  exam: ExamItem;
}

export function ExamStructureSidebar({ exam }: ExamStructureSidebarProps) {
  const { t } = useTranslation('assessment');

  return (
    <div className="lg:col-span-4 xl:col-span-3 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {t('detailPage.sideStructureTitleFull')}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {exam.type || 'TOEIC'} • {exam.durationMinutes || 120} {t('table.minutes')}
          </p>
        </div>

        <div className="space-y-2.5">
          {/* Part 1 (Listening) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part1Title')}
              </span>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                Part 1
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part1Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part1Desc')}
            </p>
          </div>

          {/* Part 2 (Listening) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part2Title')}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Part 2
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part2Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part2Desc')}
            </p>
          </div>

          {/* Part 3 (Listening) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part3Title')}
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Part 3
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part3Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part3Desc')}
            </p>
          </div>

          {/* Part 4 (Listening) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part4Title')}
              </span>
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Part 4
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part4Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part4Desc')}
            </p>
          </div>

          {/* Part 5 (Reading) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part5Title')}
              </span>
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                Part 5
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part5Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part5Desc')}
            </p>
          </div>

          {/* Part 6 (Reading) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part6Title')}
              </span>
              <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                Part 6
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part6Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part6Desc')}
            </p>
          </div>

          {/* Part 7 (Reading) */}
          <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                {t('detailPage.structure.part7Title')}
              </span>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                Part 7
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('detailPage.structure.part7Meta')}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
              {t('detailPage.structure.part7Desc')}
            </p>
          </div>
        </div>

        {/* Full test summary notice */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
              <div className="text-xs font-bold text-blue-900">
                {t('detailPage.structure.listeningSection')}
              </div>
              <div className="text-[11px] text-slate-500">
                {t('detailPage.structure.listeningSectionMeta')}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 space-y-1">
              <div className="text-xs font-bold text-teal-900">
                {t('detailPage.structure.readingSection')}
              </div>
              <div className="text-[11px] text-slate-500">
                {t('detailPage.structure.readingSectionMeta')}
              </div>
          </div>
        </div>

        {/* Blue Callout: Về đoạn hội thoại / bài đọc */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold">
            <Info className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{t('detailPage.sideCalloutTitle')}</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
            {t('detailPage.sideCalloutDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
