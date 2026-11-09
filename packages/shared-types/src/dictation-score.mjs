/**
 * Word-level grading. Options (from the admin Dictation settings):
 * caseSensitive, punctuationSensitive, passScore (0-100, score needed to count as correct; 100 = exact).
 */
export function gradeDictation(expected, answer, options = {}) {
  const words = (s) => {
    let text = String(s).normalize("NFKC").replace(/[’‘]/g, "'");
    if (!options.caseSensitive) text = text.toLowerCase();
    if (!options.punctuationSensitive) text = text.replace(/[^\p{L}\p{N}\s]/gu, "");
    return text.trim().split(/\s+/).filter(Boolean);
  };
  const target = words(expected),
    actual = words(answer);
  if (target.length > 500 || actual.length > 500)
    throw new RangeError("Mỗi câu trả lời tối đa 500 từ.");
  let row = Array.from({ length: actual.length + 1 }, (_, i) => i);
  for (let i = 1; i <= target.length; i++) {
    const next = [i];
    for (let j = 1; j <= actual.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (target[i - 1] === actual[j - 1] ? 0 : 1),
      );
    row = next;
  }
  const errors = row[actual.length] ?? target.length;
  const score = target.length
    ? Math.max(0, Math.round((1 - errors / target.length) * 100))
    : 0;
  const passScore = Number.isFinite(options.passScore) ? Math.min(100, Math.max(0, options.passScore)) : 100;
  return {
    score,
    isCorrect: target.length > 0 && (errors === 0 || score >= passScore),
    errors,
    totalWords: target.length,
  };
}
