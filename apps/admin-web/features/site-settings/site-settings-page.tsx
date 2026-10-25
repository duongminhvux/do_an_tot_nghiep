"use client";
import { useRef, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Settings,
  Upload,
  UploadCloud,
  Loader2,
  Globe,
  Image as ImageIcon,
  Save,
  Link2,
  X,
  Trash2,
  AppWindow,
} from "lucide-react";
import type { SiteSettings } from "@repo/shared-types/site-settings";
import { siteSettingsService } from "@/services/site-settings.service";
import { uploadService } from "@/services/upload.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const control =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50";
const images = ["logoUrl", "iconUrl", "faviconUrl"] as const;

export function SiteSettingsPage() {
  const { t } = useTranslation("siteSettings");
  const query = useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: siteSettingsService.adminRead,
    refetchOnWindowFocus: false,
  });
  return (
    <main className="w-full space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-blue-600 shadow-xs">
          <Settings className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        </div>
      </header>
      {query.isPending ? (
        <p role="status" className="flex items-center gap-2 text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </p>
      ) : query.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          <p>{t("loadError")}</p>
          <button className={button} onClick={() => void query.refetch()}>
            {t("retry")}
          </button>
        </div>
      ) : (
        <SettingsForm initial={query.data} />
      )}
    </main>
  );
}
function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { t, i18n } = useTranslation("siteSettings");
  const language = (i18n.resolvedLanguage || i18n.language || 'vi').startsWith('en') ? 'en' : 'vi';
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const timezoneQuery = useQuery({
    queryKey: ["site-settings-timezones", language],
    queryFn: () => siteSettingsService.timezones(language),
  });
  const client = useQueryClient();
  const router = useRouter();
  const [settings, setSettings] = useState({ ...initial });
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>(
    {},
  );
  const zones = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\u0111/g, 'd').replaceAll('_', ' ');
    const search = normalize(timezoneSearch.trim());
    return (timezoneQuery.data ?? []).filter((zone) =>
      zone.value === settings.timezone || normalize(`${zone.label} ${zone.value}`).includes(search),
    );
  }, [timezoneQuery.data, timezoneSearch, settings.timezone]);
  const change = (patch: Partial<SiteSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSaved(false);
    setError("");
  };
  const mutation = useMutation({
    mutationFn: () => siteSettingsService.save(settings),
    onSuccess: (value) => {
      setSettings(value);
      setSaved(true);
      setError("");
      client.setQueryData(["site-settings"], value);
      client.setQueryData(["admin-site-settings"], value);
      router.refresh();
    },
    onError: () => setError(t("saveError")),
  });
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (uploading || mutation.isPending) return;
        try {
          new Intl.DateTimeFormat("en", { timeZone: settings.timezone });
        } catch {
          setError(t("invalidTimezone"));
          return;
        }
        mutation.mutate();
      }}
    >
      <fieldset
        disabled={mutation.isPending || uploading !== null}
        className="space-y-6"
      >
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Globe className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">{t("general")}</h2>
              <p className="text-xs text-slate-500">Cấu hình tên hệ thống, mô tả giới thiệu và múi giờ hiển thị</p>
            </div>
          </div>
          <div className="gap-5">
            <label className="block min-w-0 space-y-2 text-sm font-medium text-slate-700">
              <span>{t("siteName")}</span>
              <input
                className={control}
                required
                maxLength={100}
                value={settings.siteName}
                onChange={(event) => change({ siteName: event.target.value })}
              />
            </label>
            <div className="block min-w-0 space-y-2 text-sm font-medium text-slate-700">
              <label htmlFor="site-timezone">{t("timezone")}</label>
              <input
                type="search"
                className={control}
                aria-label={t("timezoneSearch")}
                placeholder={t("timezoneSearch")}
                value={timezoneSearch}
                onChange={(event) => setTimezoneSearch(event.target.value)}
                disabled={!timezoneQuery.data}
              />
              <Select
                value={settings.timezone}
                onValueChange={(timezone) => change({ timezone })}
                disabled={!timezoneQuery.data || timezoneQuery.isPending}
              >
                <SelectTrigger id="site-timezone" aria-label={t("timezone")} className="w-full">
                  <SelectValue placeholder={t("timezoneLoading")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {zones.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timezoneQuery.isPending && <span role="status" className="block text-xs text-slate-500">{t("timezoneLoading")}</span>}
              {timezoneQuery.isError && (
                <span role="alert" className="block text-xs text-red-600">
                  {t("timezoneLoadError")}{' '}
                  <button type="button" className="underline" onClick={() => void timezoneQuery.refetch()}>{t("retry")}</button>
                </span>
              )}
              {timezoneQuery.data && !zones.some((zone) => zone.value !== settings.timezone) && timezoneSearch && (
                <span role="status" className="block text-xs text-slate-500">{t("timezoneNoMatches")}</span>
              )}
              <span className="block text-xs font-normal text-slate-500">
                {t("timezoneHint")}
              </span>
            </div>
            <label className="block min-w-0 space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              <span>{t("siteDescription")}</span>
              <textarea
                className={control}
                rows={3}
                maxLength={300}
                value={settings.siteDescription}
                onChange={(event) =>
                  change({ siteDescription: event.target.value })
                }
              />
              <span className="block text-xs font-normal text-slate-500">
                {t("descriptionHint")}
              </span>
            </label>
          </div>
        </section>
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <ImageIcon className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">{t("branding")}</h2>
              <p className="text-xs text-slate-500">{t("imageHint")}</p>
            </div>
          </div>
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {images.map((key) => (
              <BrandingImageCard
                key={key}
                imageKey={key}
                value={settings[key]}
                isUploading={uploading === key}
                previewError={previewErrors[key] === settings[key]}
                onChange={(url) => change({ [key]: url })}
                onUpload={async (file) => {
                  if (
                    file.size > 5 * 1024 * 1024 ||
                    !(
                      file.type.startsWith("image/") ||
                      /\.(ico|svg|png|jpg|jpeg|webp)$/i.test(file.name)
                    )
                  ) {
                    setError(t("uploadError"));
                    return;
                  }
                  setUploading(key);
                  setError("");
                  setSaved(false);
                  try {
                    const result = await uploadService.uploadFile(file);
                    change({ [key]: result.url });
                    setPreviewErrors((curr) => {
                      const next = { ...curr };
                      delete next[key];
                      return next;
                    });
                  } catch {
                    setError(t("uploadError"));
                  } finally {
                    setUploading(null);
                  }
                }}
                onPreviewError={() =>
                  setPreviewErrors((current) => ({
                    ...current,
                    [key]: settings[key],
                  }))
                }
                t={t}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-blue-700">{t("applyHint")}</p>
            {saved && (
              <p
                role="status"
                className="mt-1 text-sm font-medium text-emerald-700"
              >
                {t("saved")}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            className={
              button + " shrink-0 border-blue-600 bg-blue-600 text-white"
            }
          >
            {mutation.isPending || uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t(
              mutation.isPending ? "saving" : uploading ? "uploading" : "save",
            )}
          </button>
        </section>
      </fieldset>
    </form>
  );
}

function BrandingImageCard({
  imageKey,
  value,
  onChange,
  isUploading,
  onUpload,
  previewError,
  onPreviewError,
  t,
}: {
  imageKey: "logoUrl" | "iconUrl" | "faviconUrl";
  value: string;
  onChange: (url: string) => void;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  previewError: boolean;
  onPreviewError: () => void;
  t: (key: string) => string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const meta = {
    logoUrl: {
      icon: ImageIcon,
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      placeholder: "https://.../logo.png hoặc /images/logo.png",
      recommended: "Khuyên dùng: Ảnh ngang, nền trong suốt PNG/SVG",
    },
    iconUrl: {
      icon: AppWindow,
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      placeholder: "https://.../icon.png hoặc /images/icon.png",
      recommended: "Khuyên dùng: Ảnh vuông 64x64 hoặc 128x128 PNG",
    },
    faviconUrl: {
      icon: Globe,
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      placeholder: "https://.../favicon.ico hoặc /favicon.ico",
      recommended: "Khuyên dùng: Ảnh vuông 32x32 ICO hoặc PNG",
    },
  }[imageKey];

  const Icon = meta.icon;
  const hasImage = Boolean(value);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void onUpload(file);
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs transition-colors hover:border-slate-300">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${meta.iconColor}`}
            >
              <Icon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {t(imageKey)}
              </h3>
              <p className="text-[11px] text-slate-500">{t(`${imageKey}Hint`)}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
              hasImage
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {hasImage ? "✓ Đang sử dụng" : "Mặc định"}
          </span>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,.ico,.svg"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) await onUpload(file);
          }}
        />

        {/* Image Preview & Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!hasImage && !isUploading) fileInputRef.current?.click();
          }}
          className={`relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-200 ${
            isDragging
              ? "border-blue-500 bg-blue-50/60 scale-[0.99]"
              : hasImage
                ? "border-slate-200 bg-slate-50/70"
                : "border-dashed border-slate-300 bg-slate-50/40 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer"
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-slate-700">{t("uploading")}</span>
            </div>
          ) : hasImage ? (
            <div className="relative flex h-full w-full items-center justify-center p-3">
              <img
                src={value}
                alt={t(imageKey)}
                onError={onPreviewError}
                className="max-h-full max-w-full object-contain drop-shadow-xs"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-4 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-2xs">
                <UploadCloud className="size-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                Nhấp để tải ảnh lên hoặc kéo thả
              </p>
              <p className="text-[10px] text-slate-400">
                PNG, JPG, SVG, ICO (tối đa 5 MB)
              </p>
            </div>
          )}
        </div>

        {/* Quick action buttons if image exists */}
        {hasImage && !isUploading && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <Upload className="size-3.5" />
              Đổi ảnh khác
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              {t("remove")}
            </button>
          </div>
        )}

        {previewError && hasImage && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {t("previewError")}
          </p>
        )}

        {/* Direct URL Input */}
        <div className="mt-3.5 space-y-1.5">
          <label
            htmlFor={`input-${imageKey}`}
            className="block text-xs font-semibold text-slate-600"
          >
            {t("imageUrl")} (Link / URL):
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              <Link2 className="size-3.5" />
            </div>
            <input
              id={`input-${imageKey}`}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8.5 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
              maxLength={2000}
              placeholder={meta.placeholder}
              value={value}
              pattern={String.raw`(?:https?://[^\s]+|/(?!/)[^\s\\]*)?`}
              onChange={(event) => onChange(event.target.value.trim())}
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
                title={t("remove")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <span className="block text-[11px] text-slate-400 mt-1">
            {meta.recommended}
          </span>
        </div>
      </div>
    </div>
  );
}
