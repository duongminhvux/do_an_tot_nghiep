"use client";
import { useImageCropper } from '@/components/image-cropper/image-cropper-provider';
import { cropPresetForLanding } from '@/components/image-cropper/image-crop-presets';
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import {
  LANDING_IMAGE_URL_PATTERN,
  type LandingImageKey,
  type LandingPageSettings,
} from "@repo/shared-types/landing-page";
import { siteSettingsService } from "@/services/site-settings.service";
import { uploadService } from "@/services/upload.service";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["admin-landing-page"];
/** Six slots fill a 3 x 2 (or 2 x 3) grid exactly; the hero comes first. */
const SLOTS: { key: LandingImageKey; ratio: string; hero?: boolean }[] = [
  { key: "heroImageUrl", ratio: "4:3", hero: true },
  { key: "vocabularyImageUrl", ratio: "4:3" },
  { key: "toeicImageUrl", ratio: "4:3" },
  { key: "dictationImageUrl", ratio: "4:3" },
  { key: "gamesImageUrl", ratio: "16:10" },
  { key: "arenaImageUrl", ratio: "16:10" },
];

export function LandingPageSettingsPage() {
  const { t } = useTranslation("siteSettings");
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: siteSettingsService.readLanding,
    refetchOnWindowFocus: false,
  });
  return (
    <main className="w-full space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-blue-600 shadow-xs">
          <LayoutTemplate className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("landing.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("landing.subtitle")}</p>
        </div>
      </header>
      {query.isPending ? (
        <div role="status" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("landing.loadError")}</p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 font-medium text-red-700 hover:bg-red-100"
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <LandingForm initial={query.data} />
      )}
    </main>
  );
}

