'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionItem } from '@/types/vocabulary';
import { Panel } from '@/components/ui/page';

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

  const tiles = [
    { value: collection?.lessonsCount || lessonsCount, label: t('collection_detail.stat_lessons') },
    { value: totalWordsCount, label: t('collection_detail.stat_words') },
    { value: groupName || 'General', label: t('collection_detail.stat_group') },
  ];

  return (
    <Panel title={t('collection_detail.about_title', { name: collection?.name || '' })} bodyClassName="space-y-4">
      {collection?.description ? (
        <p className="text-sm leading-relaxed text-slate-600">
          {collection.description}
        </p>
      ) : (
        <p className="text-sm italic text-slate-400">
          {t('collection_detail.no_description')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
        {tiles.map((tile, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="truncate text-lg font-bold text-slate-900">{tile.value}</p>
            <p className="text-xs font-medium text-slate-500">{tile.label}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
