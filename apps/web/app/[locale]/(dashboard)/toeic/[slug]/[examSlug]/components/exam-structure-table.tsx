'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Headphones, BookOpen } from 'lucide-react';
import { ToeicExamPart } from '@/services/toeic.service';

interface ExamStructureTableProps {
  parts: ToeicExamPart[];
  partTimeMap: Record<number, number>;
}

export function ExamStructureTable({ parts, partTimeMap }: ExamStructureTableProps) {
  const { t } = useTranslation('toeic');

  return (
    <div>
      <h2 className="mb-3 text-base font-bold text-slate-900">{t('exam_detail.structure_title')}</h2>
      <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 text-left">{t('exam_detail.col_section')}</th>
              <th className="px-4 py-3 text-left">{t('exam_detail.col_part')}</th>
              <th className="px-4 py-3 text-left">{t('exam_detail.col_type')}</th>
              <th className="px-4 py-3 text-right">{t('exam_detail.col_questions')}</th>
              <th className="px-5 py-3 text-right">{t('exam_detail.col_time', 'Thời gian')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {parts.map((p) => {
              const isL = p.section === 'LISTENING';
              const partTime = partTimeMap[p.part] ?? 0;
              return (
                <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    {isL ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700">
                        <Headphones className="h-3 w-3" />
                        LISTENING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        <BookOpen className="h-3 w-3" />
                        READING
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">Part {p.part}</td>
                  <td className="px-4 py-3.5 text-blue-600 font-medium">{p.type}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{p.totalQuestions}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-600 whitespace-nowrap">
                    {partTime} {t('exam_detail.minutes', 'phút')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
