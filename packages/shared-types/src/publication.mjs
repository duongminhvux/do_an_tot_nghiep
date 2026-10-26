import { validateImportDraft } from "./assessment-import.mjs";
export const PUBLICATION_STATES = ["DRAFT", "IN_REVIEW", "PUBLISHED"];
const text = (value) => typeof value === "string" && value.trim().length > 0;
const url = (value) =>
  typeof value === "string" &&
  /^(https?:\/\/[^\s]+|\/(?!\/)[^\s\\]+)$/.test(value);
const canonicalUrl = (value) =>
  value == null
    ? undefined
    : value.startsWith("/")
      ? `https://preview.local${value}`
      : value;
export function validatePublication(kind, data, language = "vi") {
  const en = language === "en",
    issues = [];
  const add = (code, path, vi, english) =>
    issues.push({ code, path, severity: "error", message: en ? english : vi });
  if (kind === "exams") {
    const questions = (data.questions ?? []).filter(
      (q) => q.isActive !== false,
    );
    if (!questions.length)
      add(
        "EMPTY",
        "questions",
        "Đề chưa có câu hỏi đang bật.",
        "The exam has no active questions.",
      );
    const seen = new Set();
    for (const part of new Set(questions.map((q) => q.part))) {
      const rows = questions.filter((q) => q.part === part);
      const ids = new Set(rows.map((q) => String(q.passageGroupId)));
      const groups = (data.groups ?? [])
        .filter((g) => ids.has(String(g.id)))
        .map((g) => ({
          ...g,
          title: g.title ?? undefined,
          tempId: String(g.id),
          passages: (g.passages ?? []).map((p) => ({
            ...p,
            content: p.content ?? undefined,
            type: p.type ?? undefined,
            tempId: String(p.id),
            audioUrl: canonicalUrl(p.audioUrl),
            imageUrl: canonicalUrl(p.imageUrl),
          })),
        }));
      const draft = {
        groups,
        questions: rows.map((q, index) => ({
          ...q,
          order: index + 1,
          isActive: q.isActive !== false,
          explanation: q.explanation ?? undefined,
          audioUrl: canonicalUrl(q.audioUrl),
          imageUrl: canonicalUrl(q.imageUrl),
          passageGroupTempId: q.passageGroupId
            ? String(q.passageGroupId)
            : undefined,
        })),
      };
      for (const issue of validateImportDraft(draft, part, language))
        if (issue.severity === "error")
          issues.push({
            code: "TOEIC_STRUCTURE",
            path:
              issue.questionIndex !== undefined
                ? `questions.${rows[issue.questionIndex]?.id}`
                : `part.${part}`,
            severity: "error",
            message: issue.message,
          });
    }
    for (const q of questions) {
      const group = (data.groups ?? []).find(
        (g) => String(g.id) === String(q.passageGroupId),
      );
      if (
        q.part <= 4 &&
        !url(q.audioUrl) &&
        !(group?.passages ?? []).some((p) => url(p.audioUrl))
      )
        add(
          "AUDIO_REQUIRED",
          `questions.${q.id}`,
          "Thiếu audio bắt buộc cho câu nghe.",
          "Listening questions require audio.",
        );
      if (
        q.part <= 4 &&
        q.audioUrl &&
        q.audioMeta?.status &&
        q.audioMeta.status !== "READY"
      )
        add(
          "AUDIO_STALE",
          `questions.${q.id}`,
          "Audio chưa sẵn sàng hoặc đã cũ.",
          "Audio is not ready or is stale.",
        );
      for (const p of group?.passages ?? [])
        if (
          q.part <= 4 &&
          p.audioUrl &&
          p.audioMeta?.status &&
          p.audioMeta.status !== "READY"
        )
          add(
            "AUDIO_STALE",
            `passages.${p.id}`,
            "Audio đoạn nghe chưa sẵn sàng hoặc đã cũ.",
            "Passage audio is not ready or is stale.",
          );
      const key = JSON.stringify([
        q.part,
        (q.content ?? "").trim().toLowerCase(),
        q.options,
        q.imageUrl ?? "",
        q.passageGroupId ?? "",
      ]);
      if (seen.has(key))
        add(
          "DUPLICATE",
          `questions.${q.id}`,
          "Câu hỏi trùng nội dung trong đề.",
          "Duplicate question content in this exam.",
        );
      seen.add(key);
    }
  } else if (kind === "words") {
    if (
      !text(data.word) ||
      !text(data.slug) ||
      !["A1", "A2", "B1", "B2", "C1", "C2"].includes(data.level)
    )
      add(
        "WORD_FIELDS",
        "word",
        "Thiếu từ, slug hoặc trình độ hợp lệ.",
        "A word, slug and valid level are required.",
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
    if (!data.linkedLessons)
      add(
        "LESSON_REQUIRED",
        "lessons",
        "Từ phải được liên kết với một lesson đang bật.",
        "Link the word to an active lesson.",
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
    for (const word of data.words ?? [])
      if (!word.available || word.publicationStatus !== "PUBLISHED")
        add(
          "WORD_UNPUBLISHED",
          `words.${word.id}`,
          "Có từ bị ẩn, bị xóa hoặc chưa được xuất bản.",
          "A linked word is unavailable or unpublished.",
        );
  } else if (kind === "dictation") {
    if (!["READY", "PUBLISHED"].includes(data.status))
      add(
        "AUDIO_NOT_READY",
        "status",
        "Xử lý audio theo nội dung mới nhất trước khi kiểm duyệt.",
        "Process audio for the latest content before publishing.",
      );
    if (
      !url(data.fullAudioUrl) ||
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
