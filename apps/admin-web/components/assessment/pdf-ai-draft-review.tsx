"use client";
import { useCallback, useEffect, useState } from "react";
import type { ImportDraft } from "@repo/shared-types/assessment-import";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ExamItem } from "@/types";
import type { PdfAiJob } from "@/services/pdf-ai.service";
import { ImportQuestionsWizard } from "./import-questions-wizard";
import { examService } from "@/services/assessment.service";

export function PdfAiDraftReview({
  exam,
  jobId,
  result,
  locale,
  focusQuestion,
  onDraftChange,
  onBusyChange,
}: {
  exam: ExamItem;
  jobId: string;
  result: NonNullable<PdfAiJob["result"]>;
  locale: string;
  focusQuestion?: { order: number; request: number };
  onDraftChange?: (draft: ImportDraft, part: number) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [active, setActive] = useState(result.parts[0]?.part);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const onBusy = useCallback((value: boolean) => { setBusy(value); onBusyChange?.(value); }, [onBusyChange]);
  const en = locale === "en";
  const stored = useQuery({
    queryKey: ["admin-exam-import-status", exam._id, jobId],
    queryFn: () => examService.getSavedImportQuestions(exam._id),
    staleTime: 0,
  });
  const savedState = (p: NonNullable<PdfAiJob['result']>['parts'][number]) => {
    const rows = (stored.data || []).filter(q => q.part === p.part);
    if (!rows.length) return "new";
    const expected = new Set(p.questions.map(q => q.order));
    const complete = rows.length === expected.size && new Set(rows.map(q => q.order)).size === rows.length &&
      rows.every(q => expected.has(q.order) && q.importBatchId === `${jobId}-p${p.part}`);
    return complete ? "saved" : "review";
  };
  useEffect(() => {
    if (!focusQuestion || stored.isPending || stored.isError || busy) return;
    const target = result.parts.find(p => p.questions.some(q => q.order === focusQuestion.order));
    if (!target) return;
    if (saved.includes(target.part) || stored.data?.some(q => q.part === target.part)) {
      router.push(`/${locale}/assessment/${exam._id}?editQuestion=${focusQuestion.order}`);
      return;
    }
    if (active !== target.part) { setActive(target.part); return; }
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-import-part="${target.part}"][data-question-order="${focusQuestion.order}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      (card?.querySelector<HTMLTextAreaElement>("textarea") || card)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusQuestion, stored.isPending, stored.isError, stored.data, busy, active, saved, result, router, locale, exam._id]);
  if (stored.isPending) return <p role="status" className="rounded-lg border p-4 text-sm text-slate-600">{en ? "Checking Parts already saved…" : "Đang kiểm tra các Part đã lưu…"}</p>;
  if (stored.isError) return <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    <p>{en ? "Cannot check the saved exam. Retry before importing." : "Chưa kiểm tra được dữ liệu đã lưu. Hãy thử lại trước khi import để tránh trùng câu hỏi."}</p>
    <button type="button" onClick={() => void stored.refetch()} className="underline">{en ? "Retry" : "Kiểm tra lại"}</button>
  </div>;
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        {en
          ? "The exam is a draft. Review and save each Part; incomplete questions cannot be saved."
          : "Đề đang ở trạng thái nháp. Kiểm tra và lưu từng Part; câu hỏi còn thiếu dữ liệu sẽ được đánh dấu và chặn lưu."}
      </div>
      <p className="text-sm text-slate-600">
        {en ? "Parts 6–7 use original PDF images for shared reading passages. Individual questions and answer choices remain editable text."
          : "Part 6–7 dùng ảnh gốc PDF cho bài đọc/email phía trên. Từng câu hỏi bên dưới và các lựa chọn đáp án là chữ, có thể chỉnh sửa."}
      </p>
      <div className="flex flex-wrap gap-2">
        {result.parts.map((p) => (
          <button
            key={p.part}
            disabled={busy}
            aria-pressed={p.part === active}
            onClick={() => setActive(p.part)}
            className={`rounded-lg border px-4 py-2 text-sm disabled:opacity-50 ${p.part === active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white"}`}
          >
            Part {p.part} · {p.questions.length}
            {saved.includes(p.part) || savedState(p) === "saved" ? " ✓" : ""}
          </button>
        ))}
      </div>
      {result.parts.map((p) => (
        <div key={p.part} hidden={p.part !== active}>
          {!saved.includes(p.part) && savedState(p) !== "new" ? <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            <h3 className="font-semibold">{savedState(p) === "saved" ? (en ? `Part ${p.part} is already saved` : `Part ${p.part} đã được lưu`) : (en ? `Part ${p.part} already contains questions` : `Part ${p.part} đã có câu hỏi trong đề`)}</h3>
            <p>{savedState(p) === "saved" ? (en ? "This Part was imported earlier. Edit the saved exam to make changes; importing again would duplicate or overwrite questions." : "Part này đã được import trước đó. Bạn không cần lưu lại. Muốn chỉnh sửa nội dung hoặc hình ảnh, hãy mở đề đã lưu; bản phân tích AI không tự ghi đè dữ liệu trong đề.") : (en ? "The existing questions differ from this import or the Part is incomplete. Open the saved exam to review them before continuing." : "Dữ liệu đã lưu chưa khớp với bản import này hoặc Part chưa được lưu đủ. Hãy mở đề để kiểm tra trước khi tiếp tục.")}</p>
            <button type="button" onClick={() => router.push(`/${locale}/assessment/${exam._id}`)} className="rounded border border-blue-300 bg-white px-4 py-2 font-medium">{en ? "Open saved exam" : "Mở đề đã lưu để chỉnh sửa"}</button>
          </div> :
          <ImportQuestionsWizard
            exam={exam}
            locale={locale}
            initialPart={p.part}
            initialDraft={p}
            initialBatchId={`${jobId}-p${p.part}`}
            preserveSourceOrder
            onImportConflict={() => void stored.refetch()}
            onBusyChange={onBusy}
            onDraftChange={onDraftChange}
            onImported={() =>
              setSaved((prev) =>
                prev.includes(p.part) ? prev : [...prev, p.part],
              )
            }
            onSuccess={() => router.push(`/${locale}/assessment/${exam._id}`)}
          />
          }
        </div>
      ))}
    </section>
  );
}
