'use client';

import { useParams } from 'next/navigation';
import { Pagination } from './pagination';

export interface ListPageState {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  setPage: (page: number) => void;
  setPageSize?: (size: number) => void;
}

export function ListPagination({ pagination, disabled = false }: { pagination: ListPageState; disabled?: boolean }) {
  const { locale } = useParams();
  const english = locale === 'en';
  if (!pagination.totalItems) return null;
  return (
    <fieldset disabled={disabled} className="col-span-full min-w-0 w-full border-t border-slate-100 px-3 disabled:opacity-50">
      <legend className="sr-only">{english ? 'Pagination' : 'Phân trang'}</legend>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3">
        <p aria-live="polite" className="py-2 text-xs text-slate-500">
          {english ? 'Showing' : 'Hiển thị'} {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} / {pagination.totalItems}
        </p>
        {pagination.setPageSize && (
          <label className="flex shrink-0 items-center gap-2 py-3 text-xs text-slate-500">
            <span>{english ? 'Per page' : 'Mỗi trang'}</span>
            <select aria-label={english ? 'Items per page' : 'Số mục mỗi trang'} value={pagination.pageSize}
              onChange={event => pagination.setPageSize?.(Number(event.target.value))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              {[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
      </div>
      <Pagination currentPage={pagination.page} totalPages={pagination.totalPages}
        onPageChange={pagination.setPage} compact showItemCount={false} className="justify-center !py-2" />
    </fieldset>
  );
}
