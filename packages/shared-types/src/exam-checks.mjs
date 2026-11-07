import { validateImportDraft } from "./assessment-import.mjs";

/**
 * One TOEIC exam checker shared by: the admin exam "Kiểm tra lỗi" tab, the
 * content-quality scan and publication. Every question issue carries the real
 * question number (`order`), so admins see exactly which question needs what.
 */

/** Official TOEIC Listening & Reading layout (200 questions). */
export const TOEIC_PART_COUNTS = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };

const text = (value) => typeof value === "string" && value.trim().length > 0;
const url = (value) =>
  typeof value === "string" && /^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]+)$/.test(value);
// Relative /media/... URLs are valid in the app; the import rules need http(s).
const canonicalUrl = (value) =>
  value == null ? undefined : value.startsWith("/") ? `https://preview.local${value}` : value;
const list = (value) => (Array.isArray(value) ? value : []);
const id = (value) => (value?.id ?? value?._id) == null ? "" : String(value.id ?? value._id);
const notReady = (meta) => meta?.status && meta.status !== "READY";

/**
 * @param {{ exam?: {type?: string, totalQuestions?: number}, questions: any[], groups: any[] }} input
 * @param {"vi"|"en"} locale
 * @param {{ counts?: boolean }} options counts=false skips exam-size checks (publication).
 */
