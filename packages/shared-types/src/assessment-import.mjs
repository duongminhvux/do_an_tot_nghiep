const keys = ["A", "B", "C", "D"];
const passageTypes = [
  "TEXT",
  "EMAIL",
  "ADVERTISEMENT",
  "ARTICLE",
  "NOTICE",
  "CHAT",
];
const questionPattern =
  /^(?:(?:(?:câu|cau|question|q)\s*)?(\d+)[.):/\-]\s*|\[(?:QUESTION|CÂU|CAU)(?:\s+(\d+))?\]\s*)(.*)$/i;
const groupPattern =
  /^(?:\[(?:BÀI TẬP|BAI TAP|EXERCISE|GROUP|NHÓM|PASSAGE GROUP)(?:\s+\d+)?\]|(?:Bài tập|Bai tap|Exercise|Group|Nhóm|Cụm bài đọc)(?:\s+\d+)?\s*:)[\s:\-]*(.*)$/i;
const passagePattern =
  /^(?:\[(PASSAGE|TEXT|EMAIL|ADVERTISEMENT|ARTICLE|NOTICE|CHAT)(?:\s+\d+)?\]|(passage|đoạn văn|doan van|đoạn hội thoại|bài đọc|bài nghe|bài nói|email|thư|quảng cáo|thông báo|bài báo|chat)(?:\s+\d+)?\s*:)[\s:\-]*(.*)$/i;

function detectType(tag) {
  const value = tag.toUpperCase();
  if (/EMAIL|THƯ/.test(value)) return "EMAIL";
  if (/ADVERTISEMENT|QUẢNG CÁO/.test(value)) return "ADVERTISEMENT";
  if (/ARTICLE|BÀI BÁO/.test(value)) return "ARTICLE";
  if (/NOTICE|THÔNG BÁO/.test(value)) return "NOTICE";
  if (/CHAT|HỘI THOẠI/.test(value)) return "CHAT";
  return "TEXT";
}

