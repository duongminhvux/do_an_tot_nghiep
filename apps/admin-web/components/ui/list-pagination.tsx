"use client";

import { useParams } from "next/navigation";
import { Pagination } from "./pagination";

export interface ListPageState {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  setPage: (page: number) => void;
  setPageSize?: (size: number) => void;
}

export function ListPagination({
  pagination,
  disabled = false,
}: {
  pagination: ListPageState;
  disabled?: boolean;
}) {
  const { locale } = useParams();
  const english = locale === "en";
  if (!pagination.totalItems) return null;
  return (
    <fieldset
      disabled={disabled}
      className="col-span-full min-w-0 w-full border-t border-slate-100 px-3 disabled:opacity-50"
    >
      <legend className="sr-only">
        {english ? "Pagination" : "Phân trang"}
      </legend>
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        itemLabel={english ? "items" : "mục"}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </fieldset>
  );
}
