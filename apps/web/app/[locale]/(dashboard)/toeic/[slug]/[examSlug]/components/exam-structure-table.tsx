'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Headphones, BookOpen } from 'lucide-react';
import { ToeicExamPart } from '@/services/toeic.service';
import { surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

interface ExamStructureTableProps {
  parts: ToeicExamPart[];
  partTimeMap: Record<number, number>;
}

const sections = [
  { key: 'LISTENING', label: 'Listening', icon: Headphones, tone: 'text-blue-600' },
  { key: 'READING', label: 'Reading', icon: BookOpen, tone: 'text-emerald-600' },
] as const;

export function ExamStructureTable({ parts, partTimeMap }: ExamStructureTableProps) {
  const { t } = useTranslation('toeic');
  const minutes = t('exam_detail.minutes', 'phút');
  const totalQuestions = parts.reduce((sum, p) => sum + p.totalQuestions, 0);
  const totalMinutes = parts.reduce((sum, p) => sum + (partTimeMap[p.part] ?? 0), 0);

  return (
    <section aria-labelledby="exam-structure-title" className={cn(surface, 'overflow-hidden')}>
      <h2 id="exam-structure-title" className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
        {t('exam_detail.structure_title')}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th scope="col" className="px-3 sm:px-5 py-2.5 text-left font-medium">{t('exam_detail.col_part')}</th>
              <th scope="col" className="px-2 sm:px-4 py-2.5 text-left font-medium">{t('exam_detail.col_type')}</th>
              <th scope="col" className="px-2 sm:px-4 py-2.5 text-right font-medium">{t('exam_detail.col_questions')}</th>
              <th scope="col" className="px-3 sm:px-5 py-2.5 text-right font-medium">{t('exam_detail.col_time', 'Thời gian')}</th>
            </tr>
          </thead>
          {sections.map((section) => {
            const rows = parts.filter((p) => p.section === section.key);
            if (!rows.length) return null;
            const Icon = section.icon;
            return (
              <tbody key={section.key} className="border-b border-slate-100 last:border-b-0">
                {/* One section label instead of a badge on every row. */}
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={4}
                    className={cn('px-3 sm:px-5 pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wider', section.tone)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {section.label}
                    </span>
                  </th>
                </tr>
                {rows.map((p) => (
                  <tr key={p._id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 sm:px-5 py-2.5 font-medium text-slate-800">Part {p.part}</td>
                    <td className="px-2 sm:px-4 py-2.5 text-slate-600">{p.type}</td>
                    <td className="px-2 sm:px-4 py-2.5 text-right text-slate-700 tabular-nums">{p.totalQuestions}</td>
                    <td className="whitespace-nowrap px-3 sm:px-5 py-2.5 text-right text-slate-500 tabular-nums">
                      {partTimeMap[p.part] ?? 0} {minutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <td colSpan={2} className="px-3 sm:px-5 py-2.5">{t('exam_detail.total', 'Tổng')}</td>
              <td className="px-2 sm:px-4 py-2.5 text-right tabular-nums">{totalQuestions}</td>
              <td className="whitespace-nowrap px-3 sm:px-5 py-2.5 text-right tabular-nums">
                {totalMinutes} {minutes}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
