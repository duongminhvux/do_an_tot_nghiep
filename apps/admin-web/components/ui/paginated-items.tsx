'use client';

import type { ReactNode } from 'react';
import { useListPagination } from '@/hooks/use-list-pagination';
import { ListPagination } from './list-pagination';

export function PaginatedItems<T>({ items, children, resetKey = '', pageSize = 5 }: {
  items: readonly T[];
  children: (items: T[], offset: number) => ReactNode;
  resetKey?: string;
  pageSize?: number;
}) {
  const pagination = useListPagination(items, resetKey, pageSize);
  return <>{children(pagination.items, pagination.offset)}<ListPagination pagination={pagination} /></>;
}
