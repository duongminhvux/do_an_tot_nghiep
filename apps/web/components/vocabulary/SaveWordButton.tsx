"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedWordsService } from "@/services/saved-words.service";
import { VocabularyFolder } from "@/types/saved-words";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SaveWordButtonProps {
  /**
   * Word ID to manage save state automatically.
   */
  wordId?: string;

  /**
   * Controlled saved state. If provided, takes precedence over internal state.
   */
  isSaved?: boolean;

  /**
   * Callback fired when clicked. In controlled mode, you should toggle state here.
   */
  onToggle?: () => void;

  /**
   * Visual style variant.
   * - 'pill': Standard bordered button with icon and label (used in SrsRatingBar).
   * - 'icon-only': Square or circular icon button (great for card headers or list rows).
   * - 'ghost': Clean borderless button with icon and optional label.
   */
  variant?: "pill" | "icon-only" | "ghost";

  /**
   * Button size.
   */
  size?: "sm" | "md" | "lg";

  /**
   * Force show/hide text label. Defaults to true for 'pill', false for 'icon-only'.
   */
  showLabel?: boolean;

  /**
   * Optional keyboard shortcut key (e.g. 'S') displayed in tooltip.
   */
  shortcutKey?: string;

  /**
   * Additional custom CSS classes.
   */
  className?: string;

  /**
   * Disabled state.
   */
  disabled?: boolean;
}

