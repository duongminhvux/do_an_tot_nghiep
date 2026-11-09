export function sentenceAtTime(
  segments: ReadonlyArray<{ startMs: number }>,
  timeMs: number,
) {
  if (!segments.length || !Number.isFinite(timeMs)) return -1;
  let low = 0,
    high = segments.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (segments[mid]!.startMs <= timeMs) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, high);
}
