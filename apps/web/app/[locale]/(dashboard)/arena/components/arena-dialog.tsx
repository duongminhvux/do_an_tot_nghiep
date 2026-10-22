"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArenaController } from "../hooks/use-arena-controller";
import { QuickMatchPanel } from "./quick-match-panel";
import { FriendsPanel } from "./friends-panel";
import { MatchDetailsPanel } from "./match-details-panel";
import { DemoGamePanel } from "./demo-game-panel";

export function ArenaDialog(props: ArenaController) {
  const { panel, setPanel, text, dialogTitle, cancelRankedQueue } = props;
  return (
    <Dialog.Root
      open={panel !== null}
      onOpenChange={(open) => {
        if (!open) {
          if (panel === "rank") {
            cancelRankedQueue();
          }
          setPanel(null);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:w-[calc(100%-2rem)] sm:p-6",
            panel === "rank"
              ? "max-w-2xl bg-gradient-to-b from-blue-50/60 to-white p-0"
              : undefined,
          )}
        >
          <Dialog.Title
            className={
              panel === "rank"
                ? "sr-only"
                : "pr-8 text-lg font-semibold text-slate-900"
            }
          >
            {dialogTitle}
          </Dialog.Title>
          <Dialog.Description
            className={
              panel === "rank"
                ? "sr-only"
                : "mt-1 text-sm leading-5 text-slate-500"
            }
          >
            {text(
              "Trải nghiệm thử với dữ liệu mẫu.",
              "Try it out with sample data.",
            )}
          </Dialog.Description>
          <Dialog.Close
            aria-label={text("Đóng", "Close")}
            className="absolute right-4 top-4 cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </Dialog.Close>

          <QuickMatchPanel {...props} />

          <FriendsPanel {...props} />

          <MatchDetailsPanel {...props} />

          <DemoGamePanel {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
