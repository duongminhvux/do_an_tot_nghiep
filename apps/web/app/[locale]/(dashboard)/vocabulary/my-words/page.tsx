'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Bookmark,
    Search,
    Volume2,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Clock,
    Edit3,
    ChevronLeft,
    ChevronRight,
    Check,
    X,
} from 'lucide-react';
import { savedWordsService } from '@/services/saved-words.service';
import { SavedWordItem, SavedWordWordDetail } from '@/types/saved-words';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

function getLevelBadgeStyle(level?: string) {
    switch (level?.toUpperCase()) {
        case 'A1':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'A2':
            return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'B1':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'B2':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'C1':
            return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'C2':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

function formatSavedDate(dateStr?: string) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return '';
    }
}

function formatIpa(val?: string) {
    if (!val) return '';
    const trimmed = val.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}/`;
}

export default function MyWordsPage() {
    const params = useParams();
    const locale = (params?.locale as string) || 'vi';
    const { t } = useTranslation('vocabulary');
    const queryClient = useQueryClient();

    // State filters & search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLevel, setSelectedLevel] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'savedAt' | 'alpha'>('savedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState<number>(1);
    const pageSize = 18;

    // Audio playing state: stores `${wordId}-${type}` so specific speaker button bounces
    const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);

    // Note editing state
    const [editingNoteWordId, setEditingNoteWordId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState<string>('');

    // 1. Fetch Saved Words
    const {
        data: savedWordsRes,
        isLoading,
    } = useQuery({
        queryKey: [
            'saved-words',
            page,
            pageSize,
            searchTerm,
            selectedLevel,
            sortBy,
            sortOrder,
        ],
        queryFn: () =>
            savedWordsService.getAll({
                page,
                limit: pageSize,
                search: searchTerm.trim() || undefined,
                level: selectedLevel !== 'all' ? selectedLevel : undefined,
                sortBy,
                order: sortOrder,
            }),
    });

    const savedList: SavedWordItem[] = useMemo(() => {
        const raw = (savedWordsRes as any)?.data?.data ?? (savedWordsRes as any)?.data;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(savedWordsRes)) return savedWordsRes;
        return [];
    }, [savedWordsRes]);

    const pagination = (savedWordsRes as any)?.data?.pagination || (savedWordsRes as any)?.pagination || {
        total: 0,
        page: 1,
        limit: pageSize,
        totalPages: 1,
    };

    // Client-side filter for review status
    const filteredList = useMemo(() => {
        if (selectedStatus === 'all') return savedList;
        return savedList.filter((item) => item.reviewStatus === selectedStatus);
    }, [savedList, selectedStatus]);

    // Overall Stats
    const { data: statsRes } = useQuery({
        queryKey: ['saved-words-stats'],
        queryFn: () => savedWordsService.getStats(),
    });

    const totalSavedCount = statsRes?.data?.total ?? pagination.total ?? 0;

    // 2. Mutations
    const toggleSaveMutation = useMutation({
        mutationFn: (wordId: string) => savedWordsService.toggle(wordId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['saved-words'] });
            queryClient.invalidateQueries({ queryKey: ['saved-words-stats'] });
            queryClient.invalidateQueries({ queryKey: ['saved-word-ids'] });
        },
    });

    const updateNoteMutation = useMutation({
        mutationFn: ({ wordId, note }: { wordId: string; note: string }) =>
            savedWordsService.updateNote(wordId, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['saved-words'] });
            setEditingNoteWordId(null);
            setNoteInput('');
        },
    });

    // Audio Playback with US & UK support
    const handlePlayAudio = (word: SavedWordWordDetail, type: 'us' | 'uk' = 'us') => {
        const audioKey = `${word._id}-${type}`;
        setPlayingAudioKey(audioKey);

        const url = type === 'uk'
            ? (word.audio?.uk || word.audio?.us)
            : (word.audio?.us || word.audio?.uk);
        const lang = type === 'uk' ? 'en-GB' : 'en-US';

        const onFinish = () => setPlayingAudioKey(null);

        if (url) {
            const audio = new Audio(url);
            audio.onended = onFinish;
            audio.onerror = () => {
                if ('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance(word.word);
                    u.lang = lang;
                    u.onend = onFinish;
                    window.speechSynthesis.speak(u);
                } else {
                    onFinish();
                }
            };
            audio.play().catch(() => {
                if ('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance(word.word);
                    u.lang = lang;
                    u.onend = onFinish;
                    window.speechSynthesis.speak(u);
                } else {
                    onFinish();
                }
            });
        } else if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(word.word);
            u.lang = lang;
            u.onend = onFinish;
            window.speechSynthesis.speak(u);
        } else {
            onFinish();
        }
    };

    const handleStartEditNote = (item: SavedWordItem) => {
        setEditingNoteWordId(item.word._id);
        setNoteInput(item.note || '');
    };

    const handleSaveNote = (wordId: string) => {
        updateNoteMutation.mutate({ wordId, note: noteInput.trim() });
    };

    return (
        <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            {/* 1. Header Banner */}
            <div className="relative rounded border border-blue-100 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-sky-50 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden">
                <div className="space-y-2 relative z-10 max-w-2xl">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-2">
                        <Link href={`/${locale}/vocabulary`} className="hover:underline">
                            {t('all_words_title', 'Từ vựng')}
                        </Link>
                        <span>/</span>
                        <span className="text-slate-500 font-normal">
                            {t('my_words.breadcrumb', 'Từ vựng của tôi')}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
                            <Bookmark className="w-5 h-5 fill-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                {t('my_words.title', 'Từ vựng của tôi')}
                            </h1>
                        </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                        {t(
                            'my_words.subtitle',
                            'Kho từ vựng cá nhân bạn đã lưu lại để tra cứu nhanh, ghi chú riêng và ôn tập định kỳ theo phương pháp Spaced Repetition.'
                        )}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-blue-800 text-xs font-bold border border-blue-200/60">
                            <Bookmark className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                            <span>
                                {t('my_words.saved_badge', {
                                    count: totalSavedCount,
                                    defaultValue: `${totalSavedCount} từ đã lưu`,
                                })}
                            </span>
                        </div>
                        <Link
                            href={`/${locale}/vocabulary`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
                        >
                            <span>
                                {t('my_words.explore_more', 'Khám phá thêm từ vựng mới')}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* Decorative badge card */}
                <div className="relative z-10 shrink-0 hidden lg:flex flex-col items-center justify-center p-5 rounded bg-white/80 backdrop-blur-xs border border-blue-100 shadow-2xs text-center min-w-[200px]">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {t('my_words.ready_to_review', 'Sẵn sàng ôn tập')}
                    </span>
                    <span className="text-3xl font-black text-blue-600 my-1">
                        {totalSavedCount}
                    </span>
                    <span className="text-xs text-slate-500">
                        {t('my_words.words_in_notebook', 'từ vựng trong sổ tay')}
                    </span>
                </div>
            </div>

            {/* 2. Controls Toolbar: Search, Filters & View Toggle */}
            <div className="rounded border border-slate-200 bg-white p-4 space-y-4 shadow-2xs">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    {/* Search Box */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            placeholder={t(
                                'my_words.search_placeholder',
                                'Tìm theo từ tiếng Anh hoặc nghĩa tiếng Việt...'
                            )}
                            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded border border-slate-200 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setPage(1);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Controls: Level, Sort & View Mode */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Filter by Level */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                {t('my_words.level_label', 'Trình độ:')}
                            </span>
                            <Select
                                value={selectedLevel}
                                onValueChange={(val) => {
                                    setSelectedLevel(val);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="w-auto min-w-[136px] h-8 text-xs font-semibold">
                                    <SelectValue placeholder={t('my_words.all_levels', 'Tất cả trình độ')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        {t('my_words.all_levels', 'Tất cả trình độ')}
                                    </SelectItem>
                                    <SelectItem value="A1">A1</SelectItem>
                                    <SelectItem value="A2">A2</SelectItem>
                                    <SelectItem value="B1">B1</SelectItem>
                                    <SelectItem value="B2">B2</SelectItem>
                                    <SelectItem value="C1">C1</SelectItem>
                                    <SelectItem value="C2">C2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter by Review Status */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                {t('my_words.status_label', 'Trạng thái:')}
                            </span>
                            <Select
                                value={selectedStatus}
                                onValueChange={(val) => setSelectedStatus(val)}
                            >
                                <SelectTrigger className="w-auto min-w-[155px] h-8 text-xs font-semibold">
                                    <SelectValue placeholder={t('my_words.all_statuses', 'Tất cả trạng thái')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        {t('my_words.all_statuses', 'Tất cả trạng thái')}
                                    </SelectItem>
                                    <SelectItem value="MASTERED">
                                        {t('my_words.status_mastered', 'Đã ghi nhớ')}
                                    </SelectItem>
                                    <SelectItem value="LEARNING">
                                        {t('my_words.status_learning', 'Đang học')}
                                    </SelectItem>
                                    <SelectItem value="NOT_STUDIED">
                                        {t('my_words.status_not_studied', 'Chưa học')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sort Options */}
                        <Select
                            value={`${sortBy}-${sortOrder}`}
                            onValueChange={(val) => {
                                if (val === 'savedAt-desc') {
                                    setSortBy('savedAt');
                                    setSortOrder('desc');
                                } else if (val === 'savedAt-asc') {
                                    setSortBy('savedAt');
                                    setSortOrder('asc');
                                } else if (val === 'alpha-asc') {
                                    setSortBy('alpha');
                                    setSortOrder('asc');
                                } else if (val === 'alpha-desc') {
                                    setSortBy('alpha');
                                    setSortOrder('desc');
                                }
                            }}
                        >
                            <SelectTrigger className="w-auto min-w-[135px] h-8 text-xs font-semibold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="savedAt-desc">
                                    {t('my_words.sort_newest', 'Mới lưu nhất')}
                                </SelectItem>
                                <SelectItem value="savedAt-asc">
                                    {t('my_words.sort_oldest', 'Cũ nhất')}
                                </SelectItem>
                                <SelectItem value="alpha-asc">
                                    {t('my_words.sort_alpha_asc', 'Từ A - Z')}
                                </SelectItem>
                                <SelectItem value="alpha-desc">
                                    {t('my_words.sort_alpha_desc', 'Từ Z - A')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 3. Word Cards Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded border border-slate-200 bg-white p-5 space-y-4 animate-pulse"
                        >
                            <div className="flex items-center justify-between">
                                <div className="h-6 w-32 bg-slate-100 rounded" />
                                <div className="h-5 w-12 bg-slate-100 rounded" />
                            </div>
                            <div className="h-4 w-48 bg-slate-100 rounded" />
                            <div className="h-10 w-full bg-slate-50 rounded" />
                            <div className="h-4 w-24 bg-slate-100 rounded" />
                        </div>
                    ))}
                </div>
            ) : filteredList.length === 0 ? (
                /* Empty State */
                <div className="rounded border border-slate-200 bg-white p-12 text-center space-y-4 shadow-2xs">
                    <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                        <Bookmark className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            {searchTerm || selectedLevel !== 'all' || selectedStatus !== 'all'
                                ? t(
                                    'my_words.no_results_title',
                                    'Không tìm thấy từ vựng phù hợp'
                                )
                                : t(
                                    'my_words.empty_title',
                                    'Chưa có từ vựng nào trong danh sách'
                                )}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            {searchTerm || selectedLevel !== 'all' || selectedStatus !== 'all'
                                ? t(
                                    'my_words.no_results_desc',
                                    'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.'
                                )
                                : t(
                                    'my_words.empty_desc',
                                    'Trong khi học các bài học từ vựng hoặc tra từ, nhấn vào biểu tượng Dấu trang để lưu lại các từ bạn muốn xem lại!'
                                )}
                        </p>
                    </div>
                    <div className="pt-2">
                        {searchTerm || selectedLevel !== 'all' || selectedStatus !== 'all' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedLevel('all');
                                    setSelectedStatus('all');
                                }}
                                className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            >
                                {t('my_words.reset_filter', 'Đặt lại bộ lọc')}
                            </button>
                        ) : (
                            <Link
                                href={`/${locale}/vocabulary`}
                                className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xs transition-colors"
                            >
                                <span>
                                    {t('my_words.explore_btn', 'Khám phá kho từ vựng')}
                                </span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        )}
                    </div>
                </div>
            ) : (
                /* Grid Cards Display */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredList.map((item) => {
                        const word = item.word;
                        if (!word) return null;

                        const primaryPart = word.parts?.[0];
                        const partOfSpeech = primaryPart?.partOfSpeech;
                        const firstMeaning = primaryPart?.meanings?.[0];
                        const translations = firstMeaning?.translation || [];
                        const definition = firstMeaning?.definition;
                        const example = firstMeaning?.examples?.[0];
                        const isEditingThisNote = editingNoteWordId === word._id;
                        const ipaUs = word.ipa?.us || word.phonetic;
                        const ipaUk = word.ipa?.uk;

                        return (
                            <div
                                key={item._id}
                                className="group relative rounded border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                            >
                                <div className="space-y-3">
                                    {/* Card Header: Word, Level, Speaker, Bookmark */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                                    {word.word}
                                                </h3>
                                                {word.level && (
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getLevelBadgeStyle(
                                                            word.level
                                                        )}`}
                                                    >
                                                        {word.level}
                                                    </span>
                                                )}
                                                {partOfSpeech && (
                                                    <span className="text-[11px] font-medium text-slate-400 italic">
                                                        ({partOfSpeech})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Phonetics (US & UK) & Audio Buttons */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                {/* US Pronunciation */}
                                                {ipaUs && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePlayAudio(word, 'us')}
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                                                        title={t('listen_us', 'Phát âm US')}
                                                    >
                                                        <Volume2
                                                            className={`w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform ${
                                                                playingAudioKey === `${word._id}-us`
                                                                    ? 'animate-bounce text-blue-700'
                                                                    : ''
                                                            }`}
                                                        />
                                                        <span className="font-mono text-slate-700 text-xs">
                                                            {formatIpa(ipaUs)}
                                                        </span>
                                                        <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
                                                            US
                                                        </span>
                                                    </button>
                                                )}

                                                {/* UK Pronunciation */}
                                                {ipaUk && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePlayAudio(word, 'uk')}
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs text-slate-800 transition-all shadow-2xs group cursor-pointer"
                                                        title={t('listen_uk', 'Phát âm UK')}
                                                    >
                                                        <Volume2
                                                            className={`w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform ${
                                                                playingAudioKey === `${word._id}-uk`
                                                                    ? 'animate-bounce text-indigo-700'
                                                                    : ''
                                                            }`}
                                                        />
                                                        <span className="font-mono text-slate-700 text-xs">
                                                            {formatIpa(ipaUk)}
                                                        </span>
                                                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-1 py-0.2 rounded">
                                                            UK
                                                        </span>
                                                    </button>
                                                )}

                                                {/* Fallback Audio Speaker when neither US nor UK IPA exists */}
                                                {!ipaUs && !ipaUk && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePlayAudio(word, 'us')}
                                                        className="p-1 rounded-full cursor-pointer transition-colors text-slate-400 hover:text-blue-600 hover:bg-slate-50"
                                                        title={t('my_words.listen_pronounce', 'Phát âm')}
                                                    >
                                                        <Volume2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bookmark action & Status */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* Review status badge */}
                                            {item.reviewStatus === 'MASTERED' ? (
                                                <span
                                                    className="p-1 rounded text-emerald-600 bg-emerald-50 border border-emerald-200"
                                                    title={t(
                                                        'my_words.mastered_tooltip',
                                                        'Đã ghi nhớ thành thạo'
                                                    )}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </span>
                                            ) : item.reviewStatus === 'LEARNING' ? (
                                                <span
                                                    className="p-1 rounded text-amber-600 bg-amber-50 border border-amber-200"
                                                    title={t(
                                                        'my_words.learning_tooltip',
                                                        'Đang trong tiến trình học'
                                                    )}
                                                >
                                                    <Clock className="w-3.5 h-3.5" />
                                                </span>
                                            ) : (
                                                <span
                                                    className="p-1 rounded text-slate-400 bg-slate-50 border border-slate-200"
                                                    title={t(
                                                        'my_words.not_studied_tooltip',
                                                        'Chưa học bài này'
                                                    )}
                                                >
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                </span>
                                            )}

                                            {/* Unsave button */}
                                            <button
                                                type="button"
                                                onClick={() => toggleSaveMutation.mutate(word._id)}
                                                className="p-1.5 rounded text-blue-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                title={t('my_words.unsave_tooltip', 'Bỏ lưu từ này')}
                                            >
                                                <Bookmark className="w-4 h-4 fill-blue-600 group-hover:fill-rose-500 group-hover:text-rose-500 transition-colors" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Primary Meaning / Translations */}
                                    <div className="space-y-1">
                                        {translations.length > 0 && (
                                            <p className="text-sm font-semibold text-blue-900 leading-snug">
                                                {translations.join(', ')}
                                            </p>
                                        )}
                                        {definition && (
                                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                                                {definition}
                                            </p>
                                        )}
                                    </div>

                                    {/* Example sentence */}
                                    {example?.en && (
                                        <div className="rounded bg-slate-50/80 p-2.5 text-xs space-y-1 border border-slate-100">
                                            <p className="text-slate-700 font-medium leading-relaxed">
                                                “{example.en}”
                                            </p>
                                            {example.vi && (
                                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                                    {example.vi}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* User Note Section */}
                                    <div className="pt-1">
                                        {isEditingThisNote ? (
                                            <div className="space-y-2 rounded border border-blue-200 bg-blue-50/30 p-2.5">
                                                <textarea
                                                    value={noteInput}
                                                    onChange={(e) => setNoteInput(e.target.value)}
                                                    placeholder={t(
                                                        'my_words.note_placeholder',
                                                        'Viết ghi chú cá nhân cho từ này...'
                                                    )}
                                                    rows={2}
                                                    className="w-full p-2 text-xs rounded border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 resize-none"
                                                />
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingNoteWordId(null)}
                                                        className="px-2.5 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 cursor-pointer"
                                                    >
                                                        {t('my_words.cancel_note', 'Hủy')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveNote(word._id)}
                                                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                        <span>{t('my_words.save_note', 'Lưu')}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : item.note ? (
                                            <div className="flex items-start justify-between gap-2 p-2 rounded bg-amber-50/70 border border-amber-200/60 text-xs">
                                                <div className="space-y-0.5 min-w-0">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                        {t('my_words.user_note_label', 'Ghi chú của bạn:')}
                                                    </span>
                                                    <p className="text-slate-700 text-xs leading-relaxed break-words">
                                                        {item.note}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEditNote(item)}
                                                    className="text-amber-700 hover:text-amber-900 p-1 shrink-0 cursor-pointer"
                                                    title={t('my_words.edit_note', 'Sửa ghi chú')}
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleStartEditNote(item)}
                                                className="text-[11px] font-medium text-slate-400 hover:text-blue-600 inline-flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>{t('my_words.add_note', 'Thêm ghi chú')}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer: Saved Date */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>
                                        {t('my_words.saved_at', {
                                            date: formatSavedDate(item.savedAt),
                                            defaultValue: `Đã lưu ${formatSavedDate(item.savedAt)}`,
                                        })}
                                    </span>
                                    {item.reviewCount > 0 && (
                                        <span className="text-slate-400 font-medium">
                                            {t('my_words.reviewed_count', {
                                                count: item.reviewCount,
                                                defaultValue: `Đã ôn ${item.reviewCount} lần`,
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 4. Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => {
                            setPage((prev) => Math.max(1, prev - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-600 cursor-pointer transition-colors"
                        title={t('my_words.prev_page', 'Trang trước')}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded border border-slate-200 bg-white">
                        {t('my_words.page_info', {
                            current: pagination.page,
                            total: pagination.totalPages,
                            defaultValue: `Trang ${pagination.page} / ${pagination.totalPages}`,
                        })}
                    </span>

                    <button
                        type="button"
                        disabled={page >= pagination.totalPages}
                        onClick={() => {
                            setPage((prev) => Math.min(pagination.totalPages, prev + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-600 cursor-pointer transition-colors"
                        title={t('my_words.next_page', 'Trang sau')}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}