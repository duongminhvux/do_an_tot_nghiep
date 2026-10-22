"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Plus,
} from "lucide-react";
import { VocabularyFolders } from "@/components/vocabulary/VocabularyFolders";
import { savedWordsService } from "@/services/saved-words.service";
import { SavedWordItem, SavedWordWordDetail } from "@/types/saved-words";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  surface,
} from "@/components/ui/page";
import { cn } from "@/lib/utils";

function getLevelBadgeTone(
  level?: string,
): "emerald" | "blue" | "violet" | "red" | "amber" | "slate" {
  switch (level?.toUpperCase()) {
    case "A1":
    case "A2":
      return "emerald";
    case "B1":
    case "B2":
      return "blue";
    case "C1":
      return "violet";
    case "C2":
      return "red";
    default:
      return "slate";
  }
}

function formatSavedDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

function formatIpa(val?: string) {
  if (!val) return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}/`;
}

export default function MyWordsPage({
  folderSlug,
}: { folderSlug?: string } = {}) {
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const { t } = useTranslation("vocabulary");
  const queryClient = useQueryClient();

  // State filters & search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderAdding, setFolderAdding] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"savedAt" | "alpha">("savedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 18;

  // Audio playing state: stores `${wordId}-${type}` so specific speaker button bounces
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);

  const {
    data: foldersRes,
    isLoading: foldersLoading,
    isError: foldersError,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ["vocabulary-folders"],
    queryFn: () => savedWordsService.getFolders(),
  });
  const folders = foldersRes?.data ?? [];
  const activeFolder = folders.find((folder) => folder._id === selectedFolder);

  useEffect(() => {
    if (!folderSlug || selectedFolder !== null || folders.length === 0) return;
    const folder = folders.find((item) => item.slug === folderSlug);
    if (folder) setSelectedFolder(folder._id);
  }, [folderSlug, folders, selectedFolder]);

  // Note editing state
  const [editingNoteWordId, setEditingNoteWordId] = useState<string | null>(
    null,
  );
  const [noteInput, setNoteInput] = useState<string>("");

  // 1. Fetch Saved Words
  const {
    data: savedWordsRes,
    isLoading,
    isError: wordsError,
    refetch: refetchWords,
  } = useQuery({
    enabled: selectedFolder !== null,
    queryKey: [
      "saved-words",
      page,
      pageSize,
      searchTerm,
      selectedLevel,
      selectedFolder,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      savedWordsService.getAll({
        page,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        level: selectedLevel !== "all" ? selectedLevel : undefined,
        folderId: selectedFolder ?? undefined,
        sortBy,
        order: sortOrder,
      }),
  });

  const savedList: SavedWordItem[] = useMemo(() => {
    const raw =
      (savedWordsRes as any)?.data?.data ?? (savedWordsRes as any)?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(savedWordsRes)) return savedWordsRes;
    return [];
  }, [savedWordsRes]);

  const pagination = (savedWordsRes as any)?.data?.pagination ||
    (savedWordsRes as any)?.pagination || {
      total: 0,
      page: 1,
      limit: pageSize,
      totalPages: 1,
    };

  // Client-side filter for review status
  const filteredList = useMemo(() => {
    if (selectedStatus === "all") return savedList;
    return savedList.filter((item) => item.reviewStatus === selectedStatus);
  }, [savedList, selectedStatus]);

  // Overall Stats
  const { data: statsRes } = useQuery({
    queryKey: ["saved-words-stats"],
    queryFn: () => savedWordsService.getStats(),
  });

  const totalSavedCount = statsRes?.data?.total ?? pagination.total ?? 0;
  const folderWordCount = activeFolder?.count ?? pagination.total ?? 0;

  // 2. Mutations
  const toggleSaveMutation = useMutation({
    mutationFn: (wordId: string) => savedWordsService.unsave(wordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-words"] });
      queryClient.invalidateQueries({ queryKey: ["saved-words-stats"] });
      queryClient.invalidateQueries({ queryKey: ["saved-word-ids"] });
      queryClient.invalidateQueries({ queryKey: ["vocabulary-folders"] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ wordId, note }: { wordId: string; note: string }) =>
      savedWordsService.updateNote(wordId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-words"] });
      setEditingNoteWordId(null);
      setNoteInput("");
    },
  });

  // Audio Playback with US & UK support
  const handlePlayAudio = (
    word: SavedWordWordDetail,
    type: "us" | "uk" = "us",
  ) => {
    const audioKey = `${word._id}-${type}`;
    setPlayingAudioKey(audioKey);

    const url =
      type === "uk"
        ? word.audio?.uk || word.audio?.us
        : word.audio?.us || word.audio?.uk;
    const lang = type === "uk" ? "en-GB" : "en-US";

    const onFinish = () => setPlayingAudioKey(null);

    if (url) {
      const audio = new Audio(url);
      audio.onended = onFinish;
      audio.onerror = () => {
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(word.word);
          u.lang = lang;
          u.onend = onFinish;
          window.speechSynthesis.speak(u);
        } else {
          onFinish();
        }
      };
      audio.play().catch(() => {
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(word.word);
          u.lang = lang;
          u.onend = onFinish;
          window.speechSynthesis.speak(u);
        } else {
          onFinish();
        }
      });
    } else if ("speechSynthesis" in window) {
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
    setNoteInput(item.note || "");
  };

  const handleSaveNote = (wordId: string) => {
    updateNoteMutation.mutate({ wordId, note: noteInput.trim() });
  };

  return (
    <PageShell>
      {selectedFolder === null ? (
        <PageHeader
          icon={Bookmark}
          title={t("my_words.title")}
          description={t("my_words.subtitle")}
        />
      ) : (
        <PageHeader
          back={{
            href: `/${locale}/vocabulary/my-words`,
            label: t("my_words.title"),
          }}
          eyebrow={t("folders.personal_list")}
          title={activeFolder?.name ?? t("folders.unfiled")}
          description={
            activeFolder?.description || t("folders.detail_description")
          }
          actions={
            <>
              <Badge tone="blue">
                <BookOpen className="h-3.5 w-3.5" />
                {t("folders.word_count", { count: folderWordCount })}
              </Badge>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/${locale}/vocabulary`}>
                  {t("my_words.explore_more")}
                  <ArrowRight />
                </Link>
              </Button>
              {activeFolder && (
                <Button type="button" onClick={() => setFolderAdding(true)}>
                  <Plus />
                  {t("folders.add_words")}
                </Button>
              )}
            </>
          }
        />
      )}
      <VocabularyFolders
        folders={folders}
        loading={foldersLoading}
        error={foldersError}
        retry={() => void refetchFolders()}
        selectedFolder={selectedFolder}
        total={totalSavedCount}
        hideSelectedHeader
        adding={folderAdding}
        onAddingChange={setFolderAdding}
        onSelect={(id) => {
          setSelectedFolder(id);
          setPage(1);
          setSearchTerm("");
          setSelectedLevel("all");
          setSelectedStatus("all");
        }}
      />
      {selectedFolder !== null && (
        <>
          {/* 2. Controls Toolbar: Search, Filters & View Toggle */}
          <div className={cn(surface, "space-y-4 p-5")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <BookOpen className="h-4 w-4 text-blue-600" />
                {t("folders.words_heading")}
              </h2>
              <span className="text-xs text-slate-500">
                {t("folders.word_count", { count: pagination.total })}
              </span>
            </div>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative w-full lg:max-w-md lg:flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t(
                    "my_words.search_placeholder",
                    "Tìm theo từ tiếng Anh hoặc nghĩa tiếng Việt...",
                  )}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Controls: Level, Sort & View Mode */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter by Level */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                    {t("my_words.level_label", "Trình độ:")}
                  </span>
                  <Select
                    value={selectedLevel}
                    onValueChange={(val) => {
                      setSelectedLevel(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 w-auto min-w-[136px] rounded-lg text-xs font-medium">
                      <SelectValue
                        placeholder={t(
                          "my_words.all_levels",
                          "Tất cả trình độ",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("my_words.all_levels", "Tất cả trình độ")}
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
                    {t("my_words.status_label", "Trạng thái:")}
                  </span>
                  <Select
                    value={selectedStatus}
                    onValueChange={(val) => setSelectedStatus(val)}
                  >
                    <SelectTrigger className="h-10 w-auto min-w-[155px] rounded-lg text-xs font-medium">
                      <SelectValue
                        placeholder={t(
                          "my_words.all_statuses",
                          "Tất cả trạng thái",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("my_words.all_statuses", "Tất cả trạng thái")}
                      </SelectItem>
                      <SelectItem value="MASTERED">
                        {t("my_words.status_mastered", "Đã ghi nhớ")}
                      </SelectItem>
                      <SelectItem value="LEARNING">
                        {t("my_words.status_learning", "Đang học")}
                      </SelectItem>
                      <SelectItem value="NOT_STUDIED">
                        {t("my_words.status_not_studied", "Chưa học")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Options */}
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(val) => {
                    if (val === "savedAt-desc") {
                      setSortBy("savedAt");
                      setSortOrder("desc");
                    } else if (val === "savedAt-asc") {
                      setSortBy("savedAt");
                      setSortOrder("asc");
                    } else if (val === "alpha-asc") {
                      setSortBy("alpha");
                      setSortOrder("asc");
                    } else if (val === "alpha-desc") {
                      setSortBy("alpha");
                      setSortOrder("desc");
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-auto min-w-[135px] rounded-lg text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="savedAt-desc">
                      {t("my_words.sort_newest", "Mới lưu nhất")}
                    </SelectItem>
                    <SelectItem value="savedAt-asc">
                      {t("my_words.sort_oldest", "Cũ nhất")}
                    </SelectItem>
                    <SelectItem value="alpha-asc">
                      {t("my_words.sort_alpha_asc", "Từ A - Z")}
                    </SelectItem>
                    <SelectItem value="alpha-desc">
                      {t("my_words.sort_alpha_desc", "Từ Z - A")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 3. Word Cards Content */}
          {wordsError ? (
            <ErrorState
              message={t("folders.load_error")}
              onRetry={() => void refetchWords()}
              retryLabel={t("folders.retry")}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={cn(surface, "space-y-4 p-5")}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon={BookOpen}
              className="min-h-[360px]"
              title={
                searchTerm || selectedLevel !== "all" || selectedStatus !== "all"
                  ? t(
                      "my_words.no_results_title",
                      "Không tìm thấy từ vựng phù hợp",
                    )
                  : t(
                      "folders.empty_folder_title",
                      "Chưa có từ vựng nào trong danh sách",
                    )
              }
              description={
                searchTerm || selectedLevel !== "all" || selectedStatus !== "all"
                  ? t(
                      "my_words.no_results_desc",
                      "Hãy thử điều chỉnh từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.",
                    )
                  : t(
                      "folders.empty_folder_description",
                      "Trong khi học các bài học từ vựng hoặc tra từ, nhấn vào biểu tượng Dấu trang để lưu lại các từ bạn muốn xem lại!",
                    )
              }
              action={
                searchTerm ||
                selectedLevel !== "all" ||
                selectedStatus !== "all" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedLevel("all");
                      setSelectedStatus("all");
                    }}
                  >
                    {t("my_words.reset_filter", "Đặt lại bộ lọc")}
                  </Button>
                ) : activeFolder ? (
                  <Button type="button" onClick={() => setFolderAdding(true)}>
                    <Plus />
                    {t("folders.add_first_word")}
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href={`/${locale}/vocabulary`}>
                      <span>
                        {t("my_words.explore_btn", "Khám phá kho từ vựng")}
                      </span>
                      <ArrowRight />
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            /* Grid Cards Display */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    className={cn(surface, "group relative flex flex-col justify-between space-y-4 p-5 transition-colors hover:border-blue-300")}
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
                              <Badge
                                tone={getLevelBadgeTone(word.level)}
                                className="px-2 text-[11px] font-semibold uppercase"
                              >
                                {word.level}
                              </Badge>
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
                                onClick={() => handlePlayAudio(word, "us")}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all group cursor-pointer"
                                title={t("listen_us", "Phát âm US")}
                              >
                                <Volume2
                                  className={`w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform ${
                                    playingAudioKey === `${word._id}-us`
                                      ? "animate-bounce text-blue-700"
                                      : ""
                                  }`}
                                />
                                <span className="font-mono text-slate-700 text-xs">
                                  {formatIpa(ipaUs)}
                                </span>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded-md">
                                  US
                                </span>
                              </button>
                            )}

                            {/* UK Pronunciation */}
                            {ipaUk && (
                              <button
                                type="button"
                                onClick={() => handlePlayAudio(word, "uk")}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all group cursor-pointer"
                                title={t("listen_uk", "Phát âm UK")}
                              >
                                <Volume2
                                  className={`w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform ${
                                    playingAudioKey === `${word._id}-uk`
                                      ? "animate-bounce text-blue-700"
                                      : ""
                                  }`}
                                />
                                <span className="font-mono text-slate-700 text-xs">
                                  {formatIpa(ipaUk)}
                                </span>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded-md">
                                  UK
                                </span>
                              </button>
                            )}

                            {/* Fallback Audio Speaker when neither US nor UK IPA exists */}
                            {!ipaUs && !ipaUk && (
                              <button
                                type="button"
                                onClick={() => handlePlayAudio(word, "us")}
                                className="p-1 rounded-full cursor-pointer transition-colors text-slate-400 hover:text-blue-600 hover:bg-slate-50"
                                title={t(
                                  "my_words.listen_pronounce",
                                  "Phát âm",
                                )}
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bookmark action & Status */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Review status badge */}
                          {item.reviewStatus === "MASTERED" ? (
                            <span
                              className="rounded-md bg-emerald-50 p-1 text-emerald-600 ring-1 ring-inset ring-emerald-200"
                              title={t(
                                "my_words.mastered_tooltip",
                                "Đã ghi nhớ thành thạo",
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          ) : item.reviewStatus === "LEARNING" ? (
                            <span
                              className="rounded-md bg-amber-50 p-1 text-amber-600 ring-1 ring-inset ring-amber-200"
                              title={t(
                                "my_words.learning_tooltip",
                                "Đang trong tiến trình học",
                              )}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className="rounded-md bg-slate-50 p-1 text-slate-400 ring-1 ring-inset ring-slate-200"
                              title={t(
                                "my_words.not_studied_tooltip",
                                "Chưa học bài này",
                              )}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </span>
                          )}

                          {/* Unsave button */}
                          <button
                            type="button"
                            onClick={() => toggleSaveMutation.mutate(word._id)}
                            className="cursor-pointer rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-red-50 hover:text-red-600"
                            title={t(
                              "my_words.unsave_tooltip",
                              "Bỏ lưu từ này",
                            )}
                          >
                            <Bookmark className="h-4 w-4 fill-blue-600 transition-colors group-hover:fill-red-500 group-hover:text-red-500" />
                          </button>
                        </div>
                      </div>

                      {/* Primary Meaning / Translations */}
                      <div className="space-y-1">
                        {translations.length > 0 && (
                          <p className="text-sm font-semibold leading-snug text-slate-800">
                            {translations.join(", ")}
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
                        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
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
                          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                            <textarea
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              placeholder={t(
                                "my_words.note_placeholder",
                                "Viết ghi chú cá nhân cho từ này...",
                              )}
                              rows={2}
                              className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNoteWordId(null)}
                                className="h-7 px-2.5"
                              >
                                {t("my_words.cancel_note", "Hủy")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveNote(word._id)}
                                className="h-7 px-3"
                              >
                                <Check />
                                <span>{t("my_words.save_note", "Lưu")}</span>
                              </Button>
                            </div>
                          </div>
                        ) : item.note ? (
                          <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                {t(
                                  "my_words.user_note_label",
                                  "Ghi chú của bạn:",
                                )}
                              </span>
                              <p className="text-slate-700 text-xs leading-relaxed break-words">
                                {item.note}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEditNote(item)}
                              className="text-amber-700 hover:text-amber-900 p-1 shrink-0 cursor-pointer"
                              title={t("my_words.edit_note", "Sửa ghi chú")}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditNote(item)}
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>
                              {t("my_words.add_note", "Thêm ghi chú")}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Saved Date */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {t("my_words.saved_at", {
                          date: formatSavedDate(item.savedAt),
                          defaultValue: `Đã lưu ${formatSavedDate(item.savedAt)}`,
                        })}
                      </span>
                      {item.reviewCount > 0 && (
                        <span className="text-slate-400 font-medium">
                          {t("my_words.reviewed_count", {
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
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                title={t("my_words.prev_page", "Trang trước")}
              >
                <ChevronLeft />
              </Button>

              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                {t("my_words.page_info", {
                  current: pagination.page,
                  total: pagination.totalPages,
                  defaultValue: `Trang ${pagination.page} / ${pagination.totalPages}`,
                })}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  setPage((prev) => Math.min(pagination.totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                title={t("my_words.next_page", "Trang sau")}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
