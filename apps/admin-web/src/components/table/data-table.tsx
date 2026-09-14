"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  mobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  loading?: boolean;
  filter?: ReactNode;
  actions?: ReactNode;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchText,
  loading = false,
  filter,
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        header: column.header,
        cell: ({ row }) => column.cell(row.original),
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId: (row) => row.id,
    state: { globalFilter: search, rowSelection },
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row) =>
      searchText(row.original).toLowerCase().includes(search.trim().toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 6 } },
  });

  const rows = table.getRowModel().rows;
  const resultCount = table.getFilteredRowModel().rows.length;
  const page = table.getState().pagination.pageIndex + 1;
  const totalPages = Math.max(1, table.getPageCount());

  return (
    <div className="admin-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 outline-none focus:border-blue-500"
            placeholder="Search records..."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {filter}
          <Button variant="secondary" size="sm">
            <SlidersHorizontal className="size-4" />More filters
          </Button>
          {actions}
        </div>
      </div>

      {loading ? (
        <div className="p-4"><TableSkeleton /></div>
      ) : !rows.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      aria-label="Select all rows on page"
                      type="checkbox"
                      checked={table.getIsAllPageRowsSelected()}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                    />
                  </th>
                  {table.getHeaderGroups()[0]?.headers.map((header) => (
                    <th key={header.id} className="whitespace-nowrap px-4 py-3">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Select ${row.id}`}
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-[13px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 md:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-lg border border-slate-200 p-4">
                {columns.filter((column) => column.mobile !== false).map((column) => (
                  <div key={column.key} className="mb-2 flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold text-slate-400">{column.header}</span>
                    <div className="text-right text-sm">{column.cell(row.original)}</div>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              {resultCount} results • Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