function LandingForm({ initial }: { initial: LandingPageSettings }) {
  const cropImage = useImageCropper();
  const { t } = useTranslation("siteSettings");
  const client = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [uploading, setUploading] = useState<LandingImageKey | null>(null);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const dirtyKeys = (Object.keys(values) as LandingImageKey[]).filter((key) => values[key] !== saved[key]);
  const dirty = dirtyKeys.length > 0;
  const invalid = (Object.keys(values) as LandingImageKey[]).filter(
    (key) => !LANDING_IMAGE_URL_PATTERN.test(values[key]),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (key: LandingImageKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setJustSaved(false);
    setError("");
  };
  const mutation = useMutation({
    mutationFn: () => siteSettingsService.saveLanding(values),
    onSuccess: (value) => {
      setSaved(value);
      setValues(value);
      setJustSaved(true);
      client.setQueryData(QUERY_KEY, value);
    },
    onError: () => setError(t("landing.saveError")),
  });
  const upload = async (key: LandingImageKey, file: File) => {
    if (file.size > 5 * 1024 * 1024 || !file.type.startsWith("image/")) {
      setError(t("uploadError"));
      return;
    }
    setUploading(key);
    setError("");
    try {
      const cropped = await cropImage(file, cropPresetForLanding(key), 5 * 1024 * 1024);
      if (!cropped) return;
      const result = await uploadService.uploadFile(cropped);
      if (result) change(key, result.url);
    } catch {
      setError(t("uploadError"));
    } finally {
      setUploading(null);
    }
  };
  const busy = mutation.isPending || uploading !== null;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !dirty || invalid.length) return;
        mutation.mutate();
      }}
    >
      <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ImageIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">{t("landing.imagesGroup")}</h2>
            <p className="text-xs text-slate-500">{t("landing.imagesGroupHint")}</p>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          {SLOTS.map((slot) => (
            <ImageSlot
              key={slot.key}
              slotKey={slot.key}
              ratio={slot.ratio}
              hero={slot.hero}
              value={values[slot.key]}
              changed={dirtyKeys.includes(slot.key)}
              invalid={invalid.includes(slot.key)}
              uploading={uploading === slot.key}
              disabled={busy}
              onChange={(value) => change(slot.key, value)}
              onUpload={(file) => void upload(slot.key, file)}
            />
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-900/5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm" aria-live="polite">
          {error ? (
            <p role="alert" className="font-medium text-red-600">{error}</p>
          ) : justSaved ? (
            <p className="flex items-center gap-1.5 font-medium text-emerald-700">
              <Check className="size-4" />
              {t("landing.saved")}
            </p>
          ) : dirty ? (
            <p className="font-medium text-amber-700">{t("landing.unsaved")}</p>
          ) : (
            <p className="text-slate-500">{t("landing.noChanges")}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => {
              setValues(saved);
              setError("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-4" />
            {t("landing.discard")}
          </button>
          <button
            type="submit"
            disabled={!dirty || busy || invalid.length > 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t(mutation.isPending ? "landing.saving" : "landing.save")}
          </button>
        </div>
      </div>
    </form>
  );
}

function ImageSlot({
  slotKey,
  ratio,
  hero = false,
  value,
  changed,
  invalid,
  uploading,
  disabled,
  onChange,
  onUpload,
}: {
  slotKey: LandingImageKey;
  ratio: string;
  hero?: boolean;
  value: string;
  changed: boolean;
  invalid: boolean;
  uploading: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  const { t } = useTranslation("siteSettings");
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [failedUrl, setFailedUrl] = useState("");
  const hasImage = Boolean(value);
  const broken = hasImage && failedUrl === value;
  const inputId = `landing-${slotKey}`;
  const pick = () => !disabled && input.current?.click();

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-white p-3.5 transition-colors",
        changed ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
            {t(`landing.${slotKey}`)}
            {hero && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {t("landing.heroBadge")}
              </span>
            )}
          </h3>
          <p className="truncate text-xs text-slate-500" title={t(`landing.${slotKey}Hint`)}>{t(`landing.${slotKey}Hint`)}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium",
            hasImage ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500",
          )}
        >
          {hasImage && <Check className="size-3" aria-hidden />}
          {t(hasImage ? "landing.custom" : "landing.default")}
        </span>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={pick}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !disabled) onUpload(file);
        }}
        aria-label={`${t(hasImage ? "landing.change" : "landing.dropHint")}: ${t(`landing.${slotKey}`)}`}
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
          "aspect-[16/9]",
          dragging
            ? "border-blue-500 bg-blue-50"
            : hasImage
              ? "border-slate-200 bg-slate-50"
              : "border-dashed border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/40",
        )}
      >
        {uploading ? (
          <span className="flex flex-col items-center gap-2 text-xs font-medium text-slate-700">
            <Loader2 className="size-6 animate-spin text-blue-600" />
            {t("uploading")}
          </span>
        ) : hasImage && !broken ? (
          <img src={value} alt="" onError={() => setFailedUrl(value)} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-4 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UploadCloud className="size-5" />
            </span>
            <span className="text-xs font-semibold text-slate-700">{t("landing.dropHint")}</span>
            <span className="text-[11px] text-slate-400">{t("landing.fileHint")}</span>
          </span>
        )}
      </button>
      {broken && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">{t("previewError")}</p>
      )}

      <div className="mt-1.5 flex min-h-8 items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">{t("landing.ratio", { ratio })}</span>
        {hasImage && !uploading && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={pick}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              {t("landing.change")}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              {t("remove")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-600">
          {t("imageUrl")}
        </label>
        <div className="relative flex items-center">
          <Link2 className="pointer-events-none absolute left-3 size-3.5 text-slate-400" />
          <input
            id={inputId}
            value={value}
            disabled={disabled}
            maxLength={2000}
            placeholder={t("landing.urlPlaceholder")}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${inputId}-error` : undefined}
            onChange={(event) => onChange(event.target.value.trim())}
            className={cn(
              "w-full rounded-lg border bg-white py-2 pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50",
              invalid ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100",
            )}
          />
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={t("remove")}
              className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {invalid && (
          <p id={`${inputId}-error`} className="text-xs text-red-600">{t("landing.invalidUrl")}</p>
        )}
      </div>
    </div>
  );
}
