"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Music,
  CheckCircle2,
  AlertCircle,
  VolumeX,
  Volume2,
  Upload,
  Link2,
  X,
  Loader2,
  Trash2,
} from "lucide-react";
import { uploadService } from "@/services/upload.service";
import type { GameAudioSettings } from "@/services/games.service";

const audioConfigs = [
  {
    key: "backgroundMusicUrl",
    icon: Music,
    iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
    titleKey: "backgroundMusicUrl",
    placeholder: "https://example.com/audio/bgm.mp3 hoặc /audio/bgm.mp3",
    descriptionVi: "Nhạc nền phát lặp lại trong suốt ván đấu",
  },
  {
    key: "correctSoundUrl",
    icon: CheckCircle2,
    iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
    titleKey: "correctSoundUrl",
    placeholder: "https://example.com/audio/correct.mp3",
    descriptionVi: "Phát khi gõ đúng từ hoặc bắn trúng mục tiêu",
  },
  {
    key: "wrongSoundUrl",
    icon: AlertCircle,
    iconColor: "text-amber-600 bg-amber-50 border-amber-200",
    titleKey: "wrongSoundUrl",
    placeholder: "https://example.com/audio/wrong.mp3",
    descriptionVi: "Phát khi gõ sai hoặc thao tác nhầm",
  },
  {
    key: "loseSoundUrl",
    icon: VolumeX,
    iconColor: "text-rose-600 bg-rose-50 border-rose-200",
    titleKey: "loseSoundUrl",
    placeholder: "https://example.com/audio/gameover.mp3",
    descriptionVi: "Phát khi hết mạng, hết giờ hoặc thua cuộc",
  },
] as const;

export function GameAudioFields({
  settings,
  onChange,
  onBusyChange,
  title,
  hint,
}: {
  title?: string;
  hint?: string;
  settings: GameAudioSettings;
  onChange: (settings: GameAudioSettings) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation("games");
  const isVi = i18n.language?.startsWith("vi") ?? true;
  const [error, setError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileUpload = async (
    key: (typeof audioConfigs)[number]["key"],
    file?: File,
  ) => {
    if (!file) return;
    if (
      file.size > 50 * 1024 * 1024 ||
      !(
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|aac|m4a|webm|flac)$/i.test(file.name)
      )
    ) {
      setError(t("audioUploadError"));
      return;
    }

    setUploadingKey(key);
    onBusyChange(true);
    setError("");
    try {
      const uploaded = await uploadService.uploadFile(file);
      onChange({ [key]: uploaded.url });
      setPreviewError(null);
    } catch {
      setError(t("audioUploadError"));
    } finally {
      setUploadingKey(null);
      onBusyChange(false);
    }
  };

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
      aria-label={title ?? t("audioTitle")}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 shadow-xs">
            <Volume2 className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              {title ?? t("audioTitle")}
            </h3>
            <p className="text-xs text-slate-500">{hint ?? t("audioHint")}</p>
          </div>
        </div>

        {/* Master Audio Toggle */}
        <label className="flex items-center gap-3 self-start sm:self-center rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 cursor-pointer transition-colors hover:bg-slate-100/70">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={settings.audioEnabled !== false}
            onChange={(event) =>
              onChange({ audioEnabled: event.target.checked })
            }
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700">
              {t("audioEnabled")}
            </span>
            <span className="text-[11px] text-slate-500">
              {settings.audioEnabled !== false
                ? (isVi ? "Đang bật âm thanh" : "Audio active")
                : (isVi ? "Đang tắt âm thanh" : "Audio muted")}
            </span>
          </div>
        </label>
      </div>

      {/* Grid of Audio Cards: 2 columns on tablet and desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {audioConfigs.map(
          ({
            key,
            icon: Icon,
            iconColor,
            titleKey,
            placeholder,
            descriptionVi,
          }) => {
            const hasAudio = Boolean(settings[key]);
            const isUploading = uploadingKey === key;

            return (
              <div
                key={key}
                className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
                  hasAudio
                    ? "border-slate-200/90 bg-white shadow-xs"
                    : "border-slate-200/60 bg-slate-50/50"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${iconColor}`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">
                          {t(titleKey)}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {isVi ? descriptionVi : t(titleKey + "Hint", "")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                        hasAudio
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {hasAudio
                        ? isVi
                          ? "✓ Đã có âm thanh"
                          : "Configured"
                        : isVi
                          ? "Chưa thiết lập"
                          : "Not set"}
                    </span>
                  </div>

                  {/* URL Input */}
                  <div className="space-y-1.5 mb-3">
                    <label
                      htmlFor={`audio-input-${key}`}
                      className="block text-xs font-semibold text-slate-600"
                    >
                      {isVi ? "Đường dẫn liên kết (Link / URL):" : "Audio URL:"}
                    </label>
                    <div className="relative flex items-center">
                      <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
                        <Link2 className="size-3.5" />
                      </div>
                      <input
                        id={`audio-input-${key}`}
                        type="text"
                        maxLength={2000}
                        placeholder={placeholder}
                        value={settings[key] ?? ""}
                        pattern={String.raw`(?:https?://[^\s]+|/(?!/)[^\s\\]*)?`}
                        onChange={(event) => {
                          setPreviewError(null);
                          onChange({ [key]: event.target.value.trim() });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8.5 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                      />
                      {settings[key] && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewError(null);
                            onChange({ [key]: "" });
                          }}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
                          title={t("audioRemove")}
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="mb-3">
                    <input
                      type="file"
                      ref={(el) => {
                        fileInputRefs.current[key] = el;
                      }}
                      accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.webm,.flac"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        await handleFileUpload(key, file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[key]?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 py-2 px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin text-blue-600" />
                          <span>
                            {isVi ? "Đang tải tệp lên..." : "Uploading..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5 text-slate-500" />
                          <span>
                            {isVi
                              ? "Tải tệp âm thanh từ máy (MP3, WAV, OGG...)"
                              : t("audioUpload")}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Audio Player and preview */}
                {hasAudio && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                        <Volume2 className="size-3 text-slate-500" />
                        {isVi ? "Nghe thử âm thanh:" : "Preview audio:"}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 cursor-pointer transition-colors"
                        onClick={() => {
                          setPreviewError(null);
                          onChange({ [key]: "" });
                        }}
                      >
                        <Trash2 className="size-3" />
                        {t("audioRemove")}
                      </button>
                    </div>
                    <audio
                      key={settings[key]}
                      controls
                      preload="none"
                      src={settings[key]}
                      aria-label={t(titleKey)}
                      className="h-8 w-full rounded focus:outline-none"
                      onError={() => setPreviewError(key)}
                    />
                    {previewError === key && (
                      <p
                        role="alert"
                        className="mt-1.5 text-[11px] text-red-600 font-medium"
                      >
                        {t("audioPreviewError")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}
