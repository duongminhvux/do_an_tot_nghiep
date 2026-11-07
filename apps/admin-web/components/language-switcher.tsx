"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ChevronDown, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter, useParams } from "next/navigation";
import { changeLanguage } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const params = useParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-11 min-w-[88px] rounded-xl bg-slate-100 sm:w-40 motion-safe:animate-pulse" />
    );
  }

  const currentLocale =
    (params?.locale as string) || (pathname?.startsWith("/en") ? "en" : "vi");

  const switchLocale = (newLocale: "vi" | "en") => {
    if (newLocale === currentLocale) return;

    changeLanguage(newLocale);
    if (typeof window !== "undefined") {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    }

    const suffix = window.location.search + window.location.hash;
    startTransition(() => {
      if (pathname) {
        const segments = pathname.split("/");
        if (segments[1] === "vi" || segments[1] === "en") {
          segments[1] = newLocale;
          router.push(segments.join("/") + suffix);
        } else {
          router.push(`/${newLocale}${pathname}${suffix}`);
        }
      } else {
        router.push(`/${newLocale}`);
      }
    });
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("language")}: ${currentLocale === "vi" ? "Tiếng Việt" : "English"}`}
          disabled={isPending}
          aria-busy={isPending}
          className="group inline-flex h-11 min-w-[88px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-70 data-[state=open]:border-blue-300 data-[state=open]:bg-blue-50"
        >
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
          ) : (
            <Globe
              aria-hidden="true"
              className="size-4 shrink-0 text-slate-500"
            />
          )}
          <span className="sm:hidden">{currentLocale.toUpperCase()}</span>
          <span className="hidden min-w-20 text-left sm:inline">
            {currentLocale === "vi" ? "Tiếng Việt" : "English"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-52 p-1.5">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={currentLocale}
          onValueChange={(value) => switchLocale(value as "vi" | "en")}
        >
          <DropdownMenuRadioItem
            value="vi"
            className="min-h-11 cursor-pointer gap-3 pr-3 text-sm data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700"
          >
            Tiếng Việt
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="en"
            className="min-h-11 cursor-pointer gap-3 pr-3 text-sm data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700"
          >
            English
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
