'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionItem } from '@/types/vocabulary';
import { Pencil, Trash2, Plus } from 'lucide-react';

interface GroupsSidebarProps {
  sections: SectionItem[];
  lessonWordsCount: number;
  sectionCounts: Record<string, number>;
  filterSection: string;
  setFilterSection: (secId: string) => void;
  onUpdateSection: (sectionId: string, name: string) => void;
  onDeleteSectionRequest: (sectionId: string, sectionName: string) => void;
  onOpenCreateGroupModal?: () => void;
}

export function GroupsSidebar({
  sections,
  lessonWordsCount,
  sectionCounts,
  filterSection,
  setFilterSection,
  onUpdateSection,
  onDeleteSectionRequest,
  onOpenCreateGroupModal,
}: GroupsSidebarProps) {
  const { t } = useTranslation('vocabulary');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const handleStartEdit = (sec: SectionItem) => {
    setEditingSectionId(sec._id);
    setEditingSectionName(sec.name);
  };

  const handleSaveEdit = (secId: string) => {
    if (editingSectionName.trim()) {
      onUpdateSection(secId, editingSectionName.trim());
    }
    setEditingSectionId(null);
  };

  return (
    <div className="lg:col-span-3 flex flex-col justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-y-auto">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              {t('vocab_groups_title', 'Nhóm từ vựng')}
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {t('vocab_groups_desc', 'Nhóm là tùy chọn. Bạn có thể để từ vựng ở trạng thái chưa phân nhóm.')}
            </p>
          </div>
          {onOpenCreateGroupModal && (
            <button
              type="button"
              onClick={onOpenCreateGroupModal}
              className="p-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors cursor-pointer shrink-0"
              title={t('btn_create_group', 'Tạo nhóm mới')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          {/* Tất cả từ vựng button */}
          <button
            type="button"
            onClick={() => setFilterSection('all')}
            className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              filterSection === 'all'
                ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-xs'
                : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{t('all_words_pill', 'Tất cả từ vựng')}</span>
            </div>
            <span className="text-[11px] text-slate-400">({lessonWordsCount})</span>
          </button>

          {/* Danh sách các nhóm */}
          {sections.map((sec) => {
            const count = sectionCounts[sec._id] || 0;
            const isActive = filterSection === sec._id;
            const isInlineEditing = editingSectionId === sec._id;

            if (isInlineEditing) {
              return (
                <div key={sec._id} className="p-2 rounded-xl border border-purple-300 bg-purple-50/50 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-purple-200 bg-white"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingSectionId(null)}
                      className="px-2 py-0.5 text-[11px] text-slate-500"
                    >
                      {t('cancel', 'Hủy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(sec._id)}
                      className="px-2.5 py-0.5 text-[11px] bg-purple-600 text-white rounded-md font-semibold"
                    >
                      {t('save', 'Lưu')}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={sec._id}
                className={`group w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  isActive
                    ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-xs'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFilterSection(isActive ? 'all' : sec._id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-purple-500" />
                  <span className="truncate">{sec.name}</span>
                  <span className="text-[11px] text-slate-400 font-normal">({count})</span>
                </button>

                {/* Sửa / Xóa nhóm khi hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(sec);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title={t('edit_group', 'Đổi tên')}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSectionRequest(sec._id, sec.name);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    title={t('delete_group', 'Xóa nhóm')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nút Tạo nhóm dưới chân sidebar */}
      {onOpenCreateGroupModal && (
        <button
          type="button"
          onClick={onOpenCreateGroupModal}
          className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-purple-300 hover:border-purple-400 bg-purple-50/60 hover:bg-purple-100 active:bg-purple-200 text-purple-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('btn_create_group', 'Tạo nhóm mới')}</span>
        </button>
      )}
    </div>
  );
}
