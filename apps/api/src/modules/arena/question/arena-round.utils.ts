/** Chuẩn hóa đáp án trước khi so sánh, bỏ khác biệt hoa thường và khoảng trắng. */
export function normalizeArenaAnswer(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Che đáp án trong nội dung gợi ý để không làm lộ đáp án trước thời điểm resolve. */
export function maskArenaAnswer(value: string | undefined, answer: string) {
  if (!value || !answer.trim()) return value;
  const pattern = answer
    .normalize('NFKC')
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return value.normalize('NFKC').replace(new RegExp(pattern, 'giu'), '_____');
}

/** Tạo thứ tự các vị trí chữ cái sẽ được mở dần trong hint. */
export function arenaHintOrder(answer: string) {
  const chars = Array.from(answer);
  const indices = chars.flatMap((char, index) =>
    /[\p{L}\p{N}]/u.test(char) ? [index] : [],
  );
  if (indices.length < 2) return indices;
  const order = [indices[0], indices[indices.length - 1]];
  const gaps: [number, number][] = [[1, indices.length - 2]];
  while (gaps.length) {
    const [left, right] = gaps.shift()!;
    if (left > right) continue;
    const middle = Math.floor((left + right) / 2);
    order.push(indices[middle]);
    gaps.push([left, middle - 1], [middle + 1, right]);
  }
  return order;
}

export function arenaHintLetters(
  answer: string,
  elapsedMs: number,
  limitMs: number,
) {
  const chars = Array.from(answer);
  const order = arenaHintOrder(answer);
  const maxHints = Math.floor(order.length * 0.3);
  const remainingMs = limitMs - elapsedMs;
  // Hints exist only while 5 < remaining seconds < 20; never expose over 30%.
  const count =
    remainingMs > 5000 && remainingMs < 20000
      ? Math.min(
          maxHints,
          Math.ceil((maxHints * (20000 - remainingMs)) / 15000),
        )
      : 0;
  const revealed = new Set(order.slice(0, count));
  return chars.map((char, index) =>
    revealed.has(index) || !/[\p{L}\p{N}]/u.test(char) ? char : null,
  );
}
