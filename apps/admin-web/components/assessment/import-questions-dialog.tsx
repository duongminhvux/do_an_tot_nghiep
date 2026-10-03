"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import type { ExamItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportQuestionsWizard } from "./import-questions-wizard";

export type { ExamPartConfig } from "./import-parts-config";

export function ImportQuestionsDialog({
  open,
  onOpenChange,
  exam,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamItem;
  onSuccess?: () => void;
}) {
  const params = useParams();
  const locale = String(params.locale || "vi");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex h-[96dvh] w-[calc(100vw-1rem)] max-w-none flex-col overflow-y-auto rounded bg-slate-50 p-3 sm:p-4 sm:rounded"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {locale === "en" ? "Import questions" : "Import câu hỏi"}
          </DialogTitle>
          <DialogDescription>{exam.name}</DialogDescription>
        </DialogHeader>
        {open && (
          <ImportQuestionsWizard
            exam={exam}
            locale={locale}
            onBusyChange={setBusy}
            onSuccess={() => {
              onSuccess?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
