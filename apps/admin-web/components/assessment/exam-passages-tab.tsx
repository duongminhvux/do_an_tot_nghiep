'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PassageItem } from '@/types';

interface ExamPassagesTabProps {
  passagesList: PassageItem[];
}

export function ExamPassagesTab({ passagesList }: ExamPassagesTabProps) {
  const { t } = useTranslation('assessment');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">
          {t('detailPage.passagesListTitle', { count: passagesList.length })}
        </h3>
      </div>

      {passagesList.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          {t('detailPage.noPassagesDesc')}
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {passagesList.map((p) => (
            <div
              key={p._id}
              className="p-4 rounded-xl border border-slate-200/80 hover:border-blue-300 transition-colors bg-slate-50/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-xs">
                    {p.title || `Passage ${p.order}`}
                  </span>
                </div>
                <span className="text-slate-400">{p.section}</span>
              </div>
              {p.content && <p className="text-slate-600 text-xs">{p.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
