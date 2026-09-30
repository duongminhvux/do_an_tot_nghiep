'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionItem } from '@/types/vocabulary';

interface CollectionAboutTabProps {
  collection: CollectionItem | null;
  lessonsCount: number;
  totalWordsCount: number;
  groupName: string;
}

export function CollectionAboutTab({
  collection,
  lessonsCount,
  totalWordsCount,
  groupName,
}: CollectionAboutTabProps) {
  const { t } = useTranslation('vocabulary');

  return (
    <div className="rounded border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <h3 className="text-base font-bold text-slate-900">
        {t('collection_detail.about_title', { name: collection?.name || '' })}
      </h3>
      {collection?.description ? (
        <p className="text-sm text-slate-600 leading-relaxed">
          {collection.description}
        </p>
      ) : (
        <p className="text-sm text-slate-400 italic">
          {t('collection_detail.no_description')}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3 rounded bg-blue-50/60 border border-blue-100 text-center">
          <p className="text-lg font-black text-slate-900">
            {collection?.lessonsCount || lessonsCount}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            {t('collection_detail.stat_lessons')}
          </p>
        </div>
        <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100 text-center">
          <p className="text-lg font-black text-slate-900">
            {totalWordsCount}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            {t('collection_detail.stat_words')}
          </p>
        </div>
        <div className="p-3 rounded bg-amber-50/60 border border-amber-100 text-center">
          <p className="text-lg font-black text-slate-900">
            {groupName || 'General'}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            {t('collection_detail.stat_group')}
          </p>
        </div>
      </div>
    </div>
  );
}
