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
  // Giới hạn hint tối đa 30%, bắt đầu sau một giây và mở đủ trong năm giây.
  const hintEndMs = Math.min(5000, limitMs);
  const hintStartMs = Math.min(1000, hintEndMs);
  const count =
    elapsedMs < hintStartMs
      ? 0
      : Math.min(
          maxHints,
          1 +
            Math.floor(
              ((elapsedMs - hintStartMs) /
                Math.max(1, hintEndMs - hintStartMs)) *
                Math.max(0, maxHints - 1),
            ),
        );
  const revealed = new Set(order.slice(0, count));
  return chars.map((char, index) =>
    revealed.has(index) || !/[\p{L}\p{N}]/u.test(char) ? char : null,
  );
}
