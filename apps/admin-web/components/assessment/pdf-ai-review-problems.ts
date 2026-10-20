import { validateImportDraft, type ImportDraft } from "@repo/shared-types/assessment-import";
import type { PdfAiJob } from "@/services/pdf-ai.service";

export function getMissingScriptQuestions(result: NonNullable<PdfAiJob["result"]>) {
  if (!result.listeningScript) return [];
  if (result.listeningScript.missingQuestions) return result.listeningScript.missingQuestions;
  const recognized = new Set(result.parts.filter(p => p.part <= 4).flatMap(p => p.questions.filter(q => q.scriptPages?.length).map(q => q.order)));
  if (recognized.size === result.listeningScript.questions) return Array.from({ length: 100 }, (_, i) => i + 1).filter(n => !recognized.has(n));
  // Legacy jobs without question source metadata still retain the parser warning.
  return [...new Set(result.warnings.flatMap(w => w.match(/^Script chưa đọc đủ câu ([\d, ]+)/)?.[1]?.split(',').map(Number) || []))].sort((a,b) => a-b);
}

export function getPdfAiReviewProblems(
  result: NonNullable<PdfAiJob["result"]>,
  drafts: Record<number, ImportDraft> = {},
  locale = "vi",
) {
  const en = locale === "en";
  const problems = new Map<number, { order: number; part: number; messages: string[]; error: boolean }>();
  const scriptMissing = new Set(getMissingScriptQuestions(result));
  const conflicts = new Set(result.sections?.flatMap(s => s.conflicts || []) || []);
  for (const part of result.parts) {
    const draft = drafts[part.part] || part;
    const add = (index: number, message: string, error: boolean) => {
      const order = draft.questions[index]?.order;
      if (!order) return;
      const entry = problems.get(order) || { order, part: part.part, messages: [], error: false };
      if (!entry.messages.includes(message)) entry.messages.push(message);
      entry.error ||= error;
      problems.set(order, entry);
    };
    draft.questions.forEach((q, index) => {
      if (scriptMissing.has(q.order!)) add(index, en ? "Not recognized in the script PDF; review or fill in the question script." : "Chưa nhận diện trong PDF script; kiểm tra hoặc bổ sung script câu này.", !q.content.trim());
      if (conflicts.has(q.order!)) add(index, en ? "OCR found conflicting content; compare with the source PDF." : "OCR nhận diện nội dung khác nhau; cần đối chiếu PDF nguồn.", false);
    });
    for (const issue of validateImportDraft(draft, part.part, locale).filter(i => i.severity === "error")) {
      if (issue.questionIndex !== undefined) add(issue.questionIndex, issue.message, true);
    }
  }
  return [...problems.values()].sort((a, b) => a.order - b.order);
}

export function getPdfAiGroupProblems(
  result: NonNullable<PdfAiJob["result"]>, drafts: Record<number, ImportDraft> = {}, locale = "vi",
) {
  return result.parts.flatMap(part => {
    const draft = drafts[part.part] || part;
    const grouped = new Map<string, { part: number; groupId: string; orders: number[]; messages: string[] }>();
    for (const issue of validateImportDraft(draft, part.part, locale)) {
      if (issue.severity !== "error" || issue.questionIndex !== undefined || (!issue.groupId && !issue.passageId)) continue;
      const group = draft.groups.find(g => g.id === issue.groupId || g.passages.some(p => p.id === issue.passageId));
      if (!group) continue;
      const entry = grouped.get(group.id) || { part: part.part, groupId: group.id,
        orders: draft.questions.filter(q => q.passageGroupTempId === group.id || group.passages.some(p => p.id === q.passageTempId)).map(q => q.order!).filter(Boolean), messages: [] };
      if (!entry.messages.includes(issue.message)) entry.messages.push(issue.message);
      grouped.set(group.id, entry);
    }
    return [...grouped.values()];
  });
}
