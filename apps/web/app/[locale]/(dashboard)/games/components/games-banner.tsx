"use client";

import Image from "next/image";
import { BarChart3, Gamepad2, Star, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

export function GamesBanner() {
  const { t } = useTranslation("common");
  const benefits = [
    {
      icon: Star,
      title: t("games_page.banner_practice"),
      description: t("games_page.banner_practice_desc"),
      color: "bg-pink-100 text-pink-500",
    },
    {
      icon: Trophy,
      title: t("games_page.banner_memory"),
      description: t("games_page.banner_memory_desc"),
      color: "bg-amber-100 text-amber-600",
    },
    {
      icon: BarChart3,
      title: t("games_page.banner_progress"),
      description: t("games_page.banner_progress_desc"),
      color: "bg-emerald-100 text-emerald-600",
    },
  ];

  return (
    <header className="relative isolate overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-[#f0f7ff] via-[#edf5ff] to-[#e1ecff] text-slate-900">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[75%] md:block"
        aria-hidden="true"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 24%)",
        }}
      >
        <Image
          src="/images/games/vocabulary-banner-light.webp"
          alt=""
          fill
          priority
          sizes="75vw"
          className="object-contain object-right"
        />
      </div>
      <div
        className="pointer-events-none absolute -bottom-24 -left-12 size-64 rounded-full bg-blue-200/30 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative z-10 p-5 sm:p-6 md:w-[68%] lg:w-[60%] xl:w-[56%]">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 sm:text-xs">
          <Gamepad2 className="size-4 text-indigo-600" />
          MINIGAME
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("games_page.banner_title")}
        </h1>
        <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm">
          {t("games_page.banner_subtitle")}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-white/80 bg-white/70 px-2.5 py-2 backdrop-blur-sm"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-md ${benefit.color}`}
              >
                <benefit.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold leading-4 text-slate-800">
                  {benefit.title}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
