"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter, useParams } from "next/navigation";
import { changeLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Locale = "vi" | "en";
const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: "vi", label: "Tiếng Việt", short: "VI" },
  { value: "en", label: "English", short: "EN" },
];

/**
 * Header language menu. Deliberately non-modal (no scroll lock), so opening it
 * never removes the page scrollbar and shifts the layout.
 */
export default function LanguageSwitcher() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!mounted) {
    return (
      <div className="h-10 w-[76px] shrink-0 rounded-xl bg-slate-100 motion-safe:animate-pulse sm:w-[132px]" />
    );
  }

  const currentLocale: Locale =
    (params?.locale as Locale) || (pathname?.startsWith("/en") ? "en" : "vi");
  const current = LOCALES.find((item) => item.value === currentLocale) ?? LOCALES[0]!;

  const focusItem = (index: number) => {
    const items = list.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!items?.length) return;
    items[(index + items.length) % items.length]?.focus();
  };

  const switchLocale = (newLocale: Locale) => {
    setOpen(false);
    trigger.current?.focus();
    if (newLocale === currentLocale) return;
    changeLanguage(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    const suffix = window.location.search + window.location.hash;
    startTransition(() => {
      const segments = (pathname || "/").split("/");
      if (segments[1] === "vi" || segments[1] === "en") {
        segments[1] = newLocale;
        router.push(segments.join("/") + suffix);
      } else {
        router.push(`/${newLocale}${pathname || ""}${suffix}`);
      }
    });
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("language")}: ${current.label}`}
        aria-busy={isPending}
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() =>
              focusItem(
                event.key === "ArrowUp"
                  ? LOCALES.length - 1
                  : LOCALES.findIndex((item) => item.value === currentLocale),
              ),
            );
          }
        }}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white pl-2.5 pr-2 text-[13px] font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-70 sm:h-11 sm:gap-2 sm:pl-3",
          open && "border-blue-200 bg-blue-50/60 text-blue-700",
        )}
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
        ) : (
          <Globe aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
        )}
        <span className="sm:hidden">{current.short}</span>
        <span className="hidden w-[68px] truncate text-left sm:inline">{current.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={t("language")}
          onKeyDown={(event) => {
            const items = Array.from(
              list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
            );
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "ArrowDown") focusItem(index + 1);
            else if (event.key === "ArrowUp") focusItem(index - 1);
            else if (event.key === "Home") focusItem(0);
            else if (event.key === "End") focusItem(items.length - 1);
            else if (event.key === "Tab") setOpen(false);
            else return;
            if (event.key !== "Tab") event.preventDefault();
          }}
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t("language")}
          </p>
          {LOCALES.map((item) => {
            const active = item.value === currentLocale;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={item.value}
                onClick={() => switchLocale(item.value)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100",
                  active ? "font-semibold text-blue-700" : "font-medium text-slate-700",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {item.short}
                </span>
                <span className="flex-1">{item.label}</span>
                {active && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
