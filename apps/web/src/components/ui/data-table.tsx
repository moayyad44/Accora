import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "./table";
import { TableSkeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  /** Search box wired to a global text filter across all columns — omit
   * to hide the search box entirely (e.g. a small fixed lookup table). */
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  onRowClick,
  pageSize = 20,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (isLoading) {
    return (
      <TableContainer>
        <TableSkeleton cols={columns.length} />
      </TableContainer>
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      {searchPlaceholder && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="ps-8"
          />
        </div>
      )}

      <TableContainer>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          ))}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    title={emptyTitle ?? t("common.noData")}
                    description={globalFilter ? t("common.noResults") : emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} clickable={!!onRowClick} onClick={() => onRowClick?.(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {table.getState().pagination.pageIndex * pageSize + 1}–
            {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, rows.length)} / {rows.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronRight className="size-4 rtl:hidden" />
              <ChevronLeft className="hidden size-4 rtl:block" />
            </Button>
            <Button variant="outline" size="icon" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <ChevronLeft className="size-4 rtl:hidden" />
              <ChevronRight className="hidden size-4 rtl:block" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
