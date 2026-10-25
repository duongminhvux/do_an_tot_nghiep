"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Folder,
  Plus,
  Bookmark,
  X,
  Edit3,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { savedWordsService } from "@/services/saved-words.service";
import { VocabularyFolder } from "@/types/saved-words";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, surface, tones } from "@/components/ui/page";
import { cn } from "@/lib/utils";

export function VocabularyFolders({
  folders,
  loading,
  error,
  retry,
  selectedFolder,
  onSelect,
  total,
  hideSelectedHeader = false,
  adding: controlledAdding,
  onAddingChange,
}: {
  folders: VocabularyFolder[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  selectedFolder: string | null;
  onSelect: (id: string | null) => void;
  total: number;
  hideSelectedHeader?: boolean;
  adding?: boolean;
  onAddingChange?: (adding: boolean) => void;
}) {
  const { t } = useTranslation("vocabulary");
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const client = useQueryClient();
  const nameInputId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingFolder, setEditingFolder] = useState<VocabularyFolder | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [internalAdding, setInternalAdding] = useState(false);
  const adding = controlledAdding ?? internalAdding;
  const setAdding = (value: boolean) => {
    if (onAddingChange) onAddingChange(value);
    else setInternalAdding(value);
  };
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const refresh = () => {
    for (const key of [
      "vocabulary-folders",
      "saved-words",
      "saved-words-stats",
      "saved-word-ids",
      "folder-word-search",
    ]) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  };
  const create = useMutation({
    mutationFn: () =>
      savedWordsService.createFolder(
        name.trim(),
        description.trim() || undefined,
      ),
    onSuccess: () => {
      setCreateOpen(false);
      setName("");
      setDescription("");
      refresh();
    },
  });
  const add = useMutation({
    mutationFn: (wordId: string) =>
      savedWordsService.save(wordId, undefined, selectedFolder!),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: () =>
      savedWordsService.updateFolder(
        editingFolder!._id,
        editName.trim(),
        editDescription.trim() || undefined,
      ),
    onSuccess: () => {
      setEditingFolder(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (folderId: string) => savedWordsService.deleteFolder(folderId),
    onSuccess: () => {
      if (selectedFolder && selectedFolder !== "unfiled") onSelect(null);
      refresh();
    },
  });
  const results = useQuery({
    queryKey: ["folder-word-search", selectedFolder, debouncedSearch],
    queryFn: () =>
      savedWordsService.searchWords(selectedFolder!, debouncedSearch),
    enabled:
      adding &&
      Boolean(selectedFolder && selectedFolder !== "unfiled") &&
      debouncedSearch.length > 0,
  });
  const folder = folders.find((item) => item._id === selectedFolder);
  const buttonClass = buttonVariants({ size: "sm" });
  return (
    <section
      className={
        selectedFolder === null
          ? "space-y-5"
          : hideSelectedHeader
            ? "space-y-4"
            : cn(surface, "space-y-4 p-5")
      }
    >
      {selectedFolder === null ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones.blue)}>
                <Bookmark className="h-4 w-4" />
              </span>
              <p>{t("folders.library_hint")}</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                create.reset();
                setCreateOpen(true);
              }}
              className="shrink-0"
            >
              <Plus />
              {t("folders.create_list")}
            </Button>
          </div>
          <Dialog.Root
            open={createOpen}
            onOpenChange={(open) => {
              if (!create.isPending) setCreateOpen(open);
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-slate-900">
                    {t("folders.create_list")}
                  </Dialog.Title>
                  <Dialog.Close
                    disabled={create.isPending}
                    aria-label={t("folders.close")}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="mb-5 text-sm leading-relaxed text-slate-500">
                  {t("folders.create_description")}
                </Dialog.Description>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (name.trim() && !create.isPending) create.mutate();
                  }}
                >
                  <label
                    htmlFor={nameInputId}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    {t("folders.list_name")}
                  </label>
                  <input
                    id={nameInputId}
                    placeholder={t("folders.new_placeholder")}
                    maxLength={80}
                    value={name}
                    disabled={create.isPending}
                    onChange={(event) => {
                      setName(event.target.value);
                      create.reset();
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <label
                    htmlFor={`${nameInputId}-description`}
                    className="mb-2 mt-4 block text-sm font-medium text-slate-700"
                  >
                    {t("folders.description_label")}
                  </label>
                  <textarea
                    id={`${nameInputId}-description`}
                    placeholder={t("folders.description_placeholder")}
                    maxLength={300}
                    value={description}
                    disabled={create.isPending}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      create.reset();
                    }}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  {create.isError && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                      {t("folders.create_error")}
                    </p>
                  )}
                  <div className="mt-6 flex justify-end gap-3">
                    <Dialog.Close
                      type="button"
                      disabled={create.isPending}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t("folders.cancel")}
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={!name.trim() || create.isPending}
                      className={buttonClass}
                    >
                      <Plus className="h-4 w-4" />
                      {t(
                        create.isPending
                          ? "folders.creating"
                          : "folders.create_list",
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>{" "}
          {loading ? (
            <LoadingState label={t("folders.loading")} className={cn(surface, "min-h-80")} />
          ) : error ? (
            <ErrorState
              message={t("folders.load_error")}
              onRetry={retry}
              retryLabel={t("folders.retry")}
            />
          ) : folders.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("folders.empty_list_title")}
              description={t("folders.empty_list_description")}
              className="min-h-[360px]"
              action={
                <div className="flex flex-col items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      create.reset();
                      setCreateOpen(true);
                    }}
                  >
                    <Plus />
                    {t("folders.create_list")}
                  </Button>
                  {total > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => onSelect("unfiled")}
                    >
                      {t("folders.view_unfiled", { count: total })}
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ...folders,
                ...(total > folders.reduce((sum, item) => sum + item.count, 0)
                  ? [
                      {
                        _id: "unfiled",
                        name: t("folders.unfiled"),
                        count:
                          total -
                          folders.reduce((sum, item) => sum + item.count, 0),
                      },
                    ]
                  : []),
              ].map((item) => (
                <div
                  key={item._id}
                  className={cn(surface, "group relative flex items-center gap-4 p-5 text-left transition-colors hover:border-blue-300")}
                >
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones.blue)}>
                    <Folder className="h-5 w-5" />
                  </span>
                  <Link
                    href={
                      item._id === "unfiled"
                        ? `/${locale}/vocabulary/my-words?folder=unfiled`
                        : `/${locale}/vocabulary/my-words/${(item as VocabularyFolder).slug}`
                    }
                    className="flex min-w-0 flex-1 items-center gap-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item._id);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {item.name}
                      </h3>
                      {"description" in item && item.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-sm text-slate-500">
                        {t("folders.word_count", { count: item.count })}
                        {"createdAt" in item && item.createdAt && (
                          <span className="ml-2 text-xs text-slate-400">
                            · {new Date(item.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}
                          </span>
                        )}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                  </Link>
                  {item._id !== "unfiled" && (
                    <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        aria-label={t("folders.edit")}
                        onClick={() => {
                          setEditingFolder(item as VocabularyFolder);
                          setEditName(item.name);
                          setEditDescription(
                            (item as VocabularyFolder).description || "",
                          );
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={t("folders.delete")}
                        onClick={() => {
                          if (window.confirm(t("folders.delete_confirm"))) {
                            remove.mutate(item._id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {!hideSelectedHeader && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  aria-label={t("folders.back")}
                  onClick={() => {
                    onSelect(null);
                    setAdding(false);
                    setSearch("");
                    add.reset();
                  }}
                  className="rounded-lg p-2 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Folder className="h-6 w-6 text-blue-500" />
                <h2 className="text-lg font-bold">
                  {folder?.name ?? t("folders.unfiled")}
                </h2>
              </div>
              {folder && (
                <button
                  className={buttonClass}
                  onClick={() => {
                    setAdding(!adding);
                    add.reset();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t(adding ? "folders.close" : "folders.add_words")}
                </button>
              )}
            </div>
          )}
          {folder && (
            <Dialog.Root
              open={adding}
              onOpenChange={(open) => {
                if (add.isPending) return;
                setAdding(open);
                if (!open) {
                  setSearch("");
                  setDebouncedSearch("");
                  add.reset();
                }
              }}
            >
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      <Plus className="h-5 w-5 text-blue-600" />
                      {t("folders.add_words")}
                    </Dialog.Title>
                    <Dialog.Close
                      disabled={add.isPending}
                      aria-label={t("folders.close")}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </Dialog.Close>
                  </div>
                  <p className="mb-2 truncate text-sm font-medium text-blue-600">
                    {folder.name}
                  </p>
                  <Dialog.Description className="mb-5 text-sm leading-6 text-slate-500">
                    {t("folders.add_hint")}
                  </Dialog.Description>
                  <div className="min-h-0 space-y-4 overflow-y-auto">
                    <input
                      autoFocus
                      aria-label={t("folders.search_words")}
                      placeholder={t("folders.search_words")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    {add.isError && (
                      <p role="alert" className="text-sm text-red-600">
                        {t("folders.add_error")}
                      </p>
                    )}
                    {debouncedSearch &&
                      (results.isFetching ? (
                        <p>{t("folders.loading")}</p>
                      ) : results.isError ? (
                        <p role="alert">{t("folders.load_error")}</p>
                      ) : (
                        <div className="max-h-80 space-y-2 overflow-y-auto">
                          {results.data?.data?.length === 0 && (
                            <p className="text-sm text-slate-500">
                              {t("folders.no_results")}
                            </p>
                          )}
                          {results.data?.data?.map((word) => (
                            <div
                              key={word._id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                            >
                              <div>
                                <p className="font-semibold">{word.word}</p>
                                <p className="text-sm text-slate-500">
                                  {word.parts
                                    ?.flatMap((part) =>
                                      part.meanings.flatMap(
                                        (meaning) => meaning.translation,
                                      ),
                                    )
                                    .join("; ")}
                                </p>
                              </div>
                              <button
                                disabled={add.isPending || word.inFolder}
                                onClick={() => add.mutate(word._id)}
                                className={buttonClass}
                              >
                                {t(
                                  word.inFolder
                                    ? "folders.added"
                                    : word.saved
                                      ? "folders.move_here"
                                      : "folders.add",
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                  <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                    <Dialog.Close
                      disabled={add.isPending}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      {t("folders.close")}
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </>
      )}
      <Dialog.Root
        open={Boolean(editingFolder)}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setEditingFolder(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {t("folders.edit")}
            </Dialog.Title>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (editName.trim()) update.mutate();
              }}
            >
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                maxLength={80}
                placeholder={t("folders.new_placeholder")}
              />
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                rows={3}
                maxLength={300}
                placeholder={t("folders.description_placeholder")}
              />
              <div className="flex justify-end gap-3">
                <Dialog.Close className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("folders.cancel")}
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={!editName.trim() || update.isPending}
                  className={buttonClass}
                >
                  {t("folders.save_changes")}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