export function SaveWordButton({
  wordId,
  isSaved: controlledIsSaved,
  onToggle,
  variant = "pill",
  size = "sm",
  showLabel,
  shortcutKey,
  className = "",
  disabled = false,
}: SaveWordButtonProps) {
  const { t } = useTranslation("vocabulary");
  const queryClient = useQueryClient();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folderError, setFolderError] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const {
    data: foldersRes,
    isLoading: foldersLoading,
    isError: foldersLoadError,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ["vocabulary-folders"],
    queryFn: () => savedWordsService.getFolders(),
    enabled: folderDialogOpen,
  });
  const folders: VocabularyFolder[] = foldersRes?.data ?? [];

  // Autonomous mode: Query saved word IDs list if wordId is provided and controlledIsSaved is undefined
  const isAutonomous = controlledIsSaved === undefined && Boolean(wordId);

  const { data: savedIdsRes } = useQuery({
    queryKey: ["saved-word-ids"],
    queryFn: () => savedWordsService.getSavedIds(),
    enabled: isAutonomous,
    staleTime: 60 * 1000,
  });

  const autonomousIsSaved = Boolean(
    wordId &&
    Array.isArray(savedIdsRes?.data) &&
    savedIdsRes.data.includes(wordId),
  );

  const isSaved =
    controlledIsSaved !== undefined ? controlledIsSaved : autonomousIsSaved;

  const toggleMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId?: string }) =>
      folderId
        ? savedWordsService.save(id, undefined, folderId)
        : savedWordsService.unsave(id),
    onError: () => setFolderError(t("folders.add_error")),
    onSuccess: () => {
      setFolderDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["saved-word-ids"] });
      queryClient.invalidateQueries({ queryKey: ["saved-words"] });
      queryClient.invalidateQueries({ queryKey: ["saved-words-stats"] });
      queryClient.invalidateQueries({ queryKey: ["vocabulary-folders"] });
      onToggle?.();
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (!wordId) {
      onToggle?.();
    } else if (isSaved) {
      toggleMutation.mutate({ id: wordId });
    } else {
      setFolderError("");
      setSelectedFolderId("");
      setNewFolderName("");
      setFolderDialogOpen(true);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder || toggleMutation.isPending) return;
    setCreatingFolder(true);
    try {
      setFolderError("");
      const result = await savedWordsService.createFolder(
        name,
        newFolderDescription.trim() || undefined,
      );
      setNewFolderName("");
      setNewFolderDescription("");
      if (result.data?._id) {
        const folder = result.data;
        queryClient.setQueryData<typeof foldersRes>(
          ["vocabulary-folders"],
          (previous) => ({
            ...result,
            ...previous,
            data: [...(previous?.data ?? []), folder],
          }),
        );
        setSelectedFolderId(folder._id);
      }
      void queryClient.invalidateQueries({ queryKey: ["vocabulary-folders"] });
    } catch {
      setFolderError(t("folders.create_error", "Không thể tạo thư mục"));
    } finally {
      setCreatingFolder(false);
    }
  };

  const keyLabel = t("srs.shortcut_key", "Phím");
  const actionLabel = isSaved ? t("srs.saved", "Đã lưu") : t("srs.save", "Lưu");
  const tooltip = shortcutKey
    ? `${actionLabel} (${keyLabel} ${shortcutKey})`
    : actionLabel;

  const shouldRenderLabel =
    showLabel !== undefined ? showLabel : variant !== "icon-only";

  // Size configurations
  const sizeConfig = {
    sm: {
      pill: "px-3 py-0.5 text-xs gap-1.5",
      icon: "p-1.5",
      iconSize: "w-3.5 h-3.5",
    },
    md: {
      pill: "px-3.5 py-1 text-xs gap-1.5 font-semibold",
      icon: "p-2",
      iconSize: "w-4 h-4",
    },
    lg: {
      pill: "px-4 py-1.5 text-sm gap-2 font-bold",
      icon: "p-2.5",
      iconSize: "w-5 h-5",
    },
  }[size];

  // Variant styles
  let variantStyle = "";
  if (variant === "pill") {
    variantStyle = isSaved
      ? "bg-blue-100 text-blue-700 border-blue-300 font-semibold"
      : "bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border-slate-200 hover:border-blue-200 font-semibold";
  } else if (variant === "icon-only") {
    variantStyle = isSaved
      ? "text-blue-600 hover:text-red-600 hover:bg-red-50"
      : "text-slate-400 hover:text-blue-600 hover:bg-slate-100";
  } else if (variant === "ghost") {
    variantStyle = isSaved
      ? "text-blue-600 hover:bg-blue-50"
      : "text-slate-500 hover:text-blue-600 hover:bg-slate-50";
  }

  const iconColor = isSaved ? "fill-blue-500 text-blue-500" : "text-slate-400";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        data-save-word-id={wordId}
        disabled={disabled || toggleMutation.isPending || creatingFolder}
        onClick={handleClick}
        title={tooltip}
        className={`inline-flex items-center justify-center rounded-lg transition-all cursor-pointer border select-none disabled:opacity-50 disabled:pointer-events-none ${
          variant === "icon-only" ? sizeConfig.icon : sizeConfig.pill
        } ${
          variant === "icon-only" || variant === "ghost"
            ? "border-transparent"
            : ""
        } ${variantStyle} ${className}`}
      >
        <Bookmark
          className={`${sizeConfig.iconSize} transition-colors ${iconColor} ${
            toggleMutation.isPending ? "animate-pulse" : ""
          }`}
        />
        {shouldRenderLabel && <span>{actionLabel}</span>}
      </button>
      {folderDialogOpen &&
        wordId &&
        !isSaved &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={(event) => {
              event.stopPropagation();
              setFolderDialogOpen(false);
            }}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label={t("folders.choose_title")}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") setFolderDialogOpen(false);
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {t("folders.choose_title", "Lưu vào thư mục")}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("folders.choose_hint", "Chọn nơi bạn muốn lưu từ vựng này.")}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setFolderDialogOpen(false)}
                  aria-label={t("folders.close", "Đóng")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 px-6 pt-5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("folders.select_label", "Chọn thư mục")}
                  <Select
                    value={selectedFolderId}
                    onValueChange={(value) => {
                      setSelectedFolderId(value);
                      setFolderError("");
                    }}
                    disabled={
                      foldersLoading ||
                      foldersLoadError ||
                      creatingFolder ||
                      toggleMutation.isPending ||
                      !folders.length
                    }
                  >
                    <SelectTrigger
                      autoFocus
                      aria-label={t("folders.select_label", "Chọn thư mục")}
                      className="mt-2 h-11 w-full rounded-lg border-slate-200 bg-slate-50 text-sm font-medium"
                    >
                      <SelectValue
                        placeholder={t(
                          foldersLoading
                            ? "folders.loading"
                            : folders.length
                              ? "folders.select_placeholder"
                              : "folders.empty",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent
                      className="z-[60]"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {folders.map((folder) => (
                        <SelectItem key={folder._id} value={folder._id}>
                          {folder.name} ({folder.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {foldersLoadError && (
                  <div role="alert" className="text-sm text-red-600">
                    <p>{t("folders.load_error")}</p>
                    <button
                      type="button"
                      onClick={() => void refetchFolders()}
                      className="mt-1 text-blue-600"
                    >
                      {t("folders.retry")}
                    </button>
                  </div>
                )}
                {!foldersLoading && !foldersLoadError && !folders.length && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-700">
                    {t(
                      "folders.quick_create_hint",
                      "Bạn chưa có thư mục. Tạo nhanh bên dưới để lưu từ vựng.",
                    )}
                  </p>
                )}
              </div>
              <div className="mx-6 mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                    {t("folders.quick_create", "Tạo nhanh thư mục")}
                </p>
                <div className="space-y-2.5">
                    <div>
                      <input
                        aria-label={t("folders.new_placeholder")}
                        disabled={creatingFolder || toggleMutation.isPending}
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void handleCreateFolder();
                        }}
                        placeholder={t("folders.new_placeholder", "Tên thư mục mới")}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                        maxLength={80}
                      />
                    </div>
                    <textarea
                      aria-label={t("folders.description_label")}
                      disabled={creatingFolder || toggleMutation.isPending}
                      value={newFolderDescription}
                      onChange={(event) => setNewFolderDescription(event.target.value)}
                      placeholder={t("folders.description_placeholder")}
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                      maxLength={300}
                    />
                    <button
                      type="button"
                    disabled={
                      !newFolderName.trim() ||
                      creatingFolder ||
                      toggleMutation.isPending
                    }
                    onClick={() => void handleCreateFolder()}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {t("folders.create", "Tạo")}
                  </button>
                </div>
                {folderError && (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {folderError}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={
                  !selectedFolderId ||
                  creatingFolder ||
                  toggleMutation.isPending
                }
                onClick={() => {
                  setFolderError("");
                  toggleMutation.mutate({
                    id: wordId,
                    folderId: selectedFolderId,
                  });
                }}
                className="mx-6 mb-6 mt-5 flex h-11 w-[calc(100%-3rem)] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4" />
                {t(
                  toggleMutation.isPending
                    ? "folders.saving"
                    : "folders.save_confirm",
                )}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default SaveWordButton;
