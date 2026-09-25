'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { collectionService, lessonService } from '@/services/vocabulary.service';
import { CollectionItem, LessonItem } from '@/types/vocabulary';
import { CreateCollectionDialog } from '@/components/vocabulary/create-collection-dialog';
import { EditCollectionDialog } from '@/components/vocabulary/edit-collection-dialog';
import { DeleteCollectionDialog } from '@/components/vocabulary/delete-collection-dialog';
import { CreateLessonDialog } from '@/components/vocabulary/create-lesson-dialog';
import { EditLessonDialog } from '@/components/vocabulary/edit-lesson-dialog';
import { DeleteLessonDialog } from '@/components/vocabulary/delete-lesson-dialog';
import { LessonWordsDialog } from '@/components/vocabulary/lesson-words-dialog';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  FolderKanban,
  FileText,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  FolderPlus,
  BookPlus,
  Hash,
  GripVertical,
} from 'lucide-react';

const GRADIENT_PALETTES = [
  'from-blue-600 via-indigo-700 to-slate-900',
  'from-emerald-600 via-teal-700 to-slate-900',
  'from-purple-600 via-violet-700 to-slate-900',
  'from-amber-600 via-orange-700 to-slate-900',
  'from-rose-600 via-pink-700 to-slate-900',
  'from-cyan-600 via-blue-700 to-slate-900',
];

