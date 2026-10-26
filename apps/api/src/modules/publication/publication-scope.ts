import { AsyncLocalStorage } from 'node:async_hooks';

export const publicationScope = new AsyncLocalStorage<boolean>();
export const PUBLICATION_TABLES = new Set([
  'exams',
  'words',
  'lessons',
  'dictationlessons',
]);
export function learnerPublicationRequest(
  req: { path: string },
  _res: unknown,
  next: () => void,
) {
  const learner = !/^\/api\/(?:admin|_internal)(?:\/|$)/.test(req.path);
  publicationScope.run(learner, next);
}
export function visiblePublicationRows(
  table: string,
  rows: Record<string, any>[],
) {
  if (!publicationScope.getStore() || !PUBLICATION_TABLES.has(table))
    return rows;
  return rows.filter(
    (row) =>
      row.publication_status === 'PUBLISHED' &&
      row.is_deleted !== true &&
      row.is_active !== false,
  );
}
