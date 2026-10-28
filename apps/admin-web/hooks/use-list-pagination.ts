'use client';

import { useEffect, useState } from 'react';

export function useListPagination<T>(items: readonly T[], resetKey = '', initialPageSize = 10) {
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  const [pageSize, setSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = position.key === resetKey ? Math.min(position.page, totalPages) : 1;
  useEffect(() => {
    setPosition(previous => previous.key === resetKey && previous.page === page ? previous : { key: resetKey, page });
  }, [resetKey, page]);
  const setPage = (next: number) => setPosition({ key: resetKey, page: Math.max(1, Math.min(next, totalPages)) });
  const setPageSize = (next: number) => {
    if (!Number.isSafeInteger(next) || next < 1) return;
    setSize(next);
    setPosition({ key: resetKey, page: 1 });
  };
  const offset = (page - 1) * pageSize;
  return { items: items.slice(offset, offset + pageSize), page, pageSize, totalPages,
    totalItems: items.length, offset, setPage, setPageSize };
}
