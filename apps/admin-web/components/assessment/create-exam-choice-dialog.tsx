"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, FilePenLine, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateExamChoiceDialog({
  open,
  onOpenChange,
  locale,
  groupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  groupId?: string;
}) {
  const router = useRouter();
  const en = locale === "en";
  const choose = (ai: boolean) => {
    onOpenChange(false);
    router.push(
      `/${locale}/assessment/create${ai ? "/ai" : ""}${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ""}`,
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl bg-white p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {en
              ? "How would you like to create your exam?"
              : "Bạn muốn tạo đề thi theo cách nào?"}
          </DialogTitle>
          <DialogDescription>
            {en
              ? "Start with an empty exam or import an existing TOEIC test from PDFs."
              : "Tự soạn đề mới hoặc để AI đọc bộ PDF TOEIC có sẵn."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => choose(false)}
            className="group rounded-xl border border-slate-200 p-5 text-left transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <FilePenLine className="mb-5 size-10 rounded-lg bg-slate-100 p-2 text-slate-600" />
            <h3 className="font-semibold text-slate-900">
              {en ? "Create manually" : "Tạo thủ công"}
            </h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
              {en
                ? "Enter exam details, then add questions, passages and audio yourself."
                : "Nhập thông tin đề, tự thêm câu hỏi, bài đọc và audio theo nhu cầu."}
            </p>
            <span className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
              {en ? "Open exam editor" : "Mở trình soạn đề"}{" "}
              <ArrowRight className="size-4" />
            </span>
          </button>
          <button
            onClick={() => choose(true)}
            className="group rounded-xl border border-blue-200 bg-blue-50/50 p-5 text-left transition hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Sparkles className="mb-5 size-10 rounded-lg bg-blue-600 p-2 text-white" />
            <h3 className="font-semibold text-slate-900">
              {en ? "Import with local AI" : "Tạo bằng AI local"}
            </h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
              {en
                ? "Upload Listening, Reading and their two answer-key PDFs. Review the recognized content before saving."
                : "Tải đề Listening, Reading và hai PDF đáp án. AI nhận diện rồi đưa bạn kiểm tra trước khi lưu."}
            </p>
            <span className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600">
              {en ? "Import TOEIC PDFs and an optional Listening script" : "Nhập PDF TOEIC và script Listening tùy chọn"}{" "}
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
