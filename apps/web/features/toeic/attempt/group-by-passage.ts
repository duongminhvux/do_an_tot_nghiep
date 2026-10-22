// Consecutive questions that share a passage group are rendered together so
// the shared image/audio/passage panel only appears once per group.
export function groupByPassage<T>(
  items: readonly T[],
  passageGroupId: (item: T) => string | undefined | null,
): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const previous = groups.at(-1);
    const id = passageGroupId(item);
    if (id && previous?.[0] && passageGroupId(previous[0]) === id)
      previous.push(item);
    else groups.push([item]);
  }
  return groups;
}
