export const RECOMMENDATION_RULES_ID = "00000000-0000-4000-8000-000000000011";
export const DEFAULT_RECOMMENDATION_RULES = Object.freeze({
  enabled: true,
  maxSuggestions: 3,
  minSamples: 3,
  minQuestions: 10,
  weakAccuracy: 70,
  prioritizeDue: true,
  sources: ["vocabulary", "toeic", "dictation"],
});

export function normalizeRecommendationRules(input) {
  const defaults = DEFAULT_RECOMMENDATION_RULES;
  const value = input ?? {};
  const integer = (key, min, max) =>
    Number.isInteger(value[key]) && value[key] >= min && value[key] <= max
      ? value[key]
      : defaults[key];
  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    maxSuggestions: integer("maxSuggestions", 1, 3),
    minSamples: integer("minSamples", 2, 30),
    minQuestions: integer("minQuestions", 5, 200),
    weakAccuracy: integer("weakAccuracy", 1, 99),
    prioritizeDue:
      typeof value.prioritizeDue === "boolean"
        ? value.prioritizeDue
        : defaults.prioritizeDue,
    sources:
      Array.isArray(value.sources) &&
      value.sources.length <= 3 &&
      new Set(value.sources).size === value.sources.length &&
      value.sources.every((source) => defaults.sources.includes(source))
        ? [...value.sources]
        : [...defaults.sources],
  };
}

/** Pure rule engine shared by real recommendations and the Admin simulator. */
export function buildRecommendations(input, rawRules, language = "vi") {
  const rules = normalizeRecommendationRules(rawRules);
  if (!rules.enabled || !rules.sources.length)
    return { state: "disabled", items: [] };
  const en = language === "en";
  const items = [];
  const add = (source, item) => {
    if (!rules.sources.includes(source)) return;
    items.push({
      ...item,
      source,
      priority: 100 - rules.sources.indexOf(source) * 10,
    });
  };
  const reviewCount = Math.min(input.dueCount, 50);
  if (reviewCount > 0)
    add("vocabulary", {
      id: "vocabulary-due",
      type: "vocabulary",
      title: en
        ? `Review ${reviewCount} due words`
        : `Ôn ${reviewCount} từ đến hạn`,
      reason:
        input.dueCount > 50
          ? en
            ? `You have ${input.dueCount} due words; start with 50 in the existing review session.`
            : `Bạn có ${input.dueCount} từ đến hạn; bắt đầu với 50 từ trong lượt ôn hiện có.`
          : en
            ? "These words are due according to your review schedule."
            : "Các từ này đã đến hạn theo lịch ôn của bạn.",
      estimatedMinutes: Math.min(20, Math.max(2, Math.ceil(reviewCount / 3))),
      actionUrl: "/vocabulary/review",
    });
  for (const part of [...input.parts].sort(
    (a, b) => a.correct / a.total - b.correct / b.total || a.part - b.part,
  )) {
    if (items.some((item) => item.source === "toeic")) break;
    if (
      part.samples < rules.minSamples ||
      part.total < rules.minQuestions ||
      (part.correct / part.total) * 100 >= rules.weakAccuracy ||
      !part.actionUrl
    )
      continue;
    const accuracy = Math.round((part.correct / part.total) * 100);
    add("toeic", {
      id: `toeic-part-${part.part}`,
      type: part.part <= 4 ? "listening" : "reading",
      title: en
        ? `Practise TOEIC Part ${part.part}`
        : `Luyện TOEIC Part ${part.part}`,
      reason: en
        ? `${accuracy}% correct across ${part.samples} completed attempts (${part.total} questions) in the last 30 days.`
        : `Đúng ${accuracy}% qua ${part.samples} lượt đã hoàn thành (${part.total} câu) trong 30 ngày gần đây.`,
      estimatedMinutes: 10,
      actionUrl: part.actionUrl,
    });
  }
  const d = input.dictation;
  if (
    d?.actionUrl &&
    d.samples >= rules.minSamples &&
    d.total >= rules.minQuestions &&
    (d.correct / d.total) * 100 < rules.weakAccuracy
  )
    add("dictation", {
      id: "dictation-listening",
      type: "listening",
      title: en ? "Practise a short dictation" : "Làm một bài Dictation ngắn",
      reason: en
        ? `First-try accuracy is ${Math.round((d.correct / d.total) * 100)}% across ${d.samples} completed lessons in the last 30 days.`
        : `Tỷ lệ đúng lần đầu là ${Math.round((d.correct / d.total) * 100)}% qua ${d.samples} bài đã hoàn thành trong 30 ngày gần đây.`,
      estimatedMinutes: d.estimatedMinutes ?? 5,
      actionUrl: d.actionUrl,
    });
  if (rules.prioritizeDue) {
    const due = items.find((item) => item.id === "vocabulary-due");
    if (due) due.priority = 200;
  }
  // Fallbacks avoid unsupported weakness claims.
  if (!items.length) {
    const source = rules.sources[0];
    const enoughEvidence =
      (rules.sources.includes("toeic") &&
        input.parts.some(
          (part) =>
            part.samples >= rules.minSamples &&
            part.total >= rules.minQuestions,
        )) ||
      (rules.sources.includes("dictation") &&
        d &&
        d.samples >= rules.minSamples &&
        d.total >= rules.minQuestions);
    add(source, {
      id: enoughEvidence ? "maintenance" : "starter",
      type:
        source === "vocabulary"
          ? "vocabulary"
          : source === "dictation"
            ? "listening"
            : "reading",
      title: enoughEvidence
        ? en
          ? "Keep up your study routine"
          : "Duy trì nhịp học của bạn"
        : en
          ? "Start with a practice activity"
          : "Bắt đầu với một bài luyện thử",
      reason: enoughEvidence
        ? en
          ? "Choose an available activity to continue practising."
          : "Chọn một bài đang khả dụng để tiếp tục luyện tập."
        : en
          ? "There is not enough recent evidence to identify a weak skill yet."
          : "Chưa đủ dữ liệu gần đây để xác định kỹ năng cần cải thiện.",
      estimatedMinutes: 5,
      actionUrl:
        source === "vocabulary"
          ? "/vocabulary"
          : source === "dictation"
            ? "/dictation"
            : "/toeic",
    });
  }
  return {
    state: items[0]?.id === "starter" ? "insufficient_data" : "ready",
    items: items
      .sort((a, b) => b.priority - a.priority)
      .slice(0, rules.maxSuggestions),
  };
}

export function recommendationScenario(scenario) {
  if (scenario === "new") return { dueCount: 0, parts: [], dictation: null };
  const samples = scenario === "little" ? 1 : 5;
  return {
    dueCount: scenario === "little" ? 0 : 12,
    parts: [{ part: 2, samples, total: 30, correct: 12, actionUrl: "/toeic" }],
    dictation: {
      samples,
      total: 20,
      correct: 8,
      actionUrl: "/dictation",
      estimatedMinutes: 5,
    },
  };
}
