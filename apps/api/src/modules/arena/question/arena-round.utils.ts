/** Chuẩn hóa đáp án trước khi so sánh, bỏ khác biệt hoa thường và khoảng trắng. */
export function normalizeArenaAnswer(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Irregular forms cannot be derived from English suffix rules.
const irregularForms = [
  ['do', 'does', 'did', 'done', 'doing'],
  ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  ['have', 'has', 'had', 'having'],
  ['go', 'goes', 'went', 'gone', 'going'],
  ['make', 'makes', 'made', 'making'],
  ['take', 'takes', 'took', 'taken', 'taking'],
  ['get', 'gets', 'got', 'gotten', 'getting'],
  ['write', 'writes', 'wrote', 'written', 'writing'],
  ['run', 'runs', 'ran', 'running'],
  ['eat', 'eats', 'ate', 'eaten', 'eating'],
  ['see', 'sees', 'saw', 'seen', 'seeing'],
];

function arenaAnswerForms(answer: string): string[] {
  if (!/^[a-z]+$/.test(answer)) return [answer];
  const irregular = irregularForms.find((forms) => forms.includes(answer));
  if (irregular) return irregular;
  const forms = new Set([answer]);
  forms.add(
    /[^aeiou]y$/.test(answer)
      ? `${answer.slice(0, -1)}ies`
      : /(?:s|x|z|ch|sh|o)$/.test(answer)
        ? `${answer}es`
        : `${answer}s`,
  );
  if (/[^aeiou]y$/.test(answer)) forms.add(`${answer.slice(0, -1)}ied`);
  else forms.add(`${answer}${answer.endsWith('e') ? 'd' : 'ed'}`);
  if (answer.endsWith('ie')) forms.add(`${answer.slice(0, -2)}ying`);
  else if (answer.endsWith('e') && !answer.endsWith('ee'))
    forms.add(`${answer.slice(0, -1)}ing`);
  else forms.add(`${answer}ing`);
  // Single-syllable consonant-vowel-consonant words: stop -> stopped/stopping.
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(answer)) {
    forms.add(`${answer}${answer.at(-1)}ed`);
    forms.add(`${answer}${answer.at(-1)}ing`);
  }
  return [...forms];
}

/** Hide complete answer words and their inflections without masking substrings. */
export function maskArenaAnswer(value: string | undefined, answer: string) {
  if (!value || !answer.trim()) return value;
  const pattern = arenaAnswerForms(normalizeArenaAnswer(answer))
    .sort((a, b) => b.length - a.length)
    .map((form) =>
      form
        .split(/\s+/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+'),
    )
    .join('|');
  return value
    .normalize('NFKC')
    .replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`,
        'giu',
      ),
      '_____',
    );
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
  settings: { startAfterSeconds?: number; intervalSeconds?: number; maxPercent?: number } = {},
) {
  const chars = Array.from(answer);
  const order = arenaHintOrder(answer);
  const percent = Math.max(0, Math.min(100, settings.maxPercent ?? 30));
  const delayMs = Math.max(0, settings.startAfterSeconds ?? 10)*1000;
  const intervalMs = Math.max(1, settings.intervalSeconds ?? 5)*1000;
  // Keep at least one useful character for short words, but only 100% reveals
  // the entire answer. Zero percent disables letter hints.
  const maxHints = percent === 0 ? 0 : percent === 100 ? order.length
    : Math.min(order.length-1, Math.max(1, Math.floor(order.length*percent/100)));
  const elapsed = Math.max(0, Math.min(elapsedMs, limitMs));
  const count = elapsed >= delayMs ? Math.min(maxHints, 1+Math.floor((elapsed-delayMs)/intervalMs)) : 0;
  const revealed = new Set(order.slice(0, count));
  return chars.map((char, index) =>
    revealed.has(index) || !/[\p{L}\p{N}]/u.test(char) ? char : null,
  );
}
