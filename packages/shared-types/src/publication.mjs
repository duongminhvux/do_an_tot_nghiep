import { checkExam } from "./exam-checks.mjs";
export const PUBLICATION_STATES = ["DRAFT", "IN_REVIEW", "PUBLISHED"];
/** Admin-facing states derived from the stored publication model (no schema change). */
export const VISIBILITY_STATES = ["VISIBLE", "HIDDEN", "INCOMPLETE"];
const hasError = (issues) =>
  Array.isArray(issues) && issues.some((issue) => issue?.severity === "error");
/**
 * VISIBLE    learners can open it (PUBLISHED and, for exams, not switched off).
 * HIDDEN     not visible, and the latest saved content passes validation.
 * INCOMPLETE not visible, and validation reports at least one error (or the
 *            saved content has not been validated since it changed).
 * `issues` is a live validation of the saved content; when omitted the stored
 * validation is used only if it belongs to the current revision.
 */
export function publicationVisibility(item, issues) {
  if (
    item?.publicationStatus === "PUBLISHED" &&
    item.isActive !== false &&
    item.is_active !== false
  )
    return "VISIBLE";
  if (Array.isArray(issues)) return hasError(issues) ? "INCOMPLETE" : "HIDDEN";
  const stored = item?.publicationValidation;
  if (
    stored &&
    Array.isArray(stored.issues) &&
    stored.revision === item.publicationRevision
  )
    return hasError(stored.issues) ? "INCOMPLETE" : "HIDDEN";
  // A published-but-switched-off exam was valid when it was published.
  if (item?.publicationStatus === "PUBLISHED") return "HIDDEN";
  return item?.publicationStatus === "IN_REVIEW" ? "HIDDEN" : "INCOMPLETE";
}
const text = (value) => typeof value === "string" && value.trim().length > 0;
const url = (value) =>
  typeof value === "string" &&
  /^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]+)$/.test(value);
