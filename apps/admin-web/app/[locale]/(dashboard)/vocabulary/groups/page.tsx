'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  vocabularyGroupService,
  collectionService,
} from '@/services/vocabulary.service';
import {
  VocabularyGroupItem,
  CollectionItem,
} from '@/types/vocabulary';
import { CreateGroupDialog } from '@/components/vocabulary/create-group-dialog';
import { EditGroupDialog } from '@/components/vocabulary/edit-group-dialog';
import { DeleteGroupDialog } from '@/components/vocabulary/delete-group-dialog';
import { ChangeGroupDialog } from '@/components/vocabulary/change-group-dialog';
import { AssignCollectionsDialog } from '@/components/vocabulary/assign-collections-dialog';
import {
  Layers,
  FolderKanban,
  BookOpen,
  GraduationCap,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  Lightbulb,
  FolderSync,
  FolderMinus,
  FolderPlus,
  GripVertical,
  Loader2,
} from 'lucide-react';

// Helper to determine style and icon for each group matching the design
function getGroupBadge(name: string = '', slug: string = '') {
  const lowerName = name.toLowerCase();
  const lowerSlug = slug.toLowerCase();

  if (lowerName.includes('toeic') || lowerSlug.includes('toeic')) {
    return {
      bg: 'bg-blue-600',
      text: 'TOEIC',
      type: 'text' as const,
    };
  }

  if (lowerName.includes('ielts') || lowerSlug.includes('ielts')) {
    return {
      bg: 'bg-purple-600',
      text: 'IELTS',
      type: 'text' as const,
    };
  }

  if (
    lowerName.includes('general') ||
    lowerName.includes('tổng quát') ||
    lowerSlug.includes('general')
  ) {
    return {
      bg: 'bg-emerald-600',
      text: 'A B* C',
      type: 'badge' as const,
    };
  }

  if (
    lowerName.includes('giáo trình') ||
    lowerName.includes('sách') ||
    lowerSlug.includes('giao-trinh') ||
    lowerName.includes('textbook')
  ) {
    return {
      bg: 'bg-orange-500',
      icon: BookOpen,
      type: 'icon' as const,
    };
  }

  return {
    bg: 'bg-indigo-600',
    icon: Layers,
    type: 'icon' as const,
  };
}

