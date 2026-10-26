export function toeicOutcomes(attempt) {
  if (!["FINISHED", "COMPLETED"].includes(attempt.status)) return [];
  return (attempt.questionSnapshot ?? []).filter(q => typeof attempt.answers?.[q._id] === 'string' && attempt.answers[q._id].length > 0).map((q) => ({
    sourceType: "TOEIC",
    sourceItemId: String(q._id),
    sourceRefId: String(attempt._id),
    title: `Part ${q.part} · ${q.content || "TOEIC"}`.slice(0, 300),
    samples: 1,
    wrongCount:
      attempt.answers?.[q._id] && attempt.answers[q._id] !== q.correctAnswer
        ? 1
        : 0,
  }));
}
export function dictationOutcomes(progress, segments) {
  if (!progress.completed) return [];
  return segments.flatMap((segment) => {
    const result = (progress.segmentProgress ?? []).find(
      (p) => p.segmentIndex === segment.order,
    );
    if (!result?.attempts) return [];
    return [
      {
        sourceType: "DICTATION",
        sourceItemId: String(segment._id),
        sourceRefId: String(progress.lessonId),
        title: segment.text.slice(0, 300),
        samples: result.attempts,
        wrongCount: result.wrongAttempts ?? 0,
      },
    ];
  });
}
export function vocabularyOutcomes(sessionId, actions, titles) {
  const words = new Map();
  for (const action of actions) {
    if (action.isCorrect == null && !action.rating) continue;
    const id = String(action.wordId);
    const item = words.get(id) ?? {
      sourceType: "VOCABULARY",
      sourceItemId: id,
      sourceRefId: sessionId,
      title: (titles[id] || id).slice(0, 300),
      samples: 0,
      wrongCount: 0,
    };
    item.samples += 1;
    if (action.isCorrect === false || action.rating === "AGAIN")
      item.wrongCount += 1;
    words.set(id, item);
  }
  return [...words.values()];
}
