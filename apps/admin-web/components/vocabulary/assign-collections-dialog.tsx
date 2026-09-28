'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService } from '@/services/vocabulary.service';
import { CollectionItem, VocabularyGroupItem } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FolderPlus,
  Search,
  Check,
  Loader2,
  BookOpen,
  GraduationCap,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface AssignCollectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: VocabularyGroupItem | null;
  currentCollectionIds?: string[];
  onSuccess?: () => void;
}

export function AssignCollectionsDialog({
  open,
  onOpenChange,
  group,
  currentCollectionIds = [],
  onSuccess,
}: AssignCollectionsDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'unassigned' | 'all'>('unassigned');
  const [selectedColIds, setSelectedColIds] = useState<string[]>([]);

  // Fetch all collections (100 items)
  const {
    data: allCollectionsResponse,
    isLoading,
  } = useQuery({
    queryKey: ['all-collections-for-assign'],
    queryFn: () => collectionService.getAll({ limit: 100 }),
    enabled: open,
  });

  const allCollections: CollectionItem[] = useMemo(() => {
    return allCollectionsResponse?.data?.data || [];
  }, [allCollectionsResponse]);

  // Filter out collections already in this group
  const availableCollections = useMemo(() => {
    return allCollections.filter((c) => !currentCollectionIds.includes(c._id));
  }, [allCollections, currentCollectionIds]);

  // Apply tab filter & search
  const filteredCollections = useMemo(() => {
    return availableCollections.filter((c) => {
      // Tab filter
      if (filterMode === 'unassigned') {
        const hasGroup = !!c.groupId;
        if (hasGroup) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [availableCollections, filterMode, search]);

  const toggleSelect = (id: string) => {
    setSelectedColIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const visibleIds = filteredCollections.map((c) => c._id);
    const allSelected = visibleIds.every((id) => selectedColIds.includes(id));
    if (allSelected) {
      setSelectedColIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedColIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!group?._id || selectedColIds.length === 0) return;
      return collectionService.assignGroup(selectedColIds, group._id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
      setSelectedColIds([]);
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedColIds([]);
      setSearch('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden bg-white border border-slate-200 rounded-[6px] shadow-none">
        <DialogHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[6px] bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {t('assign_dialog_title', {
                  name: group?.name || '',
                  defaultValue: `Phân bộ sưu tập vào nhóm: ${group?.name}`,
                })}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t('assign_dialog_desc', 'Chọn các bộ sưu tập có sẵn để đưa vào nhóm này')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3.5">
          {/* Controls: Search + Tabs */}
          <div className="space-y-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('assign_search_placeholder', 'Tìm kiếm bộ sưu tập theo tên...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white rounded-[6px] border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-slate-900"
              />
            </div>

            {/* Filter Tabs & Select All */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-[6px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('unassigned')}
                  className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                    filterMode === 'unassigned'
                      ? 'bg-white text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('assign_tab_unassigned', {
                    count: availableCollections.filter((c) => !c.groupId).length,
                    defaultValue: `Chưa có nhóm (${availableCollections.filter((c) => !c.groupId).length})`,
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-white text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('assign_tab_all', {
                    count: availableCollections.length,
                    defaultValue: `Tất cả bộ sưu tập (${availableCollections.length})`,
                  })}
                </button>
              </div>

              {filteredCollections.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 cursor-pointer"
                >
                  {filteredCollections.every((c) => selectedColIds.includes(c._id))
                    ? t('assign_deselect_all', 'Bỏ chọn tất cả')
                    : t('assign_select_all', 'Chọn tất cả')}
                </button>
              )}
            </div>
          </div>

          {/* List of Collections */}
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">{t('loading_collections', 'Đang tải danh sách bộ sưu tập...')}</span>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1.5 border border-dashed border-slate-200 rounded-[6px]">
                <AlertCircle className="w-7 h-7 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  {search
                    ? t('assign_empty_search', 'Không tìm thấy bộ sưu tập phù hợp')
                    : filterMode === 'unassigned'
                      ? t('assign_empty_unassigned', 'Không có bộ sưu tập nào chưa có nhóm')
                      : t('assign_empty_all', 'Không có bộ sưu tập nào khả dụng')}
                </p>
                <p className="text-[11px] text-slate-400">
                  {filterMode === 'unassigned'
                    ? t('assign_empty_unassigned_hint', 'Bạn có thể chuyển sang tab "Tất cả bộ sưu tập" để chuyển nhóm.')
                    : t('assign_empty_all_hint', 'Hãy tạo bộ sưu tập mới ở trang Bộ sưu tập trước.')}
                </p>
              </div>
            ) : (
              filteredCollections.map((col) => {
                const isChecked = selectedColIds.includes(col._id);
                const hasOtherGroup = !!col.groupId;
                const otherGroupName =
                  typeof col.groupId === 'object' && col.groupId !== null
                    ? (col.groupId as any).name
                    : null;

                return (
                  <div
                    key={col._id}
                    onClick={() => toggleSelect(col._id)}
                    className={`p-2.5 rounded-[6px] border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Custom Checkbox */}
                      <div
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Thumbnail or fallback (16:9) */}
                      <div className="w-14 aspect-[16/9] rounded-[4px] overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                        {col.coverUrl ? (
                          <img
                            src={col.coverUrl}
                            alt={col.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {col.name}
                          </h4>
                          {hasOtherGroup && (
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              {t('assign_belongs_to', {
                                name: otherGroupName || t('other_group', 'Nhóm khác'),
                                defaultValue: `Thuộc: ${otherGroupName || 'Nhóm khác'}`,
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-slate-400" />
                            <span>{col.lessonsCount || 0} {t('lessons_label', 'bài')}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            <span>{col.wordsCount || 0} {t('words_label', 'từ')}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500 font-medium">
              {t('assign_selected_count', {
                count: selectedColIds.length,
                defaultValue: `Đã chọn: ${selectedColIds.length} bộ sưu tập`,
              })}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
              >
                {t('cancel', 'Hủy')}
              </button>
              <button
                type="button"
                disabled={selectedColIds.length === 0 || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-[6px] transition-colors disabled:opacity-50 cursor-pointer shadow-none"
              >
                {assignMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {t('assign_submit_btn', {
                    count: selectedColIds.length,
                    defaultValue: `Thêm vào nhóm (${selectedColIds.length})`,
                  })}
                </span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
