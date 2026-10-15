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
            "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded border border-slate-200 p-4 shadow-2xl sm:w-[calc(100%-2rem)] sm:p-6",
            panel === "rank"
              ? "max-w-2xl rounded   bg-[radial-gradient(ellipse_at_center,#edf5ff_0%,#f8fbff_65%,#fff_100%)] p-0"
              : "bg-white",
          )}
        >
          <Dialog.Title
            className={
              panel === "rank"
                ? "sr-only"
                : "pr-8 text-lg font-bold text-slate-900"
            }
          >
            {dialogTitle}
          </Dialog.Title>
          <Dialog.Description
            className={
              panel === "rank"
                ? "sr-only"
                : "mt-1 text-xs leading-5 text-slate-500"
            }
          >
            {text(
              "Trải nghiệm thử với dữ liệu mẫu.",
              "Try it out with sample data.",
            )}
          </Dialog.Description>
          <Dialog.Close
            aria-label={text("Đóng", "Close")}
            className="absolute right-4 top-4 cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100"
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
