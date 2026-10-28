'use client';

import { useEffect, useState } from 'react';

export function useRemotePagination(resetKey: string, initialPageSize = 10) {
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  const [pageSize, setSize] = useState(initialPageSize);
  const page = position.key === resetKey ? position.page : 1;
  useEffect(() => {
    setPosition(previous => previous.key === resetKey ? previous : { key: resetKey, page: 1 });
  }, [resetKey]);
  return {
    page, pageSize,
    setPage: (next: number) => setPosition({ key: resetKey, page: Math.max(1, next) }),
    setPageSize: (next: number) => { setSize(next); setPosition({ key: resetKey, page: 1 }); },
  };
}
