'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { wordService, lessonService } from '@/services/vocabulary.service';
import { WordListItem } from '@/types/vocabulary';
import { Pagination } from '@/components/ui/pagination';
import { WordDetailDialog } from '@/components/vocabulary/word-detail-dialog';
import { CreateWordDialog } from '@/components/vocabulary/create-word-dialog';
import { EditWordDialog } from '@/components/vocabulary/edit-word-dialog';
import { DeleteWordDialog } from '@/components/vocabulary/delete-word-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Volume2,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  Loader2,
  Plus,
  CheckCircle2,
} from 'lucide-react';

const LEVEL_OPTIONS = ['All levels', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function WordsPage() {
  const { t } = useTranslation('vocabulary');
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';

  const action = searchParams.get('action');
  const targetLessonId = searchParams.get('lessonId');
  const targetLessonTitle = searchParams.get('lessonTitle');
  const targetSectionId = searchParams.get('sectionId');
  const targetCollectionId = searchParams.get('collectionId');

  const [lessonAddedSuccess, setLessonAddedSuccess] = useState<{
    wordName: string;
    lessonTitle: string;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('All levels');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewingWordId, setViewingWordId] = useState<string | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [deletingWord, setDeletingWord] = useState<WordListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Automatically open create dialog if URL has action=create
  useEffect(() => {
    if (action === 'create') {
      setCreateOpen(true);
    }
  }, [action]);

  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isBulking, setIsBulking] = useState(false);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, nextActive }: { id: string; nextActive: boolean }) =>
      wordService.toggleActive(id, nextActive),
    onMutate: ({ id }) => {
      setTogglingId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  const handleToggleActive = (id: string, currentActive: boolean) => {
    toggleActiveMutation.mutate({ id, nextActive: !currentActive });
  };

  const bulkActiveMutation = useMutation({
    mutationFn: ({ ids, nextActive }: { ids: string[]; nextActive: boolean }) =>
      wordService.bulkToggleActive(ids, nextActive),
    onMutate: () => {
      setIsBulking(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words'] });
      setSelectedIds([]);
    },
    onSettled: () => {
      setIsBulking(false);
    },
  });

  const handleBulkToggle = (nextActive: boolean) => {
    if (selectedIds.length === 0) return;
    bulkActiveMutation.mutate({ ids: selectedIds, nextActive });
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query params
  const queryParams = useMemo(() => {
    const params: {
      page: number;
      limit: number;
      search?: string;
      level?: string;
      isActive?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {
      page,
      limit: pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }

    if (selectedLevel !== 'All levels') {
      params.level = selectedLevel;
    }

    if (selectedStatus === 'active') {
      params.isActive = true;
    } else if (selectedStatus === 'inactive') {
      params.isActive = false;
    }

    return params;
  }, [page, pageSize, debouncedSearch, selectedLevel, selectedStatus]);

  // Fetch data
  const { data: response, isLoading } = useQuery({
    queryKey: ['words', queryParams],
    queryFn: () => wordService.getAll(queryParams),
  });

  const wordList: WordListItem[] = response?.data?.data || [];
  const totalItems: number = response?.data?.total || 0;
  const totalPages: number = Math.ceil(totalItems / pageSize) || 1;

  // Handle select all
  const allCurrentSelected =
    wordList.length > 0 &&
    wordList.every((item) => selectedIds.includes(item._id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      const currentIds = new Set(wordList.map((w) => w._id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = wordList.map((w) => w._id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Reset filters
  const handleReset = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedLevel('All levels');
    setSelectedStatus('all');
    setPage(1);
  };

  // Audio player
  const playAudio = (url?: string) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.play().catch((err) => console.warn('Could not play audio', err));
    } catch (e) {
      console.warn('Audio play error', e);
    }
  };

  // Helper for badge color
  const getLevelBadgeClass = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'A1':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'A2':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      case 'B1':
        return 'bg-teal-50 text-teal-700 border-teal-200/80';
      case 'B2':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'C1':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'C2':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Helper to extract first English definition
  const getEnglishMeaning = (item: WordListItem) => {
    if (!item.parts || item.parts.length === 0) return '—';
    const defs: string[] = [];
    for (const part of item.parts) {
      for (const m of part.meanings || []) {
        if (m.definition?.trim()) {
          defs.push(m.definition.trim());
        }
      }
    }
    return defs.length > 0 ? defs.join('; ') : '—';
  };

  return (
    <div className="p-6 md:p-8 w-full mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {t('words_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('words_subtitle')}
          </p>
        </div>

        {/* Nút Tạo mới (Create Word) */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t('create_word')}</span>
        </button>
      </div>

      {/* BANNER THÔNG BÁO ĐANG TẠO TỪ CHO BÀI HỌC */}
      {targetLessonId && !lessonAddedSuccess && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-900 truncate">
                Đang tạo từ mới cho bài học: <span className="underline">{targetLessonTitle || 'Bài học'}</span>
              </p>
              <p className="text-[11px] text-blue-700 truncate">
                Sau khi tạo thành công, từ sẽ được thêm trực tiếp vào bài học và tự động chuyển về bài học.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const returnQuery = new URLSearchParams({
                lessonId: targetLessonId,
                ...(targetCollectionId ? { collectionId: targetCollectionId } : {}),
              });
              router.push(`/${locale}/vocabulary/collections?${returnQuery.toString()}`);
            }}
            className="px-3 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-2xs transition-colors"
          >
            {t('back_to_collections', 'Quay lại bài học')}
          </button>
        </div>
      )}

      {/* SUCCESS BANNER KHI TẠO TỪ VÀ TỰ ĐỘNG THÊM VÀO BÀI HỌC */}
      {lessonAddedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-900 truncate">
                {t('auto_added_to_lesson_success', {
                  word: lessonAddedSuccess.wordName,
                  lesson: lessonAddedSuccess.lessonTitle,
                  defaultValue: `Đã tạo từ "${lessonAddedSuccess.wordName}" và thêm vào bài học "${lessonAddedSuccess.lessonTitle}" thành công!`,
                })}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5 truncate">
                Từ vựng đã có sẵn trong kho từ điển và gắn trực tiếp vào bài học.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/vocabulary/collections`)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            {t('back_to_collections', 'Quay lại bài học')}
          </button>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Level Dropdown */}
        <div className="w-full sm:w-44 space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 tracking-wider">
            {t('level')}
          </label>
          <Select
            value={selectedLevel}
            onValueChange={(val) => {
              setSelectedLevel(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full bg-white hover:bg-slate-50 border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All levels">{t('all_levels')}</SelectItem>
              {LEVEL_OPTIONS.filter((lvl) => lvl !== 'All levels').map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Dropdown */}
        <div className="w-full sm:w-44 space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 tracking-wider">
            {t('status')}
          </label>
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full bg-white hover:bg-slate-50 border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_status')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button */}
        <div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto h-[42px] px-5 inline-flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            {t('reset')}
          </button>
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 px-5 bg-blue-50/80 border border-blue-200/80 rounded-2xl shadow-sm text-sm animate-in fade-in-0 duration-200">
          <div className="flex items-center gap-2 font-semibold text-blue-900">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
              {selectedIds.length}
            </span>
            <span>{t('selected_count', { count: selectedIds.length })}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isBulking}
              onClick={() => handleBulkToggle(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              {isBulking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('bulk_activate')}</span>
            </button>

            <button
              type="button"
              disabled={isBulking}
              onClick={() => handleBulkToggle(false)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              {isBulking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('bulk_deactivate')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
            >
              {t('deselect_all')}
            </button>
          </div>
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allCurrentSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4 min-w-[140px]">{t('th_word')}</th>
                <th className="py-4 px-4 min-w-[200px]">{t('th_phonetic')}</th>
                <th className="py-4 px-4 min-w-[260px]">{t('th_meanings')}</th>
                <th className="py-4 px-4 min-w-[100px] text-center">{t('th_level')}</th>
                <th className="py-4 px-4 min-w-[120px] text-center">{t('th_status')}</th>
                <th className="py-4 px-4 min-w-[130px] text-right">{t('th_actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                      <span className="text-sm">{t('loading_words')}</span>
                    </div>
                  </td>
                </tr>
              ) : wordList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <p className="text-base font-medium text-slate-600">
                      {t('no_words_found')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t('try_adjusting_filters')}
                    </p>
                  </td>
                </tr>
              ) : (
                wordList.map((item) => {
                  const isSelected = selectedIds.includes(item._id);

                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item._id)}
                          className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Word */}
                      <td className="py-4 px-4 font-bold text-slate-900 tracking-tight text-base">
                        {item.word}
                      </td>

                      {/* Phonetic (US / UK) */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-xs">
                          {item.ipa?.us ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <button
                                type="button"
                                onClick={() => playAudio(item.audio?.us)}
                                disabled={!item.audio?.us}
                                title={item.audio?.us ? t('play_us') : t('no_audio')}
                                className="text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono text-slate-700">{item.ipa.us}</span>
                              <span className="text-slate-400 text-[11px]">(US)</span>
                            </div>
                          ) : null}

                          {item.ipa?.uk ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <button
                                type="button"
                                onClick={() => playAudio(item.audio?.uk)}
                                disabled={!item.audio?.uk}
                                title={item.audio?.uk ? t('play_uk') : t('no_audio')}
                                className="text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:hover:text-blue-500 transition-colors cursor-pointer disabled:cursor-not-allowed"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono text-slate-700">{item.ipa.uk}</span>
                              <span className="text-slate-400 text-[11px]">(UK)</span>
                            </div>
                          ) : null}

                          {!item.ipa?.us && !item.ipa?.uk && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Meanings (EN) */}
                      <td className="py-4 px-4 max-w-sm">
                        <p
                          className="text-slate-600 text-sm line-clamp-2 leading-relaxed"
                          title={getEnglishMeaning(item)}
                        >
                          {getEnglishMeaning(item)}
                        </p>
                      </td>

                      {/* Level */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getLevelBadgeClass(
                            item.level
                          )}`}
                        >
                          {item.level || '—'}
                        </span>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item._id, item.isActive !== false)}
                          disabled={togglingId === item._id}
                          className="inline-flex items-center gap-2 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none"
                          title={
                            item.isActive !== false
                              ? t('click_to_deactivate')
                              : t('click_to_activate')
                          }
                        >
                          <div
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              item.isActive !== false
                                ? 'bg-emerald-500 group-hover:bg-emerald-600'
                                : 'bg-slate-300 group-hover:bg-slate-400'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                item.isActive !== false ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>

                          <span
                            className={`text-xs transition-colors min-w-[70px] text-left ${
                              item.isActive !== false
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-500 font-normal'
                            }`}
                          >
                            {togglingId === item._id ? (
                              <Loader2 className="w-3 h-3 animate-spin inline text-slate-400" />
                            ) : item.isActive !== false ? (
                              t('active')
                            ) : (
                              t('inactive')
                            )}
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setViewingWordId(item._id)}
                            title={t('view_details')}
                            className="p-1.5 rounded-lg border border-blue-100 bg-blue-50/40 text-blue-600 hover:bg-blue-100/70 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditingWordId(item._id)}
                            title={t('edit_word')}
                            className="p-1.5 rounded-lg border border-blue-100 bg-blue-50/40 text-blue-600 hover:bg-blue-100/70 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeletingWord(item)}
                            title={t('delete_word')}
                            className="p-1.5 rounded-lg border border-rose-100 bg-rose-50/40 text-rose-500 hover:bg-rose-100/70 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="border-t border-slate-200/80 px-4 bg-white">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            itemLabel={t('words_label')}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      </div>

      {/* WORD DETAIL POPUP */}
      <WordDetailDialog
        wordId={viewingWordId}
        open={!!viewingWordId}
        onOpenChange={(open) => {
          if (!open) setViewingWordId(null);
        }}
      />

      {/* CREATE WORD POPUP */}
      <CreateWordDialog
        open={createOpen}
        onOpenChange={(isOpen) => {
          setCreateOpen(isOpen);
          if (!isOpen && action === 'create') {
            if (targetLessonId) {
              const returnQuery = new URLSearchParams({
                lessonId: targetLessonId,
                ...(targetCollectionId ? { collectionId: targetCollectionId } : {}),
              });
              router.push(`/${locale}/vocabulary/collections?${returnQuery.toString()}`);
            } else {
              router.replace(`/${locale}/vocabulary/words`);
            }
          }
        }}
        onSuccess={async (newWord) => {
          setPage(1);
          queryClient.invalidateQueries({ queryKey: ['words'] });
          if (targetLessonId && newWord?._id) {
            try {
              await lessonService.addWords(
                targetLessonId,
                [newWord._id],
                targetSectionId || undefined
              );
              queryClient.invalidateQueries({ queryKey: ['lesson-words', targetLessonId] });
              queryClient.invalidateQueries({ queryKey: ['lessons'] });
              queryClient.invalidateQueries({ queryKey: ['target-lesson', targetLessonId] });

              // TỰ ĐỘNG QUAY VỀ VÀ MỞ LẠI LESSON ĐANG QUẢN LÝ
              const returnQuery = new URLSearchParams({
                lessonId: targetLessonId,
                ...(targetCollectionId ? { collectionId: targetCollectionId } : {}),
                newWordAdded: newWord.word || '1',
              });
              router.push(`/${locale}/vocabulary/collections?${returnQuery.toString()}`);
              return;
            } catch (err) {
              console.error('Failed to auto-add word to lesson:', err);
            }
          }
        }}
      />

      {/* EDIT WORD POPUP */}
      <EditWordDialog
        wordId={editingWordId}
        open={!!editingWordId}
        onOpenChange={(open) => {
          if (!open) setEditingWordId(null);
        }}
      />

      {/* DELETE WORD POPUP */}
      <DeleteWordDialog
        word={deletingWord}
        open={!!deletingWord}
        onOpenChange={(open) => {
          if (!open) setDeletingWord(null);
        }}
      />
    </div>
  );
}