export default function CollectionsPage() {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';

  const urlCollectionId = searchParams.get('collectionId');
  const urlLessonId = searchParams.get('lessonId');

  const [searchCollection, setSearchCollection] = useState('');
  const [debouncedSearchCol, setDebouncedSearchCol] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(urlCollectionId);
  const [activeTab, setActiveTab] = useState<'lessons' | 'info'>('lessons');
  const [searchLesson, setSearchLesson] = useState('');

  // Drag and Drop states for Lessons
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  // Drag and Drop states for Collections
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Dialog states
  const [createColOpen, setCreateColOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<CollectionItem | null>(null);
  const [deletingCol, setDeletingCol] = useState<CollectionItem | null>(null);

  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<LessonItem | null>(null);
  const [managingWordsLesson, setManagingWordsLesson] = useState<LessonItem | null>(null);

  // Debounce search collection
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchCol(searchCollection);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchCollection]);

  // Query Collections
  const {
    data: collectionsRes,
    isLoading: isLoadingCols,
  } = useQuery({
    queryKey: ['collections', debouncedSearchCol],
    queryFn: () =>
      collectionService.getAll({
        search: debouncedSearchCol || undefined,
        limit: 50,
      }),
  });

  const collections: CollectionItem[] = collectionsRes?.data?.data || [];

  // Auto-select collection from URL param or fallback to first collection
  useEffect(() => {
    if (urlCollectionId && collections.some((c) => c._id === urlCollectionId)) {
      setSelectedId(urlCollectionId);
    } else if (collections.length > 0 && collections[0]) {
      if (!selectedId || !collections.some((c) => c._id === selectedId)) {
        setSelectedId(collections[0]._id);
      }
    } else {
      setSelectedId(null);
    }
  }, [collections, selectedId, urlCollectionId]);

  // Fetch target lesson if URL has lessonId (e.g. returning from Create Word page)
  const { data: targetLessonRes } = useQuery({
    queryKey: ['target-lesson', urlLessonId],
    queryFn: () => lessonService.getById(urlLessonId!),
    enabled: !!urlLessonId,
  });

  useEffect(() => {
    if (targetLessonRes?.data) {
      const lesson = targetLessonRes.data;
      if (lesson.collectionId && (!selectedId || selectedId !== lesson.collectionId)) {
        setSelectedId(lesson.collectionId);
      }
      setManagingWordsLesson(lesson);
    }
  }, [targetLessonRes, selectedId]);

  // Currently selected collection
  const currentCollection = useMemo(() => {
    return collections.find((c) => c._id === selectedId) || null;
  }, [collections, selectedId]);

  // Query Lessons for selected collection
  const {
    data: lessonsRes,
    isLoading: isLoadingLessons,
  } = useQuery({
    queryKey: ['lessons', currentCollection?._id],
    queryFn: () => lessonService.getAll(currentCollection!._id),
    enabled: !!currentCollection?._id,
  });

  const lessons: LessonItem[] = lessonsRes?.data || [];

  // Filter lessons by search query
  const filteredLessons = useMemo(() => {
    if (!searchLesson.trim()) return lessons;
    const q = searchLesson.toLowerCase();
    return lessons.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)),
    );
  }, [lessons, searchLesson]);

  // Toggle Collection Active Mutation
  const toggleColActiveMutation = useMutation({
    mutationFn: ({ id, nextActive }: { id: string; nextActive: boolean }) =>
      collectionService.toggleActive(id, nextActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Toggle Lesson Active Mutation
  const toggleLessonActiveMutation = useMutation({
    mutationFn: ({ id, nextActive }: { id: string; nextActive: boolean }) =>
      lessonService.toggleActive(id, nextActive),
    onSuccess: () => {
      if (currentCollection?._id) {
        queryClient.invalidateQueries({ queryKey: ['lessons', currentCollection._id] });
      }
    },
  });

  // Reorder Lessons Mutation
  const reorderLessonsMutation = useMutation({
    mutationFn: (items: { id: string; order: number }[]) => lessonService.reorder(items),
    onSuccess: () => {
      if (currentCollection?._id) {
        queryClient.invalidateQueries({ queryKey: ['lessons', currentCollection._id] });
      }
    },
  });

  // Reorder Collections Mutation
  const reorderColsMutation = useMutation({
    mutationFn: (items: { id: string; order: number }[]) => collectionService.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const handleDropLesson = (targetLessonId: string) => {
    if (!draggedLessonId || draggedLessonId === targetLessonId) {
      setDraggedLessonId(null);
      setDragOverLessonId(null);
      return;
    }
    const sourceIndex = lessons.findIndex((l) => l._id === draggedLessonId);
    const targetIndex = lessons.findIndex((l) => l._id === targetLessonId);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedLessonId(null);
      setDragOverLessonId(null);
      return;
    }

    const newLessons = [...lessons];
    const [movedItem] = newLessons.splice(sourceIndex, 1);
    if (!movedItem) return;
    newLessons.splice(targetIndex, 0, movedItem);

    const reorderedItems = newLessons.map((item, idx) => ({
      id: item._id,
      order: idx + 1,
    }));

    if (currentCollection?._id) {
      queryClient.setQueryData(['lessons', currentCollection._id], {
        data: newLessons.map((item, idx) => ({ ...item, order: idx + 1 })),
      });
    }

    reorderLessonsMutation.mutate(reorderedItems);
    setDraggedLessonId(null);
    setDragOverLessonId(null);
  };

  const handleDropCollection = (targetColId: string) => {
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }
    const sourceIndex = collections.findIndex((c) => c._id === draggedColId);
    const targetIndex = collections.findIndex((c) => c._id === targetColId);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }

    const newCols = [...collections];
    const [movedItem] = newCols.splice(sourceIndex, 1);
    if (!movedItem) return;
    newCols.splice(targetIndex, 0, movedItem);

    const reorderedItems = newCols.map((item, idx) => ({
      id: item._id,
      order: idx + 1,
    }));

    queryClient.setQueryData(['collections', debouncedSearchCol], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: newCols.map((item, idx) => ({ ...item, order: idx + 1 })),
        },
      };
    });

    reorderColsMutation.mutate(reorderedItems);
    setDraggedColId(null);
    setDragOverColId(null);
  };

  // Total words across lessons in this collection
  const totalWordsInLessons = useMemo(() => {
    return lessons.reduce((acc, l) => acc + (l.wordsCount || 0), 0);
  }, [lessons]);

  // Helper for color gradient based on string hash
  const getGradient = (name: string, index: number) => {
    const palIdx = (name.length + index) % GRADIENT_PALETTES.length;
    return GRADIENT_PALETTES[palIdx];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('collections_title', { defaultValue: 'Vocabulary Collections' })}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('collections_subtitle', {
              defaultValue: 'Manage curriculum, topics, and structured lessons.',
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateColOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm shadow-sm transition-all cursor-pointer shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          <span>{t('add_collection', { defaultValue: 'Add Collection' })}</span>
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Collection List */}
        <div className="sticky top-16 lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          {/* Search Collections */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchCollection}
              onChange={(e) => setSearchCollection(e.target.value)}
              placeholder={t('search_collections_placeholder', { defaultValue: 'Search collections...' })}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 bg-slate-50/50"
            />
          </div>

          {/* Collections List Content */}
          <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1 p-0.5">
            {isLoadingCols ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">{t('loading_collections', { defaultValue: 'Loading collections...' })}</span>
              </div>
            ) : collections.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {t('no_collections_found', { defaultValue: 'No collections found' })}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {t('start_first_collection', { defaultValue: 'Start by adding your first vocabulary collection.' })}
                </p>
                <button
                  type="button"
                  onClick={() => setCreateColOpen(true)}
                  className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('add_collection', { defaultValue: 'Add Collection' })}</span>
                </button>
              </div>
            ) : (
              collections.map((col, idx) => {
                const isSelected = col._id === currentCollection?._id;
                const cover = col.coverUrl || col.thumbnail;
                const gradient = getGradient(col.name, idx);
                const isDragging = draggedColId === col._id;
                const isDragOver = dragOverColId === col._id;

                return (
                  <div
                    key={col._id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedColId(col._id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', col._id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverColId !== col._id) {
                        setDragOverColId(col._id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverColId === col._id) {
                        setDragOverColId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropCollection(col._id);
                    }}
                    onDragEnd={() => {
                      setDraggedColId(null);
                      setDragOverColId(null);
                    }}
                    onClick={() => {
                      setSelectedId(col._id);
                      setSearchLesson('');
                    }}
                    className={`group flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${isDragging
                      ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/40 scale-[0.99]'
                      : isDragOver
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 shadow-md'
                        : isSelected
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
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

                      {/* Thumbnail Box (Compact 16:9) */}
                      {cover ? (
                        <div className="w-11 aspect-[16/9] rounded-md overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                          <img
                            src={cover}
                            alt={col.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-11 aspect-[16/9] rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-2xs`}
                        >
                          <FolderKanban className="w-3.5 h-3.5 text-white/90" />
                        </div>
                      )}

                      {/* Title & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-sm font-semibold truncate transition-colors ${isSelected ? 'text-blue-600 font-bold' : 'text-slate-800'
                              }`}
                          >
                            {col.name}
                          </p>
                          {col.isActive === false && (
                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" title={t('inactive', { defaultValue: 'Inactive' })} />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{col.lessonsCount ?? 0} {t('lessons_count', { defaultValue: 'lessons' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {/* <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCol(col);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title={t('edit_collection', { defaultValue: 'Edit collection' })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCol(col);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title={t('delete_collection', { defaultValue: 'Delete collection' })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div> */}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Collection Detail & Lessons */}
        <div className="lg:col-span-8 xl:col-span-9 rounded-2xl  bg-white shadow-xs">
          {currentCollection ? (
            <>
              <div className='sticky top-16 z-20 bg-white rounded-t-2xl'>
                {/* Sticky Top: Collection Header & Navigation Tabs */}
                <div className=" bg-white rounded-t-2xl px-6 pt-6 pb-0 border border-slate-200 shadow-xs">
                  {/* Collection Banner Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Large Thumbnail */}
                      {currentCollection.coverUrl || currentCollection.thumbnail ? (
                        <div className="w-36 sm:w-44 aspect-[16/9] rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                          <img  
                            src={currentCollection.coverUrl || currentCollection.thumbnail}
                            alt={currentCollection.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-36 sm:w-44 aspect-[16/9] rounded-2xl bg-gradient-to-br ${getGradient(
                            currentCollection.name,
                            0,
                          )} flex flex-col items-center justify-center text-white shrink-0 shadow-md p-3 text-center`}
                        >
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            {currentCollection.name.split(' ')[0]}
                          </span>
                          <span className="text-sm font-black mt-0.5 truncate max-w-full">
                            {currentCollection.name.split(' ')[1] || ''}
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl font-bold text-slate-900">
                            {currentCollection.name}
                          </h2>
                          {currentCollection.slug && (
                            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              /{currentCollection.slug}
                            </span>
                          )}

                          {/* Active Status Badge */}
                          <button
                            type="button"
                            onClick={() =>
                              toggleColActiveMutation.mutate({
                                id: currentCollection._id,
                                nextActive: !currentCollection.isActive,
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${currentCollection.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            title={t('click_to_toggle_status', { defaultValue: 'Click to toggle active status' })}
                          >
                            {currentCollection.isActive !== false ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{t('active', { defaultValue: 'Active' })}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-slate-400" />
                                <span>{t('inactive', { defaultValue: 'Inactive' })}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            {lessons.length} {t('total_lessons', { defaultValue: 'Lessons' })}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {totalWordsInLessons} {t('words_assigned', { defaultValue: 'Words assigned' })}
                          </span>
                        </div>

                        {currentCollection.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-0.5">
                            {currentCollection.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingCol(currentCollection)}
                        className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors cursor-pointer"
                        title={t('edit_collection', { defaultValue: 'Edit Collection' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingCol(currentCollection)}
                        className="p-2 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                        title={t('delete_collection', { defaultValue: 'Delete Collection' })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className='w-[calc(100%+4px)] bg-slate-50 h-10 absolute left-0 top-0 -translate-y-4 -translate-x-[2px] z-[-1]'>

                    </div>
                  </div>
                </div>


                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 -mb-px px-6 pt-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('lessons')}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'lessons'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t('lessons_tab', { defaultValue: 'Lessons' })}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                      {lessons.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'info'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>{t('info_tab', { defaultValue: 'Overview & Info' })}</span>
                  </button>
                </div>
              </div>

              {/* Main Tab Content */}
              <div className="p-6 space-y-6">
                {/* Tab 1: Lessons List */}
                {activeTab === 'lessons' && (
                  <div className="space-y-4">
                    {/* Actions bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchLesson}
                          onChange={(e) => setSearchLesson(e.target.value)}
                          placeholder={t('search_lessons_placeholder', { defaultValue: 'Search lessons in this collection...' })}
                          className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 bg-slate-50/50"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setCreateLessonOpen(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-sm transition-all cursor-pointer"
                      >
                        <BookPlus className="w-3.5 h-3.5" />
                        <span>{t('add_lesson', { defaultValue: 'Add Lesson' })}</span>
                      </button>
                    </div>

                    {/* Lessons Table / List */}
                    {isLoadingLessons ? (
                      <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs">{t('loading_lessons', { defaultValue: 'Loading lessons...' })}</span>
                      </div>
                    ) : filteredLessons.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">
                          {t('no_lessons_found', {
                            defaultValue: 'No lessons in this collection yet',
                          })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t('add_lessons_hint', { defaultValue: 'Add structured lessons to organize learning milestones.' })}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCreateLessonOpen(true)}
                          className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('add_lesson', { defaultValue: 'Create First Lesson' })}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredLessons.map((l, index) => {
                          const isDragging = draggedLessonId === l._id;
                          const isDragOver = dragOverLessonId === l._id;

                          return (
                            <div
                              key={l._id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedLessonId(l._id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', l._id);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverLessonId !== l._id) {
                                  setDragOverLessonId(l._id);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverLessonId === l._id) {
                                  setDragOverLessonId(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropLesson(l._id);
                              }}
                              onDragEnd={() => {
                                setDraggedLessonId(null);
                                setDragOverLessonId(null);
                              }}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all duration-150 ${isDragging
                                ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/40 scale-[0.99]'
                                : isDragOver
                                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 shadow-md scale-[1.005]'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                                }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Drag Handle */}
                                <div
                                  className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 transition-colors p-0.5 shrink-0"
                                  title={t('drag_to_reorder', { defaultValue: 'Kéo thả để đổi thứ tự' })}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                {/* Order Badge */}
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                                  {l.order ?? index + 1}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-900">
                                      {l.title}
                                    </span>
                                    {l.slug && (
                                      <span className="font-mono text-[11px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                        /{l.slug}
                                      </span>
                                    )}

                                    {/* Active toggle */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleLessonActiveMutation.mutate({
                                          id: l._id,
                                          nextActive: !l.isActive,
                                        })
                                      }
                                      title={t('click_to_toggle_status', { defaultValue: 'Click to toggle active status' })}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${l.isActive !== false
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                        }`}
                                    >
                                      {l.isActive !== false ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                                    <span className="font-semibold text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                                      <Layers className="w-3 h-3 text-purple-500" />
                                      {l.sectionsCount ?? 0} {t('sections_label', { defaultValue: 'sections' })}
                                    </span>
                                    <span className="font-semibold text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                      <BookOpen className="w-3 h-3 text-blue-500" />
                                      {l.wordsCount ?? 0} {t('words_label', { defaultValue: 'words' })}
                                    </span>
                                    {l.description && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-400 truncate max-w-md">
                                          {l.description}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setManagingWordsLesson(l)}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                >
                                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{t('manage_content', { defaultValue: 'Manage Content' })}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingLesson(l)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                  title={t('edit_lesson', { defaultValue: 'Edit Lesson' })}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeletingLesson(l)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={t('delete_lesson', { defaultValue: 'Delete Lesson' })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Overview & Info */}
                {activeTab === 'info' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {t('collection_name', { defaultValue: 'Collection Name' })}
                        </span>
                        <p className="text-sm font-bold text-slate-900">
                          {currentCollection.name}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {t('slug_label', { defaultValue: 'Slug (Định danh URL)' })}
                        </span>
                        <p className="text-sm font-mono font-bold text-blue-600">
                          /{currentCollection.slug || '—'}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {t('order', { defaultValue: 'Order' })}
                        </span>
                        <p className="text-sm font-bold text-slate-900">
                          {currentCollection.order ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {t('status', { defaultValue: 'Status' })}
                        </span>
                        <p className="text-sm font-bold text-slate-900">
                          {currentCollection.isActive !== false ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {t('description', { defaultValue: 'Description' })}
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {currentCollection.description || t('no_description', { defaultValue: 'No description provided.' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-24 text-center">
              <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {t('no_collection_selected', { defaultValue: 'No Collection Selected' })}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t('no_collection_selected_desc', {
                  defaultValue:
                    'Select a collection from the list on the left to view lessons and vocabulary.',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collection Dialogs */}
      <CreateCollectionDialog
        open={createColOpen}
        onOpenChange={setCreateColOpen}
        onSuccessCreated={(id) => setSelectedId(id)}
        defaultOrder={collections.length + 1}
      />

      <EditCollectionDialog
        open={!!editingCol}
        collection={editingCol}
        onOpenChange={(v) => {
          if (!v) setEditingCol(null);
        }}
      />

      <DeleteCollectionDialog
        open={!!deletingCol}
        collection={deletingCol}
        onOpenChange={(v) => {
          if (!v) setDeletingCol(null);
        }}
        onSuccessDeleted={() => {
          setSelectedId(null);
        }}
      />

      {/* Lesson Dialogs */}
      {currentCollection && (
        <CreateLessonDialog
          open={createLessonOpen}
          collectionId={currentCollection._id}
          collectionName={currentCollection.name}
          onOpenChange={setCreateLessonOpen}
          defaultOrder={lessons.length + 1}
        />
      )}

      <EditLessonDialog
        open={!!editingLesson}
        lesson={editingLesson}
        onOpenChange={(v) => {
          if (!v) setEditingLesson(null);
        }}
      />

      <DeleteLessonDialog
        open={!!deletingLesson}
        lesson={deletingLesson}
        onOpenChange={(v) => {
          if (!v) setDeletingLesson(null);
        }}
      />

      {/* Lesson Words Dialog */}
      <LessonWordsDialog
        open={!!managingWordsLesson}
        lesson={managingWordsLesson}
        onOpenChange={(v) => {
          if (!v) {
            setManagingWordsLesson(null);
            if (urlLessonId) {
              const currentParams = new URLSearchParams(window.location.search);
              currentParams.delete('lessonId');
              currentParams.delete('newWordAdded');
              const newSearch = currentParams.toString();
              router.replace(
                newSearch
                  ? `/${locale}/vocabulary/collections?${newSearch}`
                  : `/${locale}/vocabulary/collections`
              );
            }
          }
        }}
      />
    </div>
  );
}
