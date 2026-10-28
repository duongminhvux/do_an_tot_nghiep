/** Ordering/assignment screens need the complete collection, not a silently truncated first page. */
export async function loadListPages<T, R extends { data: { data: T[]; total: number } }>(
  load: (page: number, limit: number) => Promise<R>,
): Promise<R> {
  const limit = 100;
  const first = await load(1, limit);
  const items = [...first.data.data];
  for (let page = 2; (page - 1) * limit < first.data.total; page++) {
    const next = await load(page, limit);
    if (!next.data.data.length) break;
    items.push(...next.data.data);
  }
  return { ...first, data: { ...first.data, data: items } };
}
