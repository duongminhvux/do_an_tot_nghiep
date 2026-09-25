'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { lessonService } from '@/services/vocabulary.service';
import { LessonItem, SectionItem } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';

import {
  ParseWordsResult,
  DeleteConfirmState,
  EditingWordItem,
  ImportSummaryResult,
  AddWordsModal,
  WordsTable,
  GroupsSidebar,
  CreateGroupModal,
  ChangeGroupModal,
  DeleteConfirmModal,
  ImportSummaryBanner,
} from './lesson-words';

export type { ParseWordsResult };

interface LessonWordsDialogProps {
  open: boolean;
  lesson: LessonItem | null;
  onOpenChange: (open: boolean) => void;
}

export function LessonWordsDialog({
  open,
  lesson,
  onOpenChange,
}: LessonWordsDialogProps) {
  const { t } = useTranslation('vocabulary');
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const queryClient = useQueryClient();

  const newWordAdded = searchParams.get('newWordAdded');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');

  // Checkbox multi-selection for bulk action
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);

  // Sub-modals state
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [editingWordItem, setEditingWordItem] = useState<EditingWordItem | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result Notification State (shown after import completes)
  const [importSummaryResult, setImportSummaryResult] = useState<ImportSummaryResult | null>(null);

  // Reset states on dialog open
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setFilterLevel('all');
      setFilterSection('all');
      setSelectedWordIds([]);
      setIsAddWordModalOpen(false);
      setIsCreateGroupModalOpen(false);
      setEditingWordItem(null);
      setDeleteConfirmState(null);
      setErrorMessage(null);
      setImportSummaryResult(null);
    }
  }, [open, lesson?._id]);

  // ==========================
  // 1. QUERIES
  // ==========================

  // Query Sections
  const { data: sectionsRes } = useQuery({
    queryKey: ['lesson-sections', lesson?._id],
    queryFn: () => lessonService.getSections(lesson!._id),
    enabled: open && !!lesson?._id,
  });

  const sections: SectionItem[] = sectionsRes?.data || [];

  // Query Words
  const { data: lessonWordsRes, isLoading: isLoadingLessonWords } = useQuery({
    queryKey: ['lesson-words', lesson?._id],
    queryFn: () => lessonService.getWords(lesson!._id),
    enabled: open && !!lesson?._id,
  });

  const lessonWords: any[] = useMemo(() => {
    const raw = lessonWordsRes?.data || [];
    return [...raw].sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return String(b._id || '').localeCompare(String(a._id || ''));
    });
  }, [lessonWordsRes?.data]);

  const existingWordIds = useMemo(() => {
    return new Set(lessonWords.map((lw: any) => lw.wordId?._id || lw.wordId));
  }, [lessonWords]);

  // Live count map for sections
  const sectionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lw of lessonWords) {
      const secId = lw.sectionId?._id || lw.sectionId;
      if (secId) {
        map[secId] = (map[secId] || 0) + 1;
      }
    }
    return map;
  }, [lessonWords]);

  const unassignedWordsCount = useMemo(() => {
    return lessonWords.filter((lw: any) => !(lw.sectionId?._id || lw.sectionId)).length;
  }, [lessonWords]);

  // Filtered words for table
  const filteredWords = useMemo(() => {
    return lessonWords.filter((item: any) => {
      const w = item.wordId || {};

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const wordMatch = (w.word || '').toLowerCase().includes(q);
        const meaningMatch = (w.parts || []).some((p: any) =>
          (p.meanings || []).some(
            (m: any) =>
              (m.definition || '').toLowerCase().includes(q) ||
              (m.translation || []).some((tr: string) => tr.toLowerCase().includes(q))
          )
        );
        if (!wordMatch && !meaningMatch) return false;
      }

      // Filter Level
      if (filterLevel !== 'all') {
        if (w.level !== filterLevel) return false;
      }

      // Filter Section
      if (filterSection === 'unassigned') {
        if (item.sectionId?._id || item.sectionId) return false;
      } else if (filterSection !== 'all') {
        const itemSecId = item.sectionId?._id || item.sectionId;
        if (itemSecId !== filterSection) return false;
      }

      return true;
    });
  }, [lessonWords, searchQuery, filterLevel, filterSection]);

  // Invalidate queries helper
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lesson-words', lesson?._id] });
    queryClient.invalidateQueries({ queryKey: ['lesson-sections', lesson?._id] });
    queryClient.invalidateQueries({ queryKey: ['lessons', lesson?.collectionId] });
  }, [queryClient, lesson?._id, lesson?.collectionId]);

  // ==========================
  // 2. MUTATIONS
  // ==========================

  // Remove single word mutation
  const removeWordMutation = useMutation({
    mutationFn: (wordId: string) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      return lessonService.removeWord(lesson._id, wordId);
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi xóa từ vựng.');
    },
  });

  // Update single word section mutation
  const updateWordSectionMutation = useMutation({
    mutationFn: ({ wordId, sectionId }: { wordId: string; sectionId: string | null }) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      return lessonService.updateWord(lesson._id, wordId, { sectionId });
    },
    onSuccess: () => {
      invalidateAll();
      setEditingWordItem(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi cập nhật nhóm.');
    },
  });

  // Bulk move words to group
  const bulkMoveMutation = useMutation({
    mutationFn: async ({ wordIds, sectionId }: { wordIds: string[]; sectionId: string | null }) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      await Promise.all(
        wordIds.map((wId) => lessonService.updateWord(lesson._id, wId, { sectionId }))
      );
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedWordIds([]);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi chuyển nhóm.');
    },
  });

  // Bulk remove words from lesson
  const bulkRemoveMutation = useMutation({
    mutationFn: async (wordIds: string[]) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      await Promise.all(wordIds.map((wId) => lessonService.removeWord(lesson._id, wId)));
    },
    onSuccess: () => {
      invalidateAll();
      setSelectedWordIds([]);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi xóa các từ.');
    },
  });

  // Create section mutation
  const createSectionMutation = useMutation({
    mutationFn: (data: { name: string; order?: number }) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      return lessonService.createSection(lesson._id, data);
    },
    onSuccess: () => {
      invalidateAll();
      setIsCreateGroupModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi tạo nhóm.');
    },
  });

  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: { name?: string; order?: number } }) => {
      return lessonService.updateSection(sectionId, data);
    },
    onSuccess: () => {
      invalidateAll();
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi cập nhật nhóm.');
    },
  });

  // Delete section mutation
  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => {
      return lessonService.deleteSection(sectionId);
    },
    onSuccess: () => {
      invalidateAll();
      if (filterSection !== 'all' && filterSection !== 'unassigned') {
        setFilterSection('all');
      }
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi xóa nhóm.');
    },
  });

  // Navigate to Word Creation page and auto-add to lesson
  const handleNavigateToCreateWord = (targetSectionId?: string) => {
    if (!lesson?._id) return;
    const query = new URLSearchParams({
      action: 'create',
      lessonId: lesson._id,
      lessonTitle: lesson.title || '',
      ...(lesson.collectionId ? { collectionId: lesson.collectionId } : {}),
      ...(targetSectionId ? { sectionId: targetSectionId } : {}),
    });
    setIsAddWordModalOpen(false);
    onOpenChange(false);
    router.push(`/${locale}/vocabulary/words?${query.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full p-5 sm:p-8 rounded-2xl border border-slate-200 shadow-2xl bg-white max-h-[92vh] flex flex-col">
        {/* ======================================================== */}
        {/* 1. HEADER */}
        {/* ======================================================== */}
        <DialogHeader className="space-y-1 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Title & Stats */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="truncate">{lesson?.title || 'Unit 2 - Thinking learning'}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                    {lessonWords.length} {t('words_label', 'từ')}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5 truncate">
                  {t('manage_lesson_desc', 'Quản lý từ vựng và phân nhóm cho bài học này.')}
                </DialogDescription>
              </div>
            </div>

            {/* Primary Action Button: + Thêm từ vựng */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsAddWordModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_words_btn', 'Thêm từ vựng')}</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Global Error Alert */}
        {errorMessage && (
          <div className="mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between gap-2 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* THÔNG BÁO TẠO TỪ MỚI VÀ ĐÃ THÊM VÀO BÀI HỌC THÀNH CÔNG */}
        {newWordAdded && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {t('new_word_created_and_added', {
                  word: newWordAdded !== '1' ? newWordAdded : '',
                  defaultValue:
                    newWordAdded !== '1'
                      ? `Đã tạo từ "${newWordAdded}" và thêm vào bài học thành công!`
                      : 'Đã tạo từ mới và thêm vào bài học thành công!',
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const p = new URLSearchParams(window.location.search);
                p.delete('newWordAdded');
                const newQuery = p.toString();
                router.replace(
                  newQuery
                    ? `/${locale}/vocabulary/collections?${newQuery}`
                    : `/${locale}/vocabulary/collections`
                );
              }}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* THÔNG BÁO KẾT QUẢ IMPORT DANH SÁCH TỪ */}
        {importSummaryResult && (
          <ImportSummaryBanner
            result={importSummaryResult}
            onClose={() => setImportSummaryResult(null)}
            onNavigateToCreateWord={() => handleNavigateToCreateWord()}
          />
        )}

        {/* ======================================================== */}
        {/* 2. TOOLBAR: Tìm kiếm + Lọc trình độ */}
        {/* ======================================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_lesson_words_placeholder', 'Tìm từ vựng hoặc nghĩa...')}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc Trình độ (CEFR) & Nút Tạo nhóm */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-xs font-medium border-slate-200 bg-white text-slate-700">
                <SelectValue placeholder={t('filter_level', 'Trình độ: Tất cả')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter_level', 'Trình độ: Tất cả')}</SelectItem>
                <SelectItem value="A1">A1</SelectItem>
                <SelectItem value="A2">A2</SelectItem>
                <SelectItem value="B1">B1</SelectItem>
                <SelectItem value="B2">B2</SelectItem>
                <SelectItem value="C1">C1</SelectItem>
                <SelectItem value="C2">C2</SelectItem>
              </SelectContent>
            </Select>

            {/* Nút Tạo nhóm */}
            {/* <button
              type="button"
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="h-9 px-3.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title={t('btn_create_group', 'Tạo nhóm mới')}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('btn_create_group', 'Tạo nhóm')}</span>
            </button> */}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. MAIN 2-COLUMN LAYOUT: 75% BẢNG TỪ VỰNG + 25% SIDEBAR NHÓM */}
        {/* ======================================================== */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden pt-1 min-h-0">
          {/* CỘT TRÁI: BẢNG DANH SÁCH TỪ VỰNG */}
          <WordsTable
            isLoadingLessonWords={isLoadingLessonWords}
            lessonWords={lessonWords}
            filteredWords={filteredWords}
            sections={sections}
            filterSection={filterSection}
            unassignedWordsCount={unassignedWordsCount}
            selectedWordIds={selectedWordIds}
            setSelectedWordIds={setSelectedWordIds}
            onOpenAddWordModal={() => setIsAddWordModalOpen(true)}
            onResetFilters={() => {
              setSearchQuery('');
              setFilterLevel('all');
              setFilterSection('all');
            }}
            onBulkMove={(sectionId) => bulkMoveMutation.mutate({ wordIds: selectedWordIds, sectionId })}
            isBulkMoving={bulkMoveMutation.isPending}
            onBulkDeleteRequest={(count) => setDeleteConfirmState({ type: 'bulk', count })}
            onSingleDeleteRequest={(wordId, wordName) => setDeleteConfirmState({ type: 'single', wordId, wordName })}
            onEditWordSection={(item) => setEditingWordItem(item)}
          />

          {/* CỘT PHẢI: SIDEBAR NHÓM TỪ VỰNG */}
          <GroupsSidebar
            sections={sections}
            lessonWordsCount={lessonWords.length}
            sectionCounts={sectionCounts}
            filterSection={filterSection}
            setFilterSection={setFilterSection}
            onUpdateSection={(sectionId, name) => updateSectionMutation.mutate({ sectionId, data: { name } })}
            onDeleteSectionRequest={(sectionId, sectionName) => setDeleteConfirmState({ type: 'section', sectionId, sectionName })}
            onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
          />
        </div>

        {/* ======================================================== */}
        {/* 4. MODAL: THÊM TỪ VỰNG (TRA CỨU TỪ ĐIỂN + IMPORT FILE/TEXT) */}
        {/* ======================================================== */}
        <AddWordsModal
          open={isAddWordModalOpen}
          onClose={() => setIsAddWordModalOpen(false)}
          lessonId={lesson?._id || ''}
          sections={sections}
          existingWordIds={existingWordIds}
          onWordsAdded={invalidateAll}
          onImportSummary={(result) => setImportSummaryResult(result)}
          onNavigateToCreateWord={handleNavigateToCreateWord}
        />

        {/* ======================================================== */}
        {/* 5. MODAL: TẠO NHÓM TỪ VỰNG */}
        {/* ======================================================== */}
        <CreateGroupModal
          open={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
          onSubmit={(name) => createSectionMutation.mutate({ name })}
          isSubmitting={createSectionMutation.isPending}
        />

        {/* ======================================================== */}
        {/* 6. MODAL: ĐỔI NHÓM CHO TỪ */}
        {/* ======================================================== */}
        <ChangeGroupModal
          editingWordItem={editingWordItem}
          onClose={() => setEditingWordItem(null)}
          sections={sections}
          onSelectSection={(wordId, sectionId) => updateWordSectionMutation.mutate({ wordId, sectionId })}
          isPending={updateWordSectionMutation.isPending}
        />

        {/* ======================================================== */}
        {/* 7. MODAL: XÁC NHẬN XÓA */}
        {/* ======================================================== */}
        <DeleteConfirmModal
          state={deleteConfirmState}
          onClose={() => setDeleteConfirmState(null)}
          onConfirm={(st) => {
            if (st.type === 'single' && st.wordId) {
              removeWordMutation.mutate(st.wordId, {
                onSettled: () => setDeleteConfirmState(null),
              });
            } else if (st.type === 'bulk') {
              bulkRemoveMutation.mutate(selectedWordIds, {
                onSettled: () => setDeleteConfirmState(null),
              });
            } else if (st.type === 'section' && st.sectionId) {
              deleteSectionMutation.mutate(st.sectionId, {
                onSettled: () => setDeleteConfirmState(null),
              });
            }
          }}
          isPending={
            removeWordMutation.isPending ||
            bulkRemoveMutation.isPending ||
            deleteSectionMutation.isPending
          }
          selectedCount={selectedWordIds.length}
        />
      </DialogContent>
    </Dialog>
  );
}
