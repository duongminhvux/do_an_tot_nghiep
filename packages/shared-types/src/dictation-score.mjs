export function gradeDictation(expected, answer) {
  const words = (s) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
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
  return {
    score: target.length
      ? Math.max(0, Math.round((1 - errors / target.length) * 100))
      : 0,
    isCorrect: target.length > 0 && errors === 0,
    errors,
    totalWords: target.length,
  };
}