// One parser for pasted text, uploaded files and direct API imports.
export function parseImportText(text, part = 1, section) {
  const groups = [],
    passages = [],
    questions = [],
    warnings = [];
  let group,
    passage,
    question,
    state = "",
    lastNumber = 0;
  const lines = String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n");
  const finishQuestion = () => {
    if (question) questions.push(question);
    question = undefined;
    state = "";
  };
  const startGroup = (title = "") => {
    const id = `group-${groups.length + 1}`;
    group = {
      id,
      tempId: id,
      title,
      order: groups.length + 1,
      passages: [],
      hasCustomTitle: Boolean(title),
    };
    groups.push(group);
    passage = undefined;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.startsWith("#")) continue;
    if (!line) {
      if (state === "passage" && passage?.content) passage.content += "\n";
      continue;
    }
    const groupMatch = line.match(groupPattern);
    if (groupMatch || /^[-=~*]{3,}$/.test(line)) {
      finishQuestion();
      // Decorative dividers do not create empty exercises.
      if (groupMatch) startGroup(groupMatch[1]);
      else {
        group = undefined;
        passage = undefined;
      }
      continue;
    }
    const passageMatch = line.match(passagePattern);
    if (passageMatch) {
      finishQuestion();
      if (!group || questions.some((q) => q.passageGroupTempId === group.id))
        startGroup();
      const id = `passage-${passages.length + 1}`;
      passage = {
        id,
        tempId: id,
        groupTempId: group.id,
        type: detectType(passageMatch[1] || passageMatch[2]),
        title: passageMatch[3] || "",
        content: "",
        order: group.passages.length + 1,
      };
      group.passages.push(passage);
      passages.push(passage);
      state = "passage";
      continue;
    }
    const match = line.match(questionPattern);
    if (match) {
      finishQuestion();
      lastNumber = Number(match[1] || match[2]) || lastNumber + 1;
      question = {
        order: lastNumber,
        sourceLine: index + 1,
        content: match[3].trim(),
        options: [],
        correctAnswer: "",
        explanation: "",
        ...(passage
          ? { passageGroupTempId: group.id, passageTempId: passage.id }
          : {}),
      };
      state = "question";
      continue;
    }
    if (state === "passage" && passage) {
      const field = line.match(
        /^(Content|Nội dung|Noi dung|Transcript|Lời thoại|Audio|Âm thanh|Am thanh|Image|Ảnh|Hình ảnh|Title|Tiêu đề|Tieu de|Type|Loại)\s*:\s*(.*)$/i,
      );
      if (field) {
        const name = field[1].toLowerCase(),
          value = field[2];
        if (/^(audio|âm thanh|am thanh)$/.test(name)) passage.audioUrl = value;
        else if (/^(image|ảnh|hình ảnh)$/.test(name)) passage.imageUrl = value;
        else if (/^(title|tiêu đề|tieu de)$/.test(name)) passage.title = value;
        else if (/^(type|loại)$/.test(name)) passage.type = detectType(value);
        else passage.content += (passage.content ? "\n" : "") + value;
      } else passage.content += (passage.content ? "\n" : "") + line;
      continue;
    }
    if (!question) {
      warnings.push({
        severity: "warning",
        line: index + 1,
        message: `Dòng ${index + 1} chưa được nhận diện: ${line.slice(0, 80)}`,
      });
      continue;
    }
    const option = line.match(/^(?:([A-Z])[.):]|\(([A-Z])\))\s*(.*)$/i);
    if (option) {
      question.options.push({
        key: (option[1] || option[2]).toUpperCase(),
        text: option[3],
      });
      state = "option";
      continue;
    }
    const answer = line.match(
      /^(?:Answer|Đáp án|Dap an|Key|\[ANSWER\])\s*[:\-]\s*(.*)$/i,
    );
    if (answer) {
      question.correctAnswer = answer[1]
        .replace(/^\(([A-D])\)$/i, "$1")
        .trim()
        .toUpperCase();
      state = "answer";
      continue;
    }
    const explanation = line.match(
      /^(?:Explanation|Giải thích|Giai thich|Lời giải|\[EXPLANATION\])\s*:\s*(.*)$/i,
    );
    if (explanation) {
      question.explanation = explanation[1];
      state = "explanation";
      continue;
    }
    const media = line.match(
      /^(Image|Ảnh|Hình ảnh|Audio|Âm thanh|Am thanh)\s*:\s*(.*)$/i,
    );
    if (media) {
      question[
        /^(image|ảnh|hình ảnh)$/i.test(media[1]) ? "imageUrl" : "audioUrl"
      ] = media[2];
      continue;
    }
    if (state === "explanation") question.explanation += "\n" + line;
    else if (state === "option") question.options.at(-1).text += "\n" + line;
    else if (state === "question") question.content += "\n" + line;
    else
      warnings.push({
        severity: "warning",
        line: index + 1,
        message: `Dòng ${index + 1} chưa được nhận diện: ${line.slice(0, 80)}`,
      });
  }
  finishQuestion();
  const suffix =
    part === 7
      ? "Reading Passage"
      : part === 6
        ? "Text Completion"
        : part === 4
          ? "Short Talk"
          : "Conversation";
  for (const g of groups) {
    const numbers = questions
      .filter((q) => q.passageGroupTempId === g.id)
      .map((q) => q.order);
    if (!g.title)
      g.title = numbers.length
        ? `Questions ${Math.min(...numbers)}-${Math.max(...numbers)} (Part ${part} ${suffix})`
        : `Bài tập ${g.order}`;
    for (const p of g.passages) {
      p.content = p.content.trim();
      p.inputMode = p.imageUrl ? "IMAGE" : "TEXT";
    }
  }
  return {
    groups: groups.filter((g) => g.passages.length),
    passages,
    passage: passages[0] || null,
    questions,
    warnings,
  };
}

const hasText = (value) => typeof value === "string" && Boolean(value.trim());
const validUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function serializeImportDraft(draft) {
  const questionLines = (q) => [
    `${q.order || 1}. ${q.content || ""}`,
    ...(q.imageUrl ? [`Image: ${q.imageUrl}`] : []),
    ...(q.audioUrl ? [`Audio: ${q.audioUrl}`] : []),
    ...(q.options || []).map((o) => `${o.key}. ${o.text}`),
    `Answer: ${q.correctAnswer || ""}`,
    ...(q.explanation ? [`Explanation: ${q.explanation}`] : []),
    "",
  ];
  const lines = [],
    visited = new Set();
  for (const [i, g] of draft.groups.entries()) {
    lines.push(`[EXERCISE ${i + 1}] - ${g.title || ""}`);
    for (const p of g.passages) {
      lines.push(`[${p.type || "PASSAGE"}]`);
      if (p.audioUrl) lines.push(`Audio: ${p.audioUrl}`);
      if (p.imageUrl) lines.push(`Image: ${p.imageUrl}`);
      if (p.content) lines.push(`Content: ${p.content}`);
      lines.push("");
    }
    draft.questions.forEach((q, qi) => {
      if (
        q.passageGroupTempId === g.id ||
        g.passages.some((p) => p.id === q.passageTempId)
      ) {
        lines.push(...questionLines(q));
        visited.add(qi);
      }
    });
    lines.push("---", "");
  }
  draft.questions.forEach((q, qi) => {
    if (!visited.has(qi)) lines.push(...questionLines(q));
  });
  return lines.join("\n").trim();
}

