'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import { lessonService, wordService } from '@/services/vocabulary.service';
import { LessonItem, SectionItem, WordListItem } from '@/types/vocabulary';
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
  Trash2,
  Volume2,
  Loader2,
  Check,
  AlertTriangle,
  Pencil,
  ChevronRight,
  X,
  Info,
  ExternalLink,
} from 'lucide-react';

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
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');

  // Checkbox multi-selection for bulk action
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);

  // Modals state
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [editingWordItem, setEditingWordItem] = useState<{ wordId: string; currentSecId: string | null; word: string } | null>(null);

  // Delete Confirmation Popup State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    type: 'single' | 'bulk' | 'section';
    wordId?: string;
    wordName?: string;
    sectionId?: string;
    sectionName?: string;
    count?: number;
  } | null>(null);

  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');

  // Edit Group inline
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  // Dictionary Lookup in Add Word Modal
  const [searchDict, setSearchDict] = useState('');
  const [debouncedDict, setDebouncedDict] = useState('');
  const [selectedDictWordIds, setSelectedDictWordIds] = useState<string[]>([]);
  const [targetDictSectionId, setTargetDictSectionId] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Navigate to Word Creation page and auto-add to lesson
  const handleNavigateToCreateWord = () => {
    if (!lesson?._id) return;
    const query = new URLSearchParams({
      action: 'create',
      lessonId: lesson._id,
      lessonTitle: lesson.title || '',
      ...(targetDictSectionId ? { sectionId: targetDictSectionId } : {}),
    });
    setIsAddWordModalOpen(false);
    onOpenChange(false);
    router.push(`/${locale}/vocabulary/words?${query.toString()}`);
  };

  // Debounce dictionary search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDict(searchDict);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchDict]);

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
      setEditingSectionId(null);
      setDeleteConfirmState(null);
      setErrorMessage(null);
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

  const lessonWords: any[] = lessonWordsRes?.data || [];

  // Query global dictionary words for Add Words view
  const { data: dictWordsRes, isLoading: isLoadingDict } = useQuery({
    queryKey: ['admin-words-lookup', debouncedDict],
    queryFn: () =>
      wordService.getAll({
        search: debouncedDict || undefined,
        limit: 40,
        page: 1,
      }),
    enabled: isAddWordModalOpen && open,
  });

  const dictWords: WordListItem[] = dictWordsRes?.data?.data || [];

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
    return lessonWords.filter((lw: any) => !lw.sectionId).length;
  }, [lessonWords]);

  // Filtered words for table
  const filteredWords = useMemo(() => {
    return lessonWords.filter((item: any) => {
      const w = item.wordId || {};
      const wordText = (w.word || '').toLowerCase();
      const meaningText = (w.parts?.[0]?.meanings?.[0]?.definition || '').toLowerCase();
      const translationText = (w.parts?.[0]?.meanings?.[0]?.translation?.join(' ') || '').toLowerCase();

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        wordText.includes(q) ||
        meaningText.includes(q) ||
        translationText.includes(q);

      if (!matchSearch) return false;

      // Filter Level
      if (filterLevel !== 'all') {
        if ((w.level || '').toUpperCase() !== filterLevel.toUpperCase()) return false;
      }

      // Filter Section
      if (filterSection !== 'all') {
        const secId = item.sectionId?._id || item.sectionId;
        if (filterSection === 'unassigned') {
          if (secId) return false;
        } else if (secId !== filterSection) {
          return false;
        }
      }

      return true;
    });
  }, [lessonWords, searchQuery, filterLevel, filterSection]);

  // ==========================
  // 2. MUTATIONS
  // ==========================

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['lesson-words', lesson?._id] });
    queryClient.invalidateQueries({ queryKey: ['lesson-sections', lesson?._id] });
    queryClient.invalidateQueries({ queryKey: ['lessons', lesson?.collectionId] });
  };

  // Add words mutation
  const addWordsMutation = useMutation({
    mutationFn: ({ wordIds, sectionId }: { wordIds: string[]; sectionId?: string }) => {
      if (!lesson?._id) throw new Error('Missing lesson ID');
      return lessonService.addWords(lesson._id, wordIds, sectionId);
    },
    onSuccess: () => {
      invalidateAll();
      setIsAddWordModalOpen(false);
      setSelectedDictWordIds([]);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Lỗi thêm từ vựng.');
    },
  });

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
      setNewGroupName('');
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
      setEditingSectionId(null);
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

  // Audio helper
  const handlePlayAudio = (url?: string) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('Audio playback failed', err);
    }
  };

  // Table selection helpers
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white max-h-[92vh] flex flex-col">
        {/* ======================================================== */}
        {/* 1. CLEAN HEADER */}
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

        {/* ======================================================== */}
        {/* 2. TOOLBAR: Tìm kiếm + Lọc trình độ + Nút Tạo nhóm */}
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

          {/* Filters & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Lọc Trình độ (CEFR) bằng shadcn Select */}
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
            <button
              type="button"
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('btn_create_group', 'Tạo nhóm')}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. MAIN 2-COLUMN LAYOUT: 75% BẢNG TỪ VỰNG + 25% SIDEBAR NHÓM */}
        {/* ======================================================== */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden pt-1 min-h-0">
          {/* CỘT TRÁI: DANH SÁCH TỪ VỰNG (~75% -> col-span-9) */}
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
                        if (val) {
                          bulkMoveMutation.mutate({ wordIds: selectedWordIds, sectionId: val });
                        }
                      }}
                      disabled={bulkMoveMutation.isPending}
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
                      onClick={() => bulkMoveMutation.mutate({ wordIds: selectedWordIds, sectionId: null })}
                      disabled={bulkMoveMutation.isPending}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {t('btn_remove_from_group', 'Xóa khỏi nhóm')}
                    </button>

                    {/* Xóa khỏi bài học */}
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirmState({
                          type: 'bulk',
                          count: selectedWordIds.length,
                        })
                      }
                      disabled={bulkRemoveMutation.isPending}
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
                    onClick={() => setIsAddWordModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ {t('add_words_btn', 'Thêm từ vựng')}</span>
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
                    onClick={() => {
                      setSearchQuery('');
                      setFilterLevel('all');
                      setFilterSection('all');
                    }}
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
                        <th className="py-2.5 px-4 w-32">{t('th_phonetic', 'Phiên âm')}</th>
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

                            <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                              {(w.ipa?.us || w.ipa?.uk) ? `/${w.ipa?.us || w.ipa?.uk}/` : '—'}
                            </td>

                            <td className="py-3 px-4 text-slate-700 max-w-xs">
                              <p className="truncate">
                                {w.parts?.[0]?.meanings?.[0]?.translation?.[0] ||
                                  w.parts?.[0]?.meanings?.[0]?.definition ||
                                  '—'}
                              </p>
                            </td>

                            <td className="py-3 px-4">
                              {sectionObj ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingWordItem({ wordId, currentSecId: secId, word: w.word })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                                  title={t('change_group_title', 'Nhấn để đổi nhóm')}
                                >
                                  <span>{sectionObj.name}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingWordItem({ wordId, currentSecId: null, word: w.word })}
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
                                    setDeleteConfirmState({
                                      type: 'single',
                                      wordId,
                                      wordName: w.word || 'từ vựng',
                                    })
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

          {/* CỘT PHẢI: SIDEBAR PANEL "NHÓM TỪ VỰNG" (~25% -> col-span-3) */}
          <div className="lg:col-span-3 flex flex-col justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-y-auto">
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {t('vocab_groups_title', 'Nhóm từ vựng')}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {t('vocab_groups_desc', 'Nhóm là tùy chọn. Bạn có thể để từ vựng ở trạng thái chưa phân nhóm.')}
                </p>
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
                  <span className="text-[11px] text-slate-400">({lessonWords.length})</span>
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
                            onClick={() => {
                              if (editingSectionName.trim()) {
                                updateSectionMutation.mutate({ sectionId: sec._id, data: { name: editingSectionName.trim() } });
                              }
                            }}
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

                      {/* Nút sửa/xóa nhóm khi hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectionId(sec._id);
                            setEditingSectionName(sec.name);
                          }}
                          className="p-1 text-slate-400 hover:text-purple-600 rounded"
                          title={t('rename_section', 'Sửa tên nhóm')}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmState({
                              type: 'section',
                              sectionId: sec._id,
                              sectionName: sec.name,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title={t('delete', 'Xóa nhóm')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Chưa phân nhóm item */}
                <button
                  type="button"
                  onClick={() => setFilterSection(filterSection === 'unassigned' ? 'all' : 'unassigned')}
                  className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    filterSection === 'unassigned'
                      ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-xs'
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span>{t('unassigned_label', 'Chưa phân nhóm')}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">({unassignedWordsCount})</span>
                </button>
              </div>
            </div>

            {/* Nút Tạo nhóm dưới chân sidebar */}
            <button
              type="button"
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="mt-4 w-full py-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('btn_create_group', 'Tạo nhóm')}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. MODAL: THÊM TỪ VỰNG TỪ KHO TỪ ĐIỂN */}
        {/* ======================================================== */}
        {isAddWordModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-lg w-full space-y-4 max-h-[85vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {t('add_words_modal_title', 'Thêm từ vựng')}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('select_words_from_dict_hint', 'Tìm kiếm và chọn từ vựng từ kho từ điển')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNavigateToCreateWord}
                    title={t('create_new_word_in_bank_hint', 'Chuyển sang trang tạo từ vựng mới rồi tự động thêm vào bài học')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('create_new_word_in_bank', 'Tạo từ mới')}</span>
                    <ExternalLink className="w-3 h-3 text-blue-500 ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddWordModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search + Section Target Filter */}
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="col-span-2 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchDict}
                      onChange={(e) => setSearchDict(e.target.value)}
                      placeholder={t('search_dict_placeholder', 'Tìm từ vựng từ điển...')}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <Select
                    value={targetDictSectionId || 'unassigned'}
                    onValueChange={(val) => setTargetDictSectionId(val === 'unassigned' ? '' : val)}
                  >
                    <SelectTrigger className="h-[34px] w-full rounded-xl text-xs border-slate-200 bg-white">
                      <SelectValue placeholder={t('unassigned_label', 'Chưa phân nhóm')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t('unassigned_label', 'Chưa phân nhóm')}</SelectItem>
                      {sections.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dictionary Results List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-2 min-h-0">
                  {isLoadingDict ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-xs">{t('searching_dict', 'Đang tìm từ điển...')}</span>
                    </div>
                  ) : dictWords.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center px-4 space-y-2.5">
                      <p className="text-xs text-slate-500 font-medium">
                        {t('no_dict_words_found', 'Không tìm thấy từ vựng nào')}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        {t('create_new_word_in_bank_hint', 'Chuyển sang trang tạo từ vựng mới rồi tự động thêm vào bài học')}
                      </p>
                      <button
                        type="button"
                        onClick={handleNavigateToCreateWord}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('create_new_word_in_bank', 'Tạo từ mới')}</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </button>
                    </div>
                  ) : (
                    dictWords.map((w) => {
                      const isAdded = existingWordIds.has(w._id);
                      const isSelected = selectedDictWordIds.includes(w._id);

                      return (
                        <div
                          key={w._id}
                          onClick={() => {
                            if (isAdded) return;
                            setSelectedDictWordIds((prev) =>
                              prev.includes(w._id) ? prev.filter((id) => id !== w._id) : [...prev, w._id]
                            );
                          }}
                          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all ${
                            isAdded
                              ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'bg-blue-50 border-blue-300 shadow-xs cursor-pointer'
                                : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={isAdded}
                              checked={isAdded || isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-blue-600 pointer-events-none"
                            />
                            <div>
                              <span className="font-bold text-slate-900">{w.word}</span>
                              {w.level && <span className="ml-1 text-[10px] text-slate-400">({w.level})</span>}
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">
                                {w.parts?.[0]?.meanings?.[0]?.translation?.[0] || w.parts?.[0]?.meanings?.[0]?.definition}
                              </p>
                            </div>
                          </div>
                          {isAdded && <span className="text-[10px] text-emerald-600 font-semibold">{t('already_in_lesson_badge', 'Đã có')}</span>}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 text-xs">
                  <span className="font-semibold text-blue-600">{t('selected_words_count', { count: selectedDictWordIds.length })}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddWordModalOpen(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      {t('cancel', 'Hủy')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        addWordsMutation.mutate({
                          wordIds: selectedDictWordIds,
                          sectionId: targetDictSectionId || undefined,
                        })
                      }
                      disabled={selectedDictWordIds.length === 0 || addWordsMutation.isPending}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {addWordsMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        t('add_to_lesson_action', 'Thêm vào bài học')
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. MODAL: TẠO NHÓM TỪ VỰNG */}
        {/* ======================================================== */}
        {isCreateGroupModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-900">
                  {t('create_group_modal_title', 'Tạo nhóm từ vựng')}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newGroupName.trim()) return;
                  createSectionMutation.mutate({ name: newGroupName.trim() });
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('create_group_name_label', 'Tên nhóm')} *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Part 1"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupModalOpen(false)}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {t('cancel', 'Hủy')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newGroupName.trim() || createSectionMutation.isPending}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    {createSectionMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{t('btn_create_group', 'Tạo nhóm')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 6. MODAL: ĐỔI NHÓM CHO TỪ (POPUP GỌN GÀNG) */}
        {/* ======================================================== */}
        {editingWordItem && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-xs w-full space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-900 truncate">
                  {t('change_group_for_word', { word: editingWordItem.word })}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingWordItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateWordSectionMutation.mutate({
                      wordId: editingWordItem.wordId,
                      sectionId: null,
                    })
                  }
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
                      onClick={() =>
                        updateWordSectionMutation.mutate({
                          wordId: editingWordItem.wordId,
                          sectionId: s._id,
                        })
                      }
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
                  onClick={() => setEditingWordItem(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t('close', 'Đóng')}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ======================================================== */}
        {/* 7. MODAL: XÁC NHẬN XÓA (POPUP GỌN GÀNG, KHÔNG DÙNG CONFIRM CỦA TRÌNH DUYỆT) */}
        {/* ======================================================== */}
        {deleteConfirmState && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900">
                    {deleteConfirmState.type === 'bulk'
                      ? t('bulk_remove_title', 'Xác nhận xóa từ đã chọn')
                      : deleteConfirmState.type === 'section'
                        ? t('delete_group_title', 'Xác nhận xóa nhóm')
                        : t('remove_word_title', 'Xóa từ khỏi bài học')}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {deleteConfirmState.type === 'bulk'
                      ? t('bulk_remove_lesson_confirm', {
                          count: deleteConfirmState.count || selectedWordIds.length,
                          defaultValue: `Bạn có chắc muốn xóa ${deleteConfirmState.count || selectedWordIds.length} từ đã chọn khỏi bài học này?`,
                        })
                      : deleteConfirmState.type === 'section'
                        ? t('delete_section_confirm', {
                            name: deleteConfirmState.sectionName,
                            defaultValue: `Xóa nhóm "${deleteConfirmState.sectionName}"? Các từ vựng sẽ về trạng thái Chưa phân nhóm.`,
                          })
                        : t('remove_single_word_desc', {
                            word: deleteConfirmState.wordName,
                            defaultValue: `Bạn có chắc muốn xóa từ "${deleteConfirmState.wordName}" khỏi bài học này?`,
                          })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmState(null)}
                  disabled={
                    removeWordMutation.isPending ||
                    bulkRemoveMutation.isPending ||
                    deleteSectionMutation.isPending
                  }
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel', 'Hủy')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirmState.type === 'single' && deleteConfirmState.wordId) {
                      removeWordMutation.mutate(deleteConfirmState.wordId, {
                        onSettled: () => setDeleteConfirmState(null),
                      });
                    } else if (deleteConfirmState.type === 'bulk') {
                      bulkRemoveMutation.mutate(selectedWordIds, {
                        onSettled: () => setDeleteConfirmState(null),
                      });
                    } else if (deleteConfirmState.type === 'section' && deleteConfirmState.sectionId) {
                      deleteSectionMutation.mutate(deleteConfirmState.sectionId, {
                        onSettled: () => setDeleteConfirmState(null),
                      });
                    }
                  }}
                  disabled={
                    removeWordMutation.isPending ||
                    bulkRemoveMutation.isPending ||
                    deleteSectionMutation.isPending
                  }
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {(removeWordMutation.isPending ||
                    bulkRemoveMutation.isPending ||
                    deleteSectionMutation.isPending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>{t('btn_confirm_delete', 'Xác nhận xóa')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
