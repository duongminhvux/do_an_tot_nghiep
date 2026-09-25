'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { lessonService, wordService } from '@/services/vocabulary.service';
import { SectionItem, WordListItem } from '@/types/vocabulary';
import { ParseWordsResult, ImportSummaryResult } from './types';
import { parseTextToWordsDetailed, parseFileToWordsDetailed } from './utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Loader2,
  AlertTriangle,
  X,
  Info,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AddWordsModalProps {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  sections: SectionItem[];
  existingWordIds: Set<string>;
  onWordsAdded: () => void;
  onImportSummary: (result: ImportSummaryResult) => void;
  onNavigateToCreateWord: (targetSectionId?: string) => void;
}

export function AddWordsModal({
  open,
  onClose,
  lessonId,
  sections,
  existingWordIds,
  onWordsAdded,
  onImportSummary,
  onNavigateToCreateWord,
}: AddWordsModalProps) {
  const { t } = useTranslation('vocabulary');

  // Tab: 'search' (dictionary) vs 'import' (file/text)
  const [addWordTab, setAddWordTab] = useState<'search' | 'import'>('search');

  // 1. Dictionary Lookup states
  const [searchDict, setSearchDict] = useState('');
  const [debouncedDict, setDebouncedDict] = useState('');
  const [selectedDictWordIds, setSelectedDictWordIds] = useState<string[]>([]);
  const [targetDictSectionId, setTargetDictSectionId] = useState<string>('');

  // 2. Import states
  const [importSourceType, setImportSourceType] = useState<'file' | 'text'>('file');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState<string>('');
  const [fileParseResult, setFileParseResult] = useState<ParseWordsResult | null>(null);
  const [isShowWordsList, setIsShowWordsList] = useState(false);
  const [importIsReadingFile, setImportIsReadingFile] = useState(false);
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
  const [importTargetSectionId, setImportTargetSectionId] = useState<string>('');
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Debounce dictionary search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDict(searchDict);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchDict]);

  // Detected words from text
  const textParseResult = useMemo<ParseWordsResult>(() => {
    return parseTextToWordsDetailed(importText);
  }, [importText]);

  // Active parse result based on selected input method
  const activeParseResult = useMemo<ParseWordsResult>(() => {
    if (importSourceType === 'file') {
      return fileParseResult || { words: [], duplicates: [], skipped: [], rawCount: 0 };
    }
    return textParseResult;
  }, [importSourceType, fileParseResult, textParseResult]);

  const effectiveWordsToImport = useMemo(() => {
    return activeParseResult.words;
  }, [activeParseResult]);

  // Reset import helpers
  const resetImportState = useCallback(() => {
    setImportFile(null);
    setImportText('');
    setFileParseResult(null);
    setIsShowWordsList(false);
    setImportIsReadingFile(false);
    setIsImportSubmitting(false);
    setImportTargetSectionId('');
    setImportModalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetImportState();
    setSearchDict('');
    setSelectedDictWordIds([]);
    setTargetDictSectionId('');
    setAddWordTab('search');
  }, [onClose, resetImportState]);

  // Query global dictionary words for Tab 1
  const { data: dictWordsRes, isLoading: isLoadingDict } = useQuery({
    queryKey: ['admin-words-lookup', debouncedDict],
    queryFn: () =>
      wordService.getAll({
        search: debouncedDict || undefined,
        limit: 40,
        page: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    enabled: open && addWordTab === 'search',
  });

  const dictWords: WordListItem[] = dictWordsRes?.data?.data || [];

  // Mutation: Add words from Dictionary
  const addWordsMutation = useMutation({
    mutationFn: ({ wordIds, sectionId }: { wordIds: string[]; sectionId?: string }) => {
      if (!lessonId) throw new Error('Missing lesson ID');
      return lessonService.addWords(lessonId, wordIds, sectionId);
    },
    onSuccess: () => {
      onWordsAdded();
      handleClose();
    },
    onError: (err: any) => {
      setImportModalError(err?.response?.data?.message || err?.message || 'Lỗi thêm từ vựng.');
    },
  });

  // Handle File select
  const handleFileSelect = useCallback(async (file: File) => {
    setImportModalError(null);
    setImportFile(file);
    setImportIsReadingFile(true);

    try {
      const result = await parseFileToWordsDetailed(file);
      if (result.words.length === 0) {
        setImportModalError(t('import_file_empty_warning', 'File không chứa từ vựng nào hợp lệ.'));
        setFileParseResult(null);
      } else {
        setFileParseResult(result);
      }
    } catch {
      setImportModalError(t('import_file_error_parse', 'Không thể đọc file. Vui lòng kiểm tra định dạng.'));
      setFileParseResult(null);
    } finally {
      setImportIsReadingFile(false);
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  // Execute bulk import word list into lesson
  const handleExecuteImport = async () => {
    setImportModalError(null);
    const wordsToImport = effectiveWordsToImport;

    if (wordsToImport.length === 0) {
      setImportModalError(t('import_file_empty_warning', 'Không tìm thấy từ vựng nào hợp lệ để import.'));
      return;
    }

    setIsImportSubmitting(true);
    try {
      // 1. Query in words db
      const res = await wordService.bulkLookup(wordsToImport);
      const found: WordListItem[] = res.data?.found || (res as any).found || [];
      const notFound: string[] = res.data?.notFound || (res as any).notFound || [];

      // 2. Identify which found words need to be added to this lesson
      const newWordIds = found
        .filter((w) => !existingWordIds.has(w._id))
        .map((w) => w._id);

      const alreadyInCount = found.length - newWordIds.length;

      // 3. Add all found words to the lesson
      if (newWordIds.length > 0 && lessonId) {
        await lessonService.addWords(lessonId, newWordIds, importTargetSectionId || undefined);
        onWordsAdded();
      }

      // 4. Close modal and set the summary notification for the user!
      handleClose();

      onImportSummary({
        totalInput: wordsToImport.length,
        addedCount: newWordIds.length,
        alreadyInCount,
        notFoundWords: notFound,
      });
    } catch (err: any) {
      setImportModalError(err?.response?.data?.message || err?.message || 'Có lỗi xảy ra trong quá trình import.');
    } finally {
      setIsImportSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 max-w-3xl w-full space-y-4 max-h-[88vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h4 className="font-bold text-base text-slate-900">
              {t('add_words_modal_title', 'Thêm từ vựng')}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {addWordTab === 'search'
                ? t('select_words_from_dict_hint', 'Tìm kiếm và chọn từ vựng từ kho từ điển')
                : t('import_file_desc', 'Tải file Excel/CSV hoặc dán danh sách từ để tra cứu và thêm vào bài học')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {addWordTab === 'search' && (
              <button
                type="button"
                onClick={() => onNavigateToCreateWord(targetDictSectionId || undefined)}
                title={t('create_new_word_in_bank_hint', 'Chuyển sang trang tạo từ vựng mới rồi tự động thêm vào bài học')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('create_new_word_in_bank', 'Tạo từ mới')}</span>
                <ExternalLink className="w-3 h-3 text-blue-500 ml-0.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setAddWordTab('search')}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              addWordTab === 'search'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t('tab_choose_from_dict', 'Chọn từ điển')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAddWordTab('import')}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              addWordTab === 'import'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t('import_words_list_tab', 'Import danh sách từ')}</span>
          </button>
        </div>

        {/* ===== TAB 1: SEARCH DICTIONARY ===== */}
        {addWordTab === 'search' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="grid grid-cols-3 gap-2.5 shrink-0">
              <div className="col-span-2 border border-slate-200 rounded-xl flex items-center gap-3 px-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchDict}
                  onChange={(e) => setSearchDict(e.target.value)}
                  placeholder={t('search_dict_placeholder', 'Tìm từ vựng từ điển...')}
                  className="w-full text-xs focus:outline-none"
                />
              </div>
              <Select
                value={targetDictSectionId || 'unassigned'}
                onValueChange={(val) => setTargetDictSectionId(val === 'unassigned' ? '' : val)}
              >
                <SelectTrigger className="h-[36px] w-full rounded-xl text-xs border-slate-200 bg-white">
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
            <div className="flex-1 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2.5 min-h-0">
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
                    onClick={() => onNavigateToCreateWord(targetDictSectionId || undefined)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('create_new_word_in_bank', 'Tạo từ mới')}</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dictWords.map((w) => {
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
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          isAdded
                            ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-blue-50 border-blue-300 shadow-xs cursor-pointer'
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            disabled={isAdded}
                            checked={isAdded || isSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded text-blue-600 pointer-events-none shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">{w.word}</span>
                              {w.level && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                                  {w.level}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {w.parts?.[0]?.meanings?.[0]?.translation?.[0] || w.parts?.[0]?.meanings?.[0]?.definition}
                            </p>
                          </div>
                        </div>
                        {isAdded && (
                          <span className="text-[10px] text-emerald-600 font-semibold shrink-0 ml-1.5">
                            {t('already_in_lesson_badge', 'Đã có')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 text-xs">
              <span className="font-semibold text-blue-600">{t('selected_words_count', { count: selectedDictWordIds.length })}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel', 'Hủy')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addWordsMutation.mutate({
                      wordIds: selectedDictWordIds,
                      sectionId: targetDictSectionId || undefined,
                    });
                  }}
                  disabled={selectedDictWordIds.length === 0 || addWordsMutation.isPending}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                >
                  {addWordsMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{t('add_to_lesson_action', 'Thêm vào bài học')}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB 2: IMPORT DANH SÁCH TỪ ===== */}
        {addWordTab === 'import' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto min-h-0 pr-1">
            {/* Import error message if any */}
            {importModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium shrink-0 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{importModalError}</span>
                <button
                  type="button"
                  onClick={() => setImportModalError(null)}
                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Top controls: Target Section Selector & Input Type Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  {t('select_group_target', 'Nhóm từ vựng (Tùy chọn)')}
                </label>
                <Select
                  value={importTargetSectionId || 'unassigned'}
                  onValueChange={(val) => setImportTargetSectionId(val === 'unassigned' ? '' : val)}
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

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  {t('import_method_label', 'Phương thức nhập')}
                </label>
                <div className="flex bg-slate-100 p-1 rounded-xl h-[34px]">
                  <button
                    type="button"
                    onClick={() => setImportSourceType('file')}
                    className={`flex-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      importSourceType === 'file'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>{t('import_tab_file', 'Tải file Excel / CSV')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportSourceType('text')}
                    className={`flex-1 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      importSourceType === 'text'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>{t('import_tab_text', 'Dán danh sách từ')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mode 1: File Upload (Excel / CSV) */}
            {importSourceType === 'file' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                {!importFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${
                      isDraggingOver
                        ? 'border-blue-400 bg-blue-50/70 scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        isDraggingOver ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-slate-700">
                        {t('import_file_drop_hint', 'Kéo thả hoặc click để chọn file')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t('import_file_supported', 'Hỗ trợ: .xlsx, .csv, .xls')}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                      <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>
                        {t('import_file_column_hint', 'Cột đầu tiên hoặc cột có tiêu đề "Word" sẽ được đọc')}
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate max-w-[280px]">
                              {importFile.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {(importFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={resetImportState}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{t('import_file_reset', 'Chọn file khác')}</span>
                        </button>
                      </div>

                      {importIsReadingFile ? (
                        <div className="flex items-center gap-2 text-xs text-blue-600 py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('import_file_processing', 'Đang xử lý file...')}</span>
                        </div>
                      ) : fileParseResult && (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-blue-50 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-blue-800">
                                {t('import_detected_words', {
                                  count: fileParseResult.words.length,
                                  defaultValue: `Đã nhận diện ${fileParseResult.words.length} từ hợp lệ`,
                                })}
                              </span>
                              {fileParseResult.rawCount > fileParseResult.words.length && (
                                <span className="text-blue-600/70 text-[11px]">
                                  {t('import_raw_count_info', {
                                    total: fileParseResult.rawCount,
                                    defaultValue: `(từ ${fileParseResult.rawCount} mục trong file)`,
                                  })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {fileParseResult.words.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setIsShowWordsList((prev) => !prev)}
                                  className="text-blue-700 hover:text-blue-900 font-semibold cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                >
                                  {isShowWordsList ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  <span>
                                    {isShowWordsList
                                      ? t('import_hide_all_words', 'Ẩn danh sách từ')
                                      : t('import_view_all_words', {
                                          count: fileParseResult.words.length,
                                          defaultValue: `Xem danh sách từ (${fileParseResult.words.length})`,
                                        })}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Duplicate Warning */}
                          {fileParseResult.duplicates.length > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                {t('import_detected_duplicates', {
                                  count: fileParseResult.duplicates.length,
                                  words: fileParseResult.duplicates.slice(0, 10).join(', ') + (fileParseResult.duplicates.length > 10 ? '...' : ''),
                                  defaultValue: `Có ${fileParseResult.duplicates.length} từ bị trùng lặp: ${fileParseResult.duplicates.slice(0, 10).join(', ')} (đã tự động gộp)`,
                                })}
                              </span>
                            </div>
                          )}

                          {/* Skipped Warning */}
                          {fileParseResult.skipped.length > 0 && (
                            <div className="p-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-[11px] flex items-start gap-1.5">
                              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                              <span>
                                {t('import_detected_skipped', {
                                  count: fileParseResult.skipped.length,
                                  words: fileParseResult.skipped.slice(0, 10).join(', ') + (fileParseResult.skipped.length > 10 ? '...' : ''),
                                  defaultValue: `Có ${fileParseResult.skipped.length} dòng không hợp lệ: ${fileParseResult.skipped.slice(0, 10).join(', ')} (đã bỏ qua)`,
                                })}
                              </span>
                            </div>
                          )}

                          {/* Preview / List of detected words */}
                          {fileParseResult.words.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                {isShowWordsList
                                  ? t('all_words_list', 'Tất cả các từ:')
                                  : t('preview_words_label', 'Xem trước các từ:')}
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {(isShowWordsList
                                  ? fileParseResult.words
                                  : fileParseResult.words.slice(0, 40)
                                ).map((w, idx) => (
                                  <span
                                    key={`${w}-${idx}`}
                                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 font-mono shadow-2xs inline-flex items-center gap-1"
                                  >
                                    <span className="text-[10px] font-semibold text-slate-400">#{idx + 1}</span>
                                    <span className="font-semibold text-slate-800">{w}</span>
                                  </span>
                                ))}
                                {!isShowWordsList && fileParseResult.words.length > 40 && (
                                  <button
                                    type="button"
                                    onClick={() => setIsShowWordsList(true)}
                                    className="px-2 py-0.5 text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                  >
                                    {t('more_words_count', {
                                      count: fileParseResult.words.length - 40,
                                      defaultValue: `+${fileParseResult.words.length - 40} từ khác... (bấm để xem hết)`,
                                    })}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Paste Word List */}
            {importSourceType === 'text' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={t(
                    'import_paste_placeholder',
                    'Nhập hoặc dán danh sách từ tiếng Anh (ngăn cách bằng dấu phẩy, chấm phẩy hoặc xuống dòng)... Ví dụ: apple, banana, computer'
                  )}
                  className="w-full h-36 p-3 text-xs rounded-xl border border-slate-200 focus:outline-none font-mono resize-none leading-relaxed shrink-0"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-700">
                      {t('import_detected_words', {
                        count: textParseResult.words.length,
                        defaultValue: `Đã nhận diện ${textParseResult.words.length} từ hợp lệ`,
                      })}
                    </span>
                    {textParseResult.rawCount > textParseResult.words.length && (
                      <span className="text-slate-400">
                        {t('import_raw_count_info', {
                          total: textParseResult.rawCount,
                          defaultValue: `(từ ${textParseResult.rawCount} dòng)`,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {textParseResult.words.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsShowWordsList((prev) => !prev)}
                        className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        {isShowWordsList ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>
                          {isShowWordsList
                            ? t('import_hide_all_words', 'Ẩn danh sách từ')
                            : t('import_view_all_words', {
                                count: textParseResult.words.length,
                                defaultValue: `Xem danh sách từ (${textParseResult.words.length})`,
                              })}
                        </span>
                      </button>
                    )}
                    {textParseResult.words.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setImportText('')}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {t('clear_all', 'Xóa hết')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Duplicate Warning */}
                {textParseResult.duplicates.length > 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] flex items-start gap-1.5 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {t('import_detected_duplicates', {
                        count: textParseResult.duplicates.length,
                        words: textParseResult.duplicates.slice(0, 10).join(', ') + (textParseResult.duplicates.length > 10 ? '...' : ''),
                        defaultValue: `Có ${textParseResult.duplicates.length} từ bị trùng lặp: ${textParseResult.duplicates.slice(0, 10).join(', ')} (đã tự động gộp)`,
                      })}
                    </span>
                  </div>
                )}

                {/* Skipped Warning */}
                {textParseResult.skipped.length > 0 && (
                  <div className="p-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-[11px] flex items-start gap-1.5 shrink-0">
                    <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      {t('import_detected_skipped', {
                        count: textParseResult.skipped.length,
                        words: textParseResult.skipped.slice(0, 10).join(', ') + (textParseResult.skipped.length > 10 ? '...' : ''),
                        defaultValue: `Có ${textParseResult.skipped.length} dòng không hợp lệ: ${textParseResult.skipped.slice(0, 10).join(', ')} (đã bỏ qua)`,
                      })}
                    </span>
                  </div>
                )}

                {/* Expandable list of all recognized words */}
                {isShowWordsList && textParseResult.words.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 space-y-1.5 max-h-36 overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('import_view_all_words', {
                        count: textParseResult.words.length,
                        defaultValue: `Danh sách từ đã nhận diện (${textParseResult.words.length}):`,
                      })}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {textParseResult.words.map((w, idx) => (
                        <span
                          key={`${w}-${idx}`}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 font-mono shadow-2xs inline-flex items-center gap-1"
                        >
                          <span className="text-[10px] font-semibold text-slate-400">#{idx + 1}</span>
                          <span className="font-semibold text-slate-800">{w}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guidance hint */}
            <div className="px-2.5 py-2 bg-amber-50/60 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 flex items-start gap-1.5 shrink-0">
              <Info className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
              <span>
                {t(
                  'import_system_lookup_hint',
                  'Hệ thống sẽ tra cứu các từ trong kho từ điển. Các từ có sẵn sẽ được thêm vào bài học, các từ chưa có trong database sẽ được bỏ qua và thông báo lại sau khi import xong.'
                )}
              </span>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 text-xs">
              <span className="font-semibold text-blue-600">
                {effectiveWordsToImport.length > 0
                  ? t('selected_words_count', {
                      count: effectiveWordsToImport.length,
                      defaultValue: `${effectiveWordsToImport.length} từ đã chọn`,
                    })
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel', 'Hủy')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={
                    effectiveWordsToImport.length === 0 ||
                    isImportSubmitting ||
                    importIsReadingFile
                  }
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {isImportSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('import_processing_status', 'Đang tra cứu & thêm...')}</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>
                        {t('import_btn_execute', 'Import vào bài học')}
                        {effectiveWordsToImport.length > 0 ? ` (${effectiveWordsToImport.length})` : ''}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