export function validateImportDraft(
  draft,
  part,
  locale = "vi",
  optionsCount = part === 2 ? 3 : 4,
) {
  const issues = [];
  const en = locale === "en";
  const issue = (vi, english, target = {}, severity = "error") =>
    issues.push({ severity, message: en ? english : vi, ...target });
  const expected = keys.slice(0, optionsCount);
  const groups = Array.isArray(draft.groups) ? draft.groups : [];
  const questions = Array.isArray(draft.questions) ? draft.questions : [];
  const grouped = [3, 4, 6, 7].includes(part);
  if (!Number.isInteger(part) || part < 1 || part > 7)
    issue("Part không hợp lệ.", "Invalid Part.");
  if (!questions.length)
    issue("Chưa có câu hỏi để import.", "There are no questions to import.");
  const numbers = new Set();
  questions.forEach((q, i) => {
    const target = { questionIndex: i, line: q?.sourceLine };
    const label = en
      ? `Question ${q?.order || i + 1}`
      : `Câu ${q?.order || i + 1}`;
    const add = (vi, english) =>
      issue(`${label}: ${vi}`, `${label}: ${english}`, target);
    if (!hasText(q?.content)) add("thiếu nội dung.", "content is missing.");
    for (const field of ["explanation", "audioUrl", "imageUrl"])
      if (q?.[field] !== undefined && typeof q[field] !== "string")
        add(`${field} phải là văn bản.`, `${field} must be a string.`);
    if (q?.isActive !== undefined && typeof q.isActive !== "boolean")
      add("trạng thái không hợp lệ.", "invalid active state.");
    if (/^\[(?:Nhập|Enter|Nội dung|Question content)/i.test(q?.content || ""))
      add(
        "chưa thay nội dung mẫu bằng câu hỏi thật.",
        "replace the template placeholder with your question.",
      );
    if (!Number.isInteger(q?.order) || q.order < 1)
      add(
        "số câu phải là số nguyên dương.",
        "number must be a positive integer.",
      );
    else if (numbers.has(q.order))
      add("trùng số câu trong bản import.", "duplicate question number.");
    numbers.add(q?.order);
    const options = Array.isArray(q?.options) ? q.options : [];
    if (
      options.length !== expected.length ||
      expected.some((key) => options.filter((o) => o?.key === key).length !== 1)
    ) {
      add(
        `phải có đúng ${expected.join(", ")} và không trùng lựa chọn.`,
        `must have exactly ${expected.join(", ")} without duplicates.`,
      );
    }
    for (const opt of options)
      if (!hasText(opt?.text))
        add(
          `lựa chọn ${opt?.key || "?"} chưa có nội dung.`,
          `option ${opt?.key || "?"} is empty.`,
        );
    for (const opt of options)
      if (/^\[(?:Nhập|Enter|Nội dung|Option)/i.test(opt?.text || ""))
        add(
          `lựa chọn ${opt.key} vẫn là nội dung mẫu.`,
          `option ${opt.key} still contains a placeholder.`,
        );
    if (
      !expected.includes(q?.correctAnswer) ||
      !options.some((o) => o.key === q.correctAnswer)
    )
      add("chưa chọn đáp án đúng hợp lệ.", "select a valid correct answer.");
    for (const field of ["audioUrl", "imageUrl"])
      if (hasText(q?.[field]) && !validUrl(q[field]))
        add(
          `${field} phải là URL http/https.`,
          `${field} must be an http/https URL.`,
        );
    const group = groups.find(
      (g) =>
        (g.id || g.tempId) === q?.passageGroupTempId ||
        g.passages?.some((p) => (p.id || p.tempId) === q?.passageTempId),
    );
    if (grouped && !group)
      add(
        "chưa liên kết với bài đọc / bài nghe.",
        "not linked to a reading or listening exercise.",
      );
    if (!grouped && (q?.passageGroupTempId || q?.passageTempId))
      add(
        "Part này dùng câu hỏi độc lập.",
        "this Part uses standalone questions.",
      );
    if (
      group &&
      q.passageGroupTempId &&
      (group.id || group.tempId) !== q.passageGroupTempId
    )
      add("liên kết nhóm không hợp lệ.", "invalid exercise link.");
    if (
      group &&
      q.passageTempId &&
      !group.passages.some((p) => (p.id || p.tempId) === q.passageTempId)
    )
      add("liên kết đoạn văn không hợp lệ.", "invalid passage link.");
    if (part === 1 && !hasText(q?.imageUrl))
      issue(
        `${label}: chưa có ảnh.`,
        `${label}: image is missing.`,
        target,
        "warning",
      );
    if ([1, 2].includes(part) && !hasText(q?.audioUrl))
      issue(
        `${label}: chưa có audio.`,
        `${label}: audio is missing.`,
        target,
        "warning",
      );
  });
  const groupIds = new Set(),
    passageIds = new Set();
  for (const g of groups) {
    const id = g.id || g.tempId;
    const target = { groupId: id };
    if (!id || groupIds.has(id))
      issue(
        "Nhóm bài tập bị thiếu hoặc trùng mã.",
        "Missing or duplicate exercise ID.",
        target,
      );
    groupIds.add(id);
    const passages = Array.isArray(g.passages) ? g.passages : [];
    if (g.title !== undefined && typeof g.title !== "string")
      issue(
        "Tên bài tập phải là văn bản.",
        "Exercise title must be a string.",
        target,
      );
    const linked = questions.filter(
      (q) =>
        q.passageGroupTempId === id ||
        passages.some((p) => (p.id || p.tempId) === q.passageTempId),
    );
    if (!grouped)
      issue(
        "Part này không sử dụng bài đọc / bài nghe chung.",
        "This Part does not use shared passages.",
        target,
      );
    if (!linked.length)
      issue(
        "Bài tập chưa có câu hỏi liên kết.",
        "Exercise has no linked questions.",
        target,
      );
    if (!passages.length || passages.length > (part === 7 ? 3 : 1))
      issue(
        `Part ${part} cần ${part === 7 ? "1–3" : "1"} đoạn trong mỗi bài tập.`,
        `Part ${part} needs ${part === 7 ? "1–3" : "1"} passages per exercise.`,
        target,
      );
    for (const p of passages) {
      const pid = p.id || p.tempId;
      const pt = { ...target, passageId: pid };
      for (const field of ["content", "audioUrl", "imageUrl"])
        if (p[field] !== undefined && typeof p[field] !== "string")
          issue(`${field} phải là văn bản.`, `${field} must be a string.`, pt);
      if (/^\[(?:Nhập|Enter|Nội dung|Passage)/i.test(p.content || ""))
        issue(
          "Đoạn văn vẫn là nội dung mẫu.",
          "Passage still contains a placeholder.",
          pt,
        );
      if (!pid || passageIds.has(pid))
        issue(
          "Đoạn văn bị thiếu hoặc trùng mã.",
          "Missing or duplicate passage ID.",
          pt,
        );
      passageIds.add(pid);
      if (p.type && !passageTypes.includes(p.type))
        issue("Loại đoạn văn không hợp lệ.", "Invalid passage type.", pt);
      if ([6, 7].includes(part) && hasText(p.content) === hasText(p.imageUrl))
        issue(
          "Mỗi đoạn phải có văn bản hoặc ảnh, không dùng cả hai.",
          "Each passage must contain either text or an image.",
          pt,
        );
      if ([3, 4].includes(part) && !hasText(p.audioUrl))
        issue(
          "Bài nghe chưa có audio.",
          "Listening exercise has no audio.",
          pt,
          "warning",
        );
      if ([3, 4].includes(part) && !hasText(p.audioUrl) && !hasText(p.content))
        issue(
          "Bài nghe cần audio hoặc transcript.",
          "Listening exercise needs audio or a transcript.",
          pt,
        );
      for (const field of ["imageUrl", "audioUrl"])
        if (hasText(p[field]) && !validUrl(p[field]))
          issue(
            `${field} phải là URL http/https.`,
            `${field} must be an http/https URL.`,
            pt,
          );
    }
    if ([3, 4, 6].includes(part) && linked.length !== (part === 6 ? 4 : 3))
      issue(
        `Bài tập Part ${part} thường có ${part === 6 ? 4 : 3} câu; hiện có ${linked.length}.`,
        `Part ${part} usually has ${part === 6 ? 4 : 3} questions; found ${linked.length}.`,
        target,
        "warning",
      );
    if (part === 7 && (linked.length < 2 || linked.length > 5))
      issue(
        `Bài đọc Part 7 thường có 2–5 câu; hiện có ${linked.length}.`,
        `Part 7 usually has 2–5 questions; found ${linked.length}.`,
        target,
        "warning",
      );
  }
  return issues;
}
