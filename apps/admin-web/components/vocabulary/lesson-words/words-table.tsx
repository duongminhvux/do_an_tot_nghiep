'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionItem } from '@/types/vocabulary';
import { EditingWordItem } from './types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Volume2,
  Loader2,
  Check,
  Info,
} from 'lucide-react';

interface WordsTableProps {
  isLoadingLessonWords: boolean;
  lessonWords: any[];
  filteredWords: any[];
  sections: SectionItem[];
  filterSection: string;
  unassignedWordsCount: number;
  selectedWordIds: string[];
  setSelectedWordIds: React.Dispatch<React.SetStateAction<string[]>>;
  onOpenAddWordModal: () => void;
  onResetFilters: () => void;
  onBulkMove: (sectionId: string | null) => void;
  isBulkMoving: boolean;
  onBulkDeleteRequest: (count: number) => void;
  onSingleDeleteRequest: (wordId: string, wordName: string) => void;
  onEditWordSection: (item: EditingWordItem) => void;
}

export function WordsTable({
  isLoadingLessonWords,
  lessonWords,
  filteredWords,
  sections,
  filterSection,
  unassignedWordsCount,
  selectedWordIds,
  setSelectedWordIds,
  onOpenAddWordModal,
  onResetFilters,
  onBulkMove,
  isBulkMoving,
  onBulkDeleteRequest,
  onSingleDeleteRequest,
  onEditWordSection,
}: WordsTableProps) {
  const { t } = useTranslation('vocabulary');

  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('Audio playback failed', err);
    }
  };

  const handleToggleSelectRow = (wordId: string) => {
    setSelectedWordIds((prev) =>
      prev.includes(wordId) ? prev.filter((id) => id !== wordId) : [...prev, wordId]
    );
  };

  const handleSelectAllTable = () => {
    const visibleIds = filteredWords.map((item: any) => item.wordId?._id || item.wordId);
    const allSelected = visibleIds.every((id) => selectedWordIds.includes(id));
    if (allSelected) {
      setSelectedWordIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedWordIds, ...visibleIds]));
      setSelectedWordIds(combined);
    }
  };

  const getLevelBadge = (level?: string) => {
    if (!level) return null;
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (level === 'A1' || level === 'A2') {
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (level === 'B1' || level === 'B2') {
      colorClass = 'bg-sky-50 text-sky-700 border-sky-200';
    } else if (level === 'C1' || level === 'C2') {
      colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${colorClass} shrink-0`}>
        {level}
      </span>
    );
  };

  return (
    <div className="lg:col-span-9 flex flex-col overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
      {/* Header bảng hoặc Thanh Bulk Action */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
        {selectedWordIds.length > 0 ? (
          /* Bulk Action Bar */
          <div className="flex items-center justify-between w-full flex-wrap gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedWordIds([])}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>{t('selected_words_count', { count: selectedWordIds.length })}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedWordIds([])}
                className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                {t('clear_selection', 'Bỏ chọn')}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Đưa vào nhóm bằng shadcn Select */}
              <Select
                value=""
                onValueChange={(val) => {
                  if (val) onBulkMove(val);
                }}
                disabled={isBulkMoving}
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] rounded-lg text-xs font-semibold border-purple-200 bg-white text-purple-700">
                  <SelectValue placeholder={t('btn_assign_to_group', 'Đưa vào nhóm')} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Xóa khỏi nhóm */}
              <button
                type="button"
                onClick={() => onBulkMove(null)}
                disabled={isBulkMoving}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {t('btn_remove_from_group', 'Xóa khỏi nhóm')}
              </button>

              {/* Xóa khỏi bài học */}
              <button
                type="button"
                onClick={() => onBulkDeleteRequest(selectedWordIds.length)}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('delete', 'Xóa')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Subheader mặc định */
          <div className="flex items-center justify-between w-full gap-3">
            <span className="font-bold text-sm text-slate-900">
              {filterSection === 'all'
                ? `${t('all_words_pill', 'Tất cả từ vựng')} (${filteredWords.length})`
                : filterSection === 'unassigned'
                  ? `${t('unassigned_label', 'Chưa phân nhóm')} (${filteredWords.length})`
                  : `${sections.find((s) => s._id === filterSection)?.name || t('th_group', 'Nhóm')} (${filteredWords.length})`}
            </span>

            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>{t('unassigned_count_badge', { count: unassignedWordsCount })}</span>
            </span>
          </div>
        )}
      </div>

      {/* Bảng từ vựng */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoadingLessonWords ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">{t('loading_words', 'Đang tải danh sách từ vựng...')}</span>
          </div>
        ) : lessonWords.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3.5 shadow-xs">
              <BookOpen className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-base text-slate-900 mb-1">
              {t('empty_words_title', 'Chưa có từ vựng')}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {t('empty_words_desc', 'Thêm từ vựng đầu tiên để bắt đầu xây dựng nội dung cho bài học.')}
            </p>
            <button
              type="button"
              onClick={onOpenAddWordModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_words_btn', 'Thêm từ vựng')}</span>
            </button>
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Search className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              {t('no_filtered_words_title', 'Không tìm thấy từ vựng phù hợp')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t('no_filtered_words_desc', 'Thử đặt lại từ khóa tìm kiếm hoặc bộ lọc.')}
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              {t('reset_filters', 'Đặt lại bộ lọc')}
            </button>
          </div>
        ) : (
          /* Bảng từ vựng chuẩn */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredWords.length > 0 &&
                        filteredWords.every((item: any) =>
                          selectedWordIds.includes(item.wordId?._id || item.wordId)
                        )
                      }
                      onChange={handleSelectAllTable}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      title={t('select_all', 'Chọn tất cả')}
                    />
                  </th>
                  <th className="py-2.5 px-4">{t('th_word', 'Từ vựng')}</th>
                  <th className="py-2.5 px-3 w-20">{t('th_level', 'Trình độ')}</th>
                  <th className="py-2.5 px-4 min-w-[130px] whitespace-nowrap">{t('th_phonetic', 'Phiên âm')}</th>
                  <th className="py-2.5 px-4">{t('th_meaning', 'Nghĩa')}</th>
                  <th className="py-2.5 px-4 w-36">{t('th_group', 'Nhóm')}</th>
                  <th className="py-2.5 px-4 w-24 text-right">{t('th_actions', 'Thao tác')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredWords.map((item: any) => {
                  const w = item.wordId || {};
                  const wordId = w._id || item.wordId;
                  const audioUrl = w.audio?.us || w.audio?.uk;
                  const secId = item.sectionId?._id || item.sectionId;
                  const sectionObj = sections.find((s) => s._id === secId);
                  const isSelected = selectedWordIds.includes(wordId);
                  const rawIpa = (w.ipa?.us || w.ipa?.uk || '').trim();
                  const displayIpa = rawIpa ? rawIpa.replace(/^\/\s+/, '/').replace(/\s+\/$/, '/') : '—';

                  return (
                    <tr
                      key={item._id || wordId}
                      className={`transition-colors group ${
                        isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(wordId)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-sm">
                          {w.word || 'Unknown'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {getLevelBadge(w.level)}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                        {displayIpa}
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        <p className="max-w-[80%]">
                          {w.parts?.[0]?.meanings?.[0]?.translation?.[0] ||
                            w.parts?.[0]?.meanings?.[0]?.definition ||
                            '—'}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        {sectionObj ? (
                          <button
                            type="button"
                            onClick={() => onEditWordSection({ wordId, currentSecId: secId, word: w.word })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                            title={t('change_group_title', 'Nhấn để đổi nhóm')}
                          >
                            <span>{sectionObj.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEditWordSection({ wordId, currentSecId: null, word: w.word })}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 cursor-pointer"
                            title={t('assign_group', 'Nhấn để gán nhóm')}
                          >
                            {t('unassigned_label', 'Chưa phân nhóm')}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {audioUrl && (
                            <button
                              type="button"
                              onClick={() => handlePlayAudio(audioUrl)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title={t('play_us', 'Phát âm')}
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              onSingleDeleteRequest(wordId, w.word || 'từ vựng')
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title={t('remove_from_lesson_tooltip', 'Xóa khỏi bài học')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Callout Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{t('info_unassigned_hint', 'Bạn có thể để từ vựng ở trạng thái chưa phân nhóm và phân nhóm sau.')}</span>
      </div>
    </div>
  );
}
