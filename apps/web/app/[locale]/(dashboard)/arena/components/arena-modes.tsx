"use client";

import { Plus, Swords, Trophy, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./arena-avatar";
import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text" | "openPanel" | "button">;

export function ArenaModes({ text, openPanel, button }: Props) {
  return (
    <section
      aria-label={text("Chọn chế độ chơi", "Choose a game mode")}
      className="grid min-w-0 gap-3 @min-[560px]/arena:grid-cols-2 @min-[900px]/arena:grid-cols-3 sm:gap-4"
    >
      {[
        {
          key: "rank" as const,
          icon: Swords,
          title: text("Chơi xếp hạng", "Ranked play"),
          description: text(
            "Đấu 1 vs 1 với đối thủ cùng trình độ, tích điểm và leo hạng.",
            "Play 1 vs 1 against a similar-rated opponent and climb the ranks.",
          ),
          action: text("Tìm trận ngay", "Find a match"),
          footer: text("1,234 người đang online", "1,234 players online"),
          style: "from-blue-50 to-[#e9f2ff]",
          color: "text-blue-600",
          iconBg: "bg-blue-100/70",
          buttonStyle:
            "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700",
        },
        {
          key: "friends" as const,
          icon: Users,
          title: text("Đấu với bạn bè", "Play with friends"),
          description: text(
            "Thách đấu bạn bè trong hệ thống qua lời mời.",
            "Send a challenge to a friend and learn together.",
          ),
          action: text("Tìm bạn để thách đấu", "Challenge a friend"),
          footer: text(
            "Chơi cùng bạn bè vui hơn!",
            "Better together with friends!",
          ),
          style: "from-[#fffaf1] to-[#fff8eb]",
          color: "text-amber-500",
          iconBg: "bg-amber-100/70",
          buttonStyle:
            "border border-amber-200/60 bg-white text-blue-600 hover:bg-amber-50",
        },
        {
          key: "room" as const,
          icon: Trophy,
          title: text("Phòng đấu", "Battle room"),
          description: text(
            "Tạo phòng và mời bạn bè tham gia cùng chơi.",
            "Create a room and invite your friends to join.",
          ),
          action: text("Tạo phòng đấu", "Create a room"),
          footer: text("Hỗ trợ 2 - 8 người chơi", "For 2 – 8 players"),
          style: "from-violet-50 to-[#f5f0ff]",
          color: "text-violet-600",
          iconBg: "bg-violet-100/70",
          buttonStyle:
            "border border-violet-200 bg-violet-100/50 text-violet-600 hover:bg-violet-100",
        },
      ].map((mode) => (
        <article
          key={mode.key}
          className={cn(
            "flex min-w-0 flex-col rounded bg-gradient-to-br p-4 @min-[560px]/arena:last:col-span-2 @min-[900px]/arena:p-5 @min-[900px]/arena:last:col-span-1",
            mode.style,
          )}
        >
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                mode.iconBg,
                mode.color,
              )}
            >
              <mode.icon className="size-7" strokeWidth={2.3} />
            </span>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                {mode.title}
                {mode.key === "rank" && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">
                    Online
                  </span>
                )}
              </h2>
              <p className="mt-1.5 min-h-10 text-xs leading-5 text-slate-500">
                {mode.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openPanel(mode.key)}
            className={cn(button, "mt-4 w-full", mode.buttonStyle)}
          >
            {mode.key === "rank" ? (
              <Zap className="size-3.5 fill-current" />
            ) : mode.key === "friends" ? (
              <Plus className="size-4" />
            ) : (
              <Users className="size-4" />
            )}
            {mode.action}
          </button>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex -space-x-2">
              <Avatar
                initials="HM"
                color="blue"
                className="size-5 text-[7px]"
              />
              <Avatar
                initials="PT"
                color="rose"
                className="size-5 text-[7px]"
              />
              <Avatar
                initials="TT"
                color="amber"
                className="size-5 text-[7px]"
              />
            </div>
            <span className="text-[10px] text-slate-500">{mode.footer}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