export function validatePublication(kind, data, language = "vi") {
  const en = language === "en",
    issues = [];
  const add = (code, path, vi, english) =>
    issues.push({ code, path, severity: "error", message: en ? english : vi });
  if (kind === "exams") {
    // Per-question rules live in exam-checks.mjs (shared with the admin tab and
    // the quality scan). Exam size is reported there, not used as a publish gate.
    for (const issue of checkExam(
      { questions: data.questions, groups: data.groups },
      language,
      { counts: false },
    ))
      if (issue.severity === "error")
        issues.push({
          code: issue.code,
          path:
            issue.scope === "question"
              ? `questions.${issue.questionId}`
              : issue.scope === "group"
                ? `passages.${issue.passageId ?? issue.groupId}`
                : issue.scope === "part"
                  ? `part.${issue.part}`
                  : "questions",
          severity: "error",
          message: issue.message,
        });
  } else if (kind === "words") {
    // Required fields only. A word does not need to belong to a lesson.
    const missing = [
      !text(data.word) && ["từ", "word"],
      !text(data.slug) && ["slug", "slug"],
      !["A1", "A2", "B1", "B2", "C1", "C2"].includes(data.level) && [
        "trình độ (A1–C2)",
        "level (A1–C2)",
      ],
    ].filter(Boolean);
    if (missing.length)
      add(
        "WORD_FIELDS",
        "word",
        `Thiếu trường bắt buộc: ${missing.map((m) => m[0]).join(", ")}.`,
        `Missing required fields: ${missing.map((m) => m[1]).join(", ")}.`,
      );
    const parts = Array.isArray(data.parts) ? data.parts : [];
    if (
      !parts.length ||
      parts.some(
        (p) =>
          !text(p.partOfSpeech) ||
          !(Array.isArray(p.meanings) ? p.meanings : []).some(
            (m) =>
              text(m.definition) ||
              (Array.isArray(m.translation) ? m.translation : []).some(text),
          ),
      )
    )
      add(
        "MEANING_REQUIRED",
        "parts",
        "Cần từ loại và ít nhất một nghĩa cho mỗi từ loại.",
        "Each part of speech needs at least one meaning.",
      );
  } else if (kind === "lessons") {
    if (!text(data.title) || !text(data.slug) || !data.collectionAvailable)
      add(
        "LESSON_FIELDS",
        "lesson",
        "Thiếu tên, slug hoặc bộ sưu tập đang bật.",
        "A title, slug and active collection are required.",
      );
    if (!data.words?.length)
      add(
        "EMPTY",
        "words",
        "Lesson chưa có từ vựng.",
        "The lesson has no words.",
      );
    const hidden = (data.words ?? []).filter(
      (word) => !word.available || word.publicationStatus !== "PUBLISHED",
    );
    if (hidden.length)
      add(
        "WORD_UNPUBLISHED",
        "words",
        `${hidden.length}/${data.words.length} từ trong lesson đang bị ẩn, bị xóa hoặc chưa xuất bản.`,
        `${hidden.length}/${data.words.length} words in the lesson are hidden, deleted or unpublished.`,
      );
  } else if (kind === "dictation") {
    // Required lesson fields (moved here from the quality scan so that showing a
    // lesson and scanning it apply the same rule).
    const missing = [
      !text(data.title) && ["tiêu đề", "title"],
      !text(data.slug) && ["slug", "slug"],
      !data.topicId && ["chủ đề", "topic"],
      (data.level == null || data.level === "") && ["trình độ", "level"],
    ].filter(Boolean);
    if (missing.length)
      add(
        "DICTATION_FIELDS",
        "lesson",
        `Thiếu trường bắt buộc: ${missing.map((m) => m[0]).join(", ")}.`,
        `Missing required fields: ${missing.map((m) => m[1]).join(", ")}.`,
      );
    if (!["READY", "PUBLISHED"].includes(data.status))
      add(
        "AUDIO_NOT_READY",
        "status",
        "Xử lý audio theo nội dung mới nhất trước khi kiểm duyệt.",
        "Process audio for the latest content before publishing.",
      );
    if (
      !(data.audioSource === "YOUTUBE" ? /^[\w-]{11}$/.test(data.youtubeVideoId ?? "") : url(data.fullAudioUrl)) ||
      !Number.isFinite(data.totalDurationMs) ||
      data.totalDurationMs <= 0
    )
      add(
        "AUDIO_REQUIRED",
        "fullAudioUrl",
        "Thiếu audio hoặc thời lượng hợp lệ.",
        "A valid audio URL and duration are required.",
      );
    const segments = data.segments ?? [];
    if (
      !Number.isInteger(data.sentenceCount) ||
      data.sentenceCount <= 0 ||
      data.sentenceCount !== segments.length
    )
      add(
        "SEGMENT_COUNT",
        "segments",
        "Số câu và số segment không khớp hoặc đang trống.",
        "Sentence and segment counts must match and be nonzero.",
      );
    let previousEnd = 0;
    segments.forEach((s, index) => {
      if (
        !text(s.text) ||
        s.order !== index ||
        !Number.isFinite(s.startMs) ||
        !Number.isFinite(s.endMs) ||
        !Number.isFinite(s.durationMs) ||
        s.startMs < previousEnd ||
        s.endMs <= s.startMs ||
        s.endMs > data.totalDurationMs + 2 ||
        Math.abs(s.endMs - s.startMs - s.durationMs) > 2
      )
        add(
          "SEGMENT_TIMING",
          `segments.${s.id}`,
          "Nội dung, thứ tự hoặc thời gian segment không hợp lệ.",
          "Invalid segment content, order or timing.",
        );
      previousEnd = s.endMs;
      for (const w of s.words ?? [])
        if (
          !text(w.word) ||
          !Number.isFinite(w.startMs) ||
          !Number.isFinite(w.endMs) ||
          w.startMs < 0 ||
          w.endMs < w.startMs ||
          w.endMs > data.totalDurationMs + 2
        )
          add(
            "WORD_TIMING",
            `segments.${s.id}`,
            "Mốc thời gian từ không hợp lệ.",
            "Invalid word timing.",
          );
    });
  } else
    add("KIND", "kind", "Loại nội dung không hợp lệ.", "Invalid content type.");
  return issues;
}
