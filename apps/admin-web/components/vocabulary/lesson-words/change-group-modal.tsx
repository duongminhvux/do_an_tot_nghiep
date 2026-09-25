'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import { SectionItem } from '@/types/vocabulary';
import { EditingWordItem } from './types';

interface ChangeGroupModalProps {
  editingWordItem: EditingWordItem | null;
  onClose: () => void;
  sections: SectionItem[];
  onSelectSection: (wordId: string, sectionId: string | null) => void;
  isPending: boolean;
}

export function ChangeGroupModal({
  editingWordItem,
  onClose,
  sections,
  onSelectSection,
  isPending,
}: ChangeGroupModalProps) {
  const { t } = useTranslation('vocabulary');

  if (!editingWordItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-xs w-full space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-sm text-slate-900 truncate">
            {t('change_group_for_word', { word: editingWordItem.word })}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onSelectSection(editingWordItem.wordId, null)}
            className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              !editingWordItem.currentSecId
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span>{t('unassigned_label', 'Chưa phân nhóm')}</span>
            {!editingWordItem.currentSecId && <Check className="w-3.5 h-3.5 text-amber-600" />}
          </button>

          {sections.map((s) => {
            const isCur = editingWordItem.currentSecId === s._id;

            return (
              <button
                key={s._id}
                type="button"
                disabled={isPending}
                onClick={() => onSelectSection(editingWordItem.wordId, s._id)}
                className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isCur
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>{s.name}</span>
                </div>
                {isCur && <Check className="w-3.5 h-3.5 text-purple-600" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {t('close', 'Đóng')}
          </button>
        </div>
      </div>
    </div>
  );
}