export default function VocabularyGroupsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('vocabulary');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const urlGroupId = searchParams.get('groupId');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(urlGroupId);

  // Active dropdown menu trackers
  const [groupHeaderMenuOpen, setGroupHeaderMenuOpen] = useState(false);
  const [activeColMenuId, setActiveColMenuId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setGroupHeaderMenuOpen(false);
      setActiveColMenuId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Dialog states for Group
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VocabularyGroupItem | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<VocabularyGroupItem | null>(null);

  // Dialog states for Collections (Assign & Move)
  const [assignColOpen, setAssignColOpen] = useState(false);
  const [changingGroupCol, setChangingGroupCol] = useState<CollectionItem | null>(null);

  // 1. Fetch all groups
  const {
    data: groupsResponse,
    isLoading: isGroupsLoading,
  } = useQuery({
    queryKey: ['vocabulary-groups'],
    queryFn: () => vocabularyGroupService.getAll({ limit: 100 }),
  });

  const groups: VocabularyGroupItem[] = useMemo(() => {
    return groupsResponse?.data?.data || [];
  }, [groupsResponse]);

  // Sync selected group on initial load
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      if (urlGroupId && groups.some((g: VocabularyGroupItem) => g._id === urlGroupId)) {
        setSelectedGroupId(urlGroupId);
      } else if (groups[0]?._id) {
        setSelectedGroupId(groups[0]._id);
      }
    }
  }, [groups, selectedGroupId, urlGroupId]);

  // Selected Group details
  const selectedGroup: VocabularyGroupItem | null = useMemo(() => {
    return groups.find((g: VocabularyGroupItem) => g._id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  // 2. Fetch collections for selected group (with live details)
  const {
    data: collectionsResponse,
    isLoading: isCollectionsLoading,
  } = useQuery({
    queryKey: ['collections', 'by-group', selectedGroupId],
    queryFn: () => collectionService.getAll({ groupId: selectedGroupId || undefined, limit: 100 }),
    enabled: !!selectedGroupId,
  });

  const collections: CollectionItem[] = useMemo(() => {
    return collectionsResponse?.data?.data || selectedGroup?.collections || [];
  }, [collectionsResponse, selectedGroup]);

  // Filter groups by search query
  const filteredGroups: VocabularyGroupItem[] = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g: VocabularyGroupItem) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // Total stats across all groups
  const totalCollectionsAll = useMemo(() => {
    return groups.reduce((acc: number, g: VocabularyGroupItem) => acc + (g.collectionsCount || 0), 0);
  }, [groups]);

  // Stats for the currently selected group
  const totalLessonsInGroup = useMemo(() => {
    return collections.reduce((acc: number, c: CollectionItem) => acc + (c.lessonsCount || 0), 0);
  }, [collections]);

  const totalWordsInGroup = useMemo(() => {
    return collections.reduce((acc: number, c: CollectionItem) => acc + (c.wordsCount || 0), 0);
  }, [collections]);

  const selectGroup = (id: string) => {
    setSelectedGroupId(id);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('groupId', id);
    router.replace(`/${locale}/vocabulary/groups?${newParams.toString()}`);
  };

  // Remove collection from this group (unassign)
  const removeFromGroupMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      return collectionService.update(collectionId, { groupId: null as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
    },
  });

  // Reorder Groups
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const reorderGroupsMutation = useMutation({
    mutationFn: (items: { id: string; order: number }[]) =>
      vocabularyGroupService.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-groups'] });
    },
  });

  const handleDropGroup = (targetGroupId: string) => {
    if (!draggedGroupId || draggedGroupId === targetGroupId) {
      setDraggedGroupId(null);
      setDragOverGroupId(null);
      return;
    }
    const sourceIndex = groups.findIndex((g) => g._id === draggedGroupId);
    const targetIndex = groups.findIndex((g) => g._id === targetGroupId);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedGroupId(null);
      setDragOverGroupId(null);
      return;
    }

    const newGroups = [...groups];
    const [movedItem] = newGroups.splice(sourceIndex, 1);
    if (!movedItem) return;
    newGroups.splice(targetIndex, 0, movedItem);

    const reorderedItems = newGroups.map((item, idx) => ({
      id: item._id,
      order: idx + 1,
    }));

    queryClient.setQueryData(['vocabulary-groups'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: newGroups.map((item, idx) => ({ ...item, order: idx + 1 })),
        },
      };
    });

    reorderGroupsMutation.mutate(reorderedItems);
    setDraggedGroupId(null);
    setDragOverGroupId(null);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      <header className='flex items-center justify-between pb-6'>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {t('groups_page_header_title', { defaultValue: 'Nhóm từ vựng' })}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('groups_page_header_desc', {
              defaultValue:
                'Quản lý nhóm và phân loại các bộ sưu tập theo mục tiêu học tập, chứng chỉ hoặc giáo trình',
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateGroupOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition-colors cursor-pointer shrink-0"
          title={t('groups_add_btn', 'Thêm nhóm')}
        >
          <Plus className="w-3 h-3" />
          <span>{t('groups_add_btn', 'Thêm nhóm')}</span>
        </button>
      </header>
      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Groups List */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3.5 border p-4 rounded-[6px] border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {t('groups_title', 'Các nhóm từ vựng')}
              </h1>
              {reorderGroupsMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              )}
            </div>
            <p className="text-xs text-slate-400 font-normal">
              {t('groups_subtitle', {
                groupCount: groups.length,
                collectionCount: totalCollectionsAll,
                defaultValue: `${groups.length} nhóm · ${totalCollectionsAll} bộ sưu tập`,
              })}
            </p>
          </div>

          {/* Groups Cards List */}
          {isGroupsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-[6px] bg-white border border-slate-200 p-2.5 flex items-center gap-2.5 animate-pulse"
                >
                  <div className="w-3.5 h-3.5 bg-slate-100 rounded" />
                  <div className="w-5 h-5 rounded-[4px] bg-slate-100" />
                  <div className="w-8 h-8 rounded-[6px] bg-slate-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-28 bg-slate-100 rounded-[4px]" />
                    <div className="h-2.5 w-40 bg-slate-100 rounded-[4px]" />
                  </div>
                  <div className="w-4 h-4 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-[6px] border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t('groups_not_found', 'Không tìm thấy nhóm từ vựng')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? t('groups_not_found_desc_search', 'Thử thay đổi từ khóa tìm kiếm.')
                    : t('groups_not_found_desc_empty', 'Hãy tạo nhóm từ vựng đầu tiên để bắt đầu phân loại bộ sưu tập.')}
                </p>
              </div>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setCreateGroupOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('groups_create_first', 'Tạo nhóm mới')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGroups.map((group: VocabularyGroupItem, idx: number) => {
                const isSelected = group._id === selectedGroupId;
                const isDragging = draggedGroupId === group._id;
                const isDragOver = dragOverGroupId === group._id;
                const badge = getGroupBadge(group.name, group.slug);

                return (
                  <div
                    key={group._id}
                    draggable={!searchQuery.trim()}
                    onDragStart={(e) => {
                      setDraggedGroupId(group._id);
                      e.dataTransfer.setData('text/plain', group._id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverGroupId !== group._id) {
                        setDragOverGroupId(group._id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverGroupId === group._id) {
                        setDragOverGroupId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropGroup(group._id);
                    }}
                    onDragEnd={() => {
                      setDraggedGroupId(null);
                      setDragOverGroupId(null);
                    }}
                    onClick={() => selectGroup(group._id)}
                    className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-[6px] border transition-all duration-150 cursor-pointer ${
                      isDragging
                        ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/40'
                        : isDragOver
                        ? 'border-blue-500 bg-blue-50/30'
                        : isSelected
                        ? 'bg-blue-50/70 border-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 transition-colors p-0.5 shrink-0"
                        title={t('drag_to_reorder', { defaultValue: 'Kéo thả để đổi thứ tự' })}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Order Badge */}
                      <span className="w-5 h-5 rounded-[4px] bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {group.order ?? (idx + 1)}
                      </span>

                      {/* Group Icon Badge */}
                     

                      {/* Title & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-sm font-semibold truncate transition-colors ${
                              isSelected ? 'text-blue-600 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {group.name}
                          </p>
                          {group.isActive === false && (
                            <span
                              className="w-2 h-2 rounded-full bg-slate-300 shrink-0"
                              title={t('inactive', { defaultValue: 'Inactive' })}
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {group.collectionsCount || 0} {t('collections_label', 'bộ sưu tập')} · {group.lessonsCount || 0} {t('lessons_label', 'bài học')} · {(group.wordsCount || 0).toLocaleString()} {t('words_label', 'từ')}
                        </p>
                      </div>
                    </div>

                    {/* Chevron Arrow */}
                    <div className="flex items-center shrink-0">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected
                            ? 'text-blue-500'
                            : 'text-slate-300 group-hover:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Selected Group Detail View */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3.5 border p-4 rounded-[6px] border-slate-200 bg-white">
          {selectedGroup ? (
            <>
              {/* Back to Collections Navigation Link */}
              <div>
                <Link
                  href={`/${locale}/vocabulary/collections`}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('group_back_to_collections', 'Thư viện từ vựng')}</span>
                </Link>
              </div>

              {/* Group Hero Header */}
              <div className="bg-white rounded-[6px] border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Big Group Icon */}
                    {(() => {
                      const badge = getGroupBadge(selectedGroup.name, selectedGroup.slug);
                      return (
                        <div
                          className={`w-12 h-12 rounded-[6px] flex items-center justify-center font-bold text-white shrink-0 ${badge.bg}`}
                        >
                          {badge.type === 'text' ? (
                            <span className="text-xs tracking-wider font-bold">
                              {badge.text}
                            </span>
                          ) : badge.type === 'badge' ? (
                            <div className="text-center leading-tight">
                              <span className="text-[9px] font-bold block">A</span>
                              <span className="text-[9px] font-bold block">B* C</span>
                            </div>
                          ) : badge.icon ? (
                            <badge.icon className="w-6 h-6 text-white" />
                          ) : (
                            <Layers className="w-6 h-6 text-white" />
                          )}
                        </div>
                      );
                    })()}

                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {selectedGroup.name}
                      </h2>
                    </div>
                  </div>

                  {/* Header: Single clean menu for Group actions (Edit / Delete) */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupHeaderMenuOpen(!groupHeaderMenuOpen);
                      }}
                      className="h-7 w-7 rounded-[4px] border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                      title={t('options', 'Tùy chọn')}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {groupHeaderMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 z-30 w-44 rounded-[6px] border border-slate-200 bg-white p-1 text-xs space-y-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setGroupHeaderMenuOpen(false);
                            setEditingGroup(selectedGroup);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-slate-700 hover:bg-slate-50 text-left font-medium transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t('group_option_edit', 'Chỉnh sửa nhóm')}</span>
                        </button>

                        <div className="h-px bg-slate-100 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setGroupHeaderMenuOpen(false);
                            setDeletingGroup(selectedGroup);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-rose-600 hover:bg-rose-50 text-left font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('group_option_delete', 'Xóa nhóm')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Informational Blue Notice Box (Exactly as shown in screenshot) */}
                
              </div>

              {/* Collections Section */}
              <div className="space-y-3">
                {/* Section Header: Total, Badges & Action Button */}
                <div className="flex items-center justify-between gap-3 px-0.5">
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('group_collections_header', {
                      count: collections.length,
                      defaultValue: `${collections.length} bộ sưu tập`,
                    })}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-normal">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      <span>{totalLessonsInGroup} {t('lessons_label', 'bài học')}</span>
                    </span>

                    <span className="flex items-center gap-1 font-normal">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{totalWordsInGroup.toLocaleString()} {t('words_label', 'từ')}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setAssignColOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-slate-200 hover:border-blue-400 bg-white text-blue-600 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>{t('group_assign_btn', 'Phân bộ sưu tập')}</span>
                    </button>
                  </div>
                </div>

                {/* List of Collections in this group */}
                {isCollectionsLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-20 rounded-[6px] bg-white border border-slate-200 p-3 animate-pulse flex items-center gap-3"
                      >
                        <div className="w-20 aspect-[16/9] rounded-[6px] bg-slate-100 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-36 bg-slate-100 rounded-[4px]" />
                          <div className="h-3 w-56 bg-slate-100 rounded-[4px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : collections.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-[6px] border border-slate-200 space-y-3">
                    <div className="w-10 h-10 rounded-[6px] bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {t('group_collections_empty_title', 'Chưa có bộ sưu tập nào trong nhóm này')}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {t('group_collections_empty_desc', 'Hãy chọn các bộ sưu tập đã có để đưa vào nhóm này.')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignColOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>{t('group_assign_btn_full', 'Phân bộ sưu tập vào nhóm')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {collections.map((col: CollectionItem) => (
                      <div
                        key={col._id}
                        className="group bg-white rounded-[6px] border border-slate-200 p-3 hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                      >
                        {/* Left: Thumbnail & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Thumbnail / Cover (16:9) */}
                          <div className="w-20 aspect-[16/9] rounded-[6px] overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                            {col.coverUrl ? (
                              <img
                                src={col.coverUrl}
                                alt={col.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-1">
                                <BookOpen className="w-4 h-4 text-slate-400 mx-auto" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <h4
                              onClick={() =>
                                router.push(`/${locale}/vocabulary/collections?collectionId=${col._id}`)
                              }
                              className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors truncate cursor-pointer"
                            >
                              {col.name}
                            </h4>

                            <div className="flex items-center gap-2.5 text-xs text-slate-500 font-normal mt-0.5">
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-slate-400" />
                                <span>{col.lessonsCount || 0} {t('lessons_label', 'bài học')}</span>
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-slate-400" />
                                <span>{col.wordsCount || 0} {t('words_label', 'từ')}</span>
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {col.description || t('no_description', 'Từ vựng theo bộ sưu tập này.')}
                            </p>
                          </div>
                        </div>

                        {/* Right: "Quản lý" button & Three-dots menu */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* "Quản lý" Button */}
                          <Link
                            href={`/${locale}/vocabulary/collections?collectionId=${col._id}`}
                            className="px-3.5 py-1 rounded-[6px] text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            {t('group_btn_manage', 'Quản lý')}
                          </Link>

                          {/* Subtle Three dots dropdown for secondary actions */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveColMenuId(activeColMenuId === col._id ? null : col._id);
                              }}
                              className="h-7 w-7 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeColMenuId === col._id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-8 z-30 w-44 rounded-[6px] border border-slate-200 bg-white p-1 text-xs space-y-0.5"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveColMenuId(null);
                                    setChangingGroupCol(col);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-slate-700 hover:bg-slate-50 text-left font-medium transition-colors cursor-pointer"
                                >
                                  <FolderSync className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{t('group_menu_move', 'Chuyển nhóm khác')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveColMenuId(null);
                                    removeFromGroupMutation.mutate(col._id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-amber-700 hover:bg-amber-50 text-left font-medium transition-colors cursor-pointer"
                                >
                                  <FolderMinus className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{t('group_menu_remove', 'Gỡ khỏi nhóm')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Lightbulb Tip Box (Exactly as shown in screenshot) */}
              <div className="rounded-[6px] p-3 bg-[#F4F9FF] border border-blue-100 flex items-start gap-2.5">
                <div className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="text-xs leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-900">
                    {t('group_tip_title', 'Để xem và quản lý các bài học, phần học, từ vựng chi tiết:')}
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {t('group_tip_desc', '→ Nhấn vào bộ sưu tập, sau đó bạn có thể thêm từ, tạo phần học, nhập từ vựng...')}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white rounded-[6px] border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('groups_select_prompt_title', 'Chọn một nhóm từ vựng')}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {t('groups_select_prompt_desc', 'Chọn một nhóm ở danh sách bên trái để phân loại các bộ sưu tập vào nhóm.')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* Dialogs */}
      {/* ======================================================== */}

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccessCreated={(newId) => selectGroup(newId)}
        defaultOrder={groups.length + 1}
      />

      {/* Edit Group Dialog */}
      <EditGroupDialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        group={editingGroup}
      />

      {/* Delete Group Dialog */}
      <DeleteGroupDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        group={deletingGroup}
        onSuccessDeleted={() => {
          if (deletingGroup?._id === selectedGroupId) {
            const remaining = groups.filter((g: VocabularyGroupItem) => g._id !== deletingGroup?._id);
            setSelectedGroupId(remaining[0]?._id || null);
          }
        }}
      />

      {/* Assign Collections to Group Dialog */}
      <AssignCollectionsDialog
        open={assignColOpen}
        onOpenChange={setAssignColOpen}
        group={selectedGroup}
        currentCollectionIds={collections.map((c: CollectionItem) => c._id)}
      />

      {/* Change Group Dialog */}
      <ChangeGroupDialog
        open={!!changingGroupCol}
        onOpenChange={(open) => !open && setChangingGroupCol(null)}
        collection={changingGroupCol}
        groups={groups}
      />
    </div>
  );
}