export function checkExam(input, locale = "vi", options = {}) {
  const en = locale === "en";
  const issues = [];
  const push = (issue) => issues.push({ severity: "error", ...issue });
  const groups = list(input.groups);
  const questions = list(input.questions).filter((q) => q && q.isActive !== false);
  const groupOf = (q) => groups.find((g) => id(g) === String(q.passageGroupId ?? ""));
  const label = (q) => (en ? `Question ${q.order ?? "?"}` : `Câu ${q.order ?? "?"}`);
  const questionIssue = (q, code, vi, english, severity = "error") =>
    push({
      scope: "question",
      code,
      severity,
      part: Number(q.part),
      questionId: id(q),
      order: q.order,
      message: `${label(q)}: ${en ? english : vi}`,
    });

  if (!questions.length)
    push({
      scope: "exam",
      code: "EMPTY",
      message: en ? "The exam has no active questions." : "Đề chưa có câu hỏi đang bật.",
    });

  // 1. Exam size against the declared total and the TOEIC layout.
  if (options.counts !== false && input.exam) {
    const expected = Number(input.exam.totalQuestions);
    if (Number.isInteger(expected) && expected > 0 && questions.length !== expected) {
      const fewer = questions.length < expected;
      push({
        scope: "exam",
        code: fewer ? "EXAM_INCOMPLETE" : "EXAM_OVERFLOW",
        severity: fewer ? "error" : "warning",
        message: fewer
          ? en
            ? `The exam has ${questions.length}/${expected} questions; ${expected - questions.length} missing.`
            : `Đề mới có ${questions.length}/${expected} câu, còn thiếu ${expected - questions.length} câu.`
          : en
            ? `The exam has ${questions.length} questions, more than the declared ${expected}.`
            : `Đề có ${questions.length} câu, nhiều hơn số câu khai báo (${expected}).`,
      });
    }
    if (String(input.exam.type ?? "TOEIC") === "TOEIC" && expected === 200)
      for (const [part, need] of Object.entries(TOEIC_PART_COUNTS)) {
        const have = questions.filter((q) => Number(q.part) === Number(part)).length;
        if (have !== need)
          push({
            scope: "part",
            code: "TOEIC_PART_COUNT",
            part: Number(part),
            have,
            need,
            message: en
              ? `Part ${part} has ${have}/${need} questions (TOEIC layout).`
              : `Part ${part} có ${have}/${need} câu theo chuẩn TOEIC${have < need ? `, thiếu ${need - have} câu` : `, thừa ${have - need} câu`}.`,
          });
      }
  }

  // 2. Structure rules (choices, answer, script, passage links, Part 1 image),
  //    reused from the TOEIC import validator with the real question numbers.
  for (const part of [...new Set(questions.map((q) => Number(q.part)))].sort((a, b) => a - b)) {
    const rows = questions.filter((q) => Number(q.part) === part);
    const linked = new Set(rows.map((q) => String(q.passageGroupId)));
    const draft = {
      groups: groups
        .filter((g) => linked.has(id(g)))
        .map((g) => ({
          ...g,
          title: g.title ?? undefined,
          tempId: id(g),
          passages: list(g.passages).map((p) => ({
            ...p,
            content: p.content ?? undefined,
            type: p.type ?? undefined,
            tempId: id(p),
            audioUrl: canonicalUrl(p.audioUrl),
            imageUrl: canonicalUrl(p.imageUrl),
          })),
        })),
      questions: rows.map((q, index) => ({
        ...q,
        order: Number.isInteger(q.order) && q.order > 0 ? q.order : index + 1,
        isActive: true,
        explanation: q.explanation ?? undefined,
        audioUrl: canonicalUrl(q.audioUrl),
        imageUrl: canonicalUrl(q.imageUrl),
        passageGroupTempId: q.passageGroupId ? String(q.passageGroupId) : undefined,
      })),
    };
    for (const issue of validateImportDraft(draft, part, locale)) {
      if (issue.severity !== "error") continue;
      const q = issue.questionIndex !== undefined ? rows[issue.questionIndex] : undefined;
      if (q) {
        // The import rule for the Part 1 image gets its own code.
        const image = part === 1 && !text(q.imageUrl) && /ảnh|image/i.test(issue.message);
        push({
          scope: "question",
          code: image ? "IMAGE_REQUIRED" : "TOEIC_STRUCTURE",
          part,
          questionId: id(q),
          order: q.order,
          message: issue.message,
        });
      } else
        push({
          scope: issue.groupId ? "group" : "part",
          code: "TOEIC_STRUCTURE",
          part,
          groupId: issue.groupId,
          message: `Part ${part}: ${issue.message}`,
        });
    }
  }

  // 3. Media. Part 1–4 are listening: every question needs audio (its own or
  //    its conversation's). Part 1 additionally needs a photo (checked above).
  const seen = new Map();
  for (const q of [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const part = Number(q.part);
    const group = groupOf(q);
    if (part <= 4) {
      const passageAudio = list(group?.passages).some((p) => url(p.audioUrl));
      if (!url(q.audioUrl) && !passageAudio)
        questionIssue(
          q,
          "AUDIO_REQUIRED",
          part === 1 ? "thiếu audio (Part 1 bắt buộc có cả hình ảnh và audio)." : "thiếu audio cho câu nghe.",
          part === 1 ? "audio is missing (Part 1 needs both a photo and audio)." : "listening audio is missing.",
        );
      if (q.audioUrl && notReady(q.audioMeta))
        questionIssue(q, "AUDIO_STALE", "audio chưa sẵn sàng hoặc đã cũ, cần tạo lại.", "audio is not ready or stale; regenerate it.");
    }
    const key = JSON.stringify([
      part,
      (q.content ?? "").trim().toLowerCase(),
      q.options,
      q.imageUrl ?? "",
      q.passageGroupId ?? "",
    ]);
    const first = seen.get(key);
    if (first)
      questionIssue(
        q,
        "DUPLICATE",
        `trùng nội dung với câu ${first.order ?? "?"}.`,
        `duplicates question ${first.order ?? "?"}.`,
      );
    else seen.set(key, q);
  }
  for (const g of groups) {
    const part = Number(g.part);
    if (!(part <= 4)) continue;
    for (const p of list(g.passages))
      if (p.audioUrl && notReady(p.audioMeta))
        push({
          scope: "group",
          code: "AUDIO_STALE",
          part,
          groupId: id(g),
          passageId: id(p),
          message: en
            ? `Part ${part}: conversation audio is not ready or stale.`
            : `Part ${part}: audio đoạn hội thoại chưa sẵn sàng hoặc đã cũ.`,
        });
  }

  const rank = { exam: 0, part: 1, group: 2, question: 3 };
  return issues.sort(
    (a, b) =>
      rank[a.scope] - rank[b.scope] ||
      (a.part ?? 0) - (b.part ?? 0) ||
      (a.order ?? 0) - (b.order ?? 0),
  );
}
