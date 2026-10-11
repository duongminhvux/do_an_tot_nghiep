"use client";

import { ShieldCheck } from "lucide-react";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<ArenaController, "text">;

export function ArenaFooter({ text }: Props) {
  return (
    <p className="flex items-center justify-center gap-1.5 pb-1 text-[10px] text-slate-400">
      <ShieldCheck className="size-3" />
      {text(
        "Chơi công bằng, học cùng nhau. Mỗi trận đấu là một bước tiến!",
        "Play fair, learn together. Every match is a step forward!",
      )}
    </p>
  );
}
