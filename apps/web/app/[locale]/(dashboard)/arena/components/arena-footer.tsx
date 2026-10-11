"use client";

import { ShieldCheck } from "lucide-react";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text">;

export function ArenaFooter({ text }: Props) {
  return (
    <p className="flex items-start justify-center gap-1.5 pb-1 text-center text-[10px] leading-4 text-slate-400">
      <ShieldCheck className="mt-0.5 size-3 shrink-0" />
      {text(
        "Chơi công bằng, học cùng nhau. Mỗi trận đấu là một bước tiến!",
        "Play fair, learn together. Every match is a step forward!",
      )}
    </p>
  );
}
