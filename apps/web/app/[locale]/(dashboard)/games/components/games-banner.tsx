"use client";

import {StudyArtwork} from '@/components/study-artwork';
import { BarChart3, Gamepad2, Star, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, tones } from "@/components/ui/page";
import { cn } from "@/lib/utils";

export function GamesBanner() {
  const { t } = useTranslation("common");
  const benefits = [
    {
      icon: Star,
      title: t("games_page.banner_practice"),
      description: t("games_page.banner_practice_desc"),
      color: tones.pink,
    },
    {
      icon: Trophy,
      title: t("games_page.banner_memory"),
      description: t("games_page.banner_memory_desc"),
      color: tones.amber,
    },
    {
      icon: BarChart3,
      title: t("games_page.banner_progress"),
      description: t("games_page.banner_progress_desc"),
      color: tones.emerald,
    },
  ];

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[75%] md:block"
        aria-hidden="true"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 24%)",
        }}
      >
        <StudyArtwork kind="games" className="h-full w-full object-contain object-right" />
      </div>
      <div className="relative z-10 space-y-5 p-6 md:w-[68%] lg:w-[60%] xl:w-[56%]">
        <PageHeader
          icon={Gamepad2}
          eyebrow="Minigame"
          title={t("games_page.banner_title")}
          description={t("games_page.banner_subtitle")}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2.5 backdrop-blur-sm"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  benefit.color,
                )}
              >
                <benefit.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  {benefit.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
