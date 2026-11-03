"use client";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Flame, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shows the image configured in admin; falls back to a bundled illustration when
 * nothing is configured or the URL fails to load, so the page never shows a broken image.
 */
export function LandingImage({
  src,
  alt,
  fallback,
  className,
  imgClassName,
  eager = false,
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState("");
  const usable = Boolean(src) && failedSrc !== src;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {usable ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

/** Hero fallback: a miniature of the flashcard screen learners actually use. */
export function FlashcardPreview() {
  const { t } = useTranslation("landing");
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 sm:p-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-900/5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {t("preview.label")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            B2
          </span>
        </div>
        <div className="mt-5 text-center">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {t("preview.word")}
          </p>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {t("preview.phonetic")}
          </p>
          <p className="mt-4 text-base font-semibold text-blue-700">
            {t("preview.meaning")}
          </p>
          <p className="mt-2 text-sm italic text-slate-500">
            “{t("preview.example")}”
          </p>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-[11px] font-medium text-slate-500">
            <span>{t("preview.progress")}</span>
            <span>7/10</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100">
            <div className="h-full w-[70%] rounded-full bg-blue-600" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <span className="rounded-lg border border-slate-200 py-2 text-center text-sm font-semibold text-slate-600">
            {t("preview.again")}
          </span>
          <span className="rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white">
            {t("preview.good")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Floating chips that sit around the hero visual on larger screens. */
export function HeroChips() {
  const { t } = useTranslation("landing");
  return (
    <>
      <div className="landing-float absolute -left-4 top-10 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/5 sm:flex lg:-left-10">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <CalendarClock className="size-4" />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {t("preview.chipReview")}
        </span>
      </div>
      <div className="landing-float-delayed absolute -right-3 bottom-10 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/5 sm:flex lg:-right-8">
        <span className="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
          <Flame className="size-4" />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {t("preview.chipStreak")}
        </span>
      </div>
    </>
  );
}

/** Dictation fallback: an audio sentence with the word the learner missed. */
export function DictationPreview() {
  const { t } = useTranslation("landing");
  const bars = [8, 14, 22, 12, 28, 18, 34, 24, 16, 30, 20, 10, 26, 14, 8, 18, 12, 22, 9, 15];
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 sm:p-10">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-violet-900/5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
            <Pause className="size-4" />
          </span>
          <div className="flex h-10 flex-1 items-center gap-[3px]" aria-hidden>
            {bars.map((height, index) => (
              <span
                key={index}
                style={{ height }}
                className={cn(
                  "w-1 flex-1 rounded-full",
                  index < 12 ? "bg-violet-500" : "bg-violet-200",
                )}
              />
            ))}
          </div>
          <Volume2 className="size-4 shrink-0 text-slate-400" />
        </div>
        <p className="rounded-xl bg-slate-50 p-3.5 text-[15px] leading-relaxed text-slate-700">
          {t("dictationPreview.sentence1")}{" "}
          <span className="rounded bg-red-50 px-1 font-semibold text-red-600 line-through decoration-red-300">
            recomend
          </span>{" "}
          <span className="rounded bg-emerald-50 px-1 font-semibold text-emerald-700">
            {t("dictationPreview.missing")}
          </span>{" "}
          {t("dictationPreview.sentence2")}
        </p>
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{t("dictationPreview.speed")}</span>
          <span>3 / 12</span>
        </div>
      </div>
    </div>
  );
}
