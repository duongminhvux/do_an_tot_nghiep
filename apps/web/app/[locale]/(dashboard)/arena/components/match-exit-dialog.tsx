"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
            "rounded-2xl border border-slate-200 bg-white p-6 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 duration-200 outline-none",
          )}
        >
          <div className="flex flex-col items-center text-center">
            {/* Pulsing Warning Badge */}
            <div className="relative mb-4 flex size-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldAlert className="size-7" />
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white">
                !
              </span>
            </div>

            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {vi ? "Xác nhận rời trận đấu?" : "Forfeit and leave match?"}
            </Dialog.Title>

            <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {opponentName
                ? vi
                  ? `Bạn đang trong trận đấu 1v1 với ${opponentName}.`
                  : `You are currently in a 1v1 match against ${opponentName}.`
                : vi
                  ? "Trận đấu 1vs1 vẫn đang diễn ra kịch tính."
                  : "The 1v1 match is currently active."}
            </Dialog.Description>

            {/* Warning Callout Box */}
            <div className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 p-3.5 text-left text-sm leading-5 text-red-700">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <div>
                  <p className="font-semibold">
                    {vi
                      ? "Bạn sẽ bị xử THUA ngay lập tức!"
                      : "You will immediately LOSE this match!"}
                  </p>
                  <p className="mt-0.5 text-xs text-red-600">
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
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLeaving}
                onClick={() => void onConfirm()}
                className="flex-1 border-red-200 px-4 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
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
              </Button>

              <Button
                type="button"
                size="lg"
                autoFocus
                disabled={isLeaving}
                onClick={() => onOpenChange(false)}
                className="flex-1 px-4"
              >
                <span>{vi ? "Tiếp tục thi đấu" : "Keep Playing"}</span>
              </Button>
            </div>
          </div>

          <Dialog.Close
            disabled={isLeaving}
            className="absolute right-4 top-4 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={vi ? "Đóng" : "Close"}
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
