"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLeaving?: boolean;
  isRanked?: boolean;
  opponentName?: string;
  locale?: string;
}

export function MatchExitDialog({
  open,
  onOpenChange,
  onConfirm,
  isLeaving = false,
  isRanked = false,
  opponentName,
  locale = "vi",
}: MatchExitDialogProps) {
  const vi = locale === "vi";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm transition-opacity" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[125] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl",
            "animate-in fade-in-0 zoom-in-95 duration-200 outline-none",
          )}
        >
          <div className="flex flex-col items-center text-center">
            {/* Pulsing Warning Badge */}
            <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-8 ring-amber-50">
              <ShieldAlert className="size-8" />
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow">
                !
              </span>
            </div>

            <Dialog.Title className="text-xl font-black text-slate-900">
              {vi ? "Xác nhận rời trận đấu?" : "Forfeit and leave match?"}
            </Dialog.Title>

            <Dialog.Description className="mt-2 text-xs leading-relaxed text-slate-500">
              {opponentName
                ? vi
                  ? `Bạn đang trong trận đấu 1v1 với ${opponentName}.`
                  : `You are currently in a 1v1 match against ${opponentName}.`
                : vi
                  ? "Trận đấu 1vs1 vẫn đang diễn ra kịch tính."
                  : "The 1v1 match is currently active."}
            </Dialog.Description>

            {/* Warning Callout Box */}
            <div className="mt-4 w-full rounded-2xl border border-rose-100 bg-rose-50/80 p-3.5 text-left text-xs leading-5 text-rose-700">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                <div>
                  <p className="font-bold">
                    {vi
                      ? "Bạn sẽ bị xử THUA ngay lập tức!"
                      : "You will immediately LOSE this match!"}
                  </p>
                  <p className="mt-0.5 text-rose-600/90 text-[11px]">
                    {isRanked
                      ? vi
                        ? "Rời trận sẽ bị trừ điểm xếp hạng (Elo) và đối thủ sẽ nhận điểm chiến thắng."
                        : "Leaving will deduct your Elo rank points, and your opponent will be awarded victory."
                      : vi
                        ? "Trận đấu sẽ kết thúc ngay và tính chiến thắng cho đối thủ của bạn."
                        : "The match will end immediately and victory will be awarded to your opponent."}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isLeaving}
                onClick={() => void onConfirm()}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition",
                  "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{vi ? "Đang rời trận..." : "Leaving..."}</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft className="size-4" />
                    <span>{vi ? "Xác nhận thoát" : "Forfeit & Leave"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                autoFocus
                disabled={isLeaving}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition",
                  "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span>{vi ? "Tiếp tục thi đấu" : "Keep Playing"}</span>
              </button>
            </div>
          </div>

          <Dialog.Close
            disabled={isLeaving}
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label={vi ? "Đóng" : "Close"}
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
