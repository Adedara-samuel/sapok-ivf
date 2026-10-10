"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { audit } from "@/lib/stores/audit";
import { downloadCsv, downloadPdfTable, type ExportColumn } from "@/lib/utils/export";
import { cn } from "@/lib/utils/cn";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Plain value used for CSV/PDF export; defaults to the accessor value. */
    exportValue?: (row: TData) => string | number;
    align?: "right" | "center";
    label?: string;
  }
}

const VIRTUALIZE_ABOVE = 200;
const ROW_HEIGHT = 44;

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search…",
  toolbar,
  exportName,
  exportTitle,
  onRowClick,
  pageSize = 15,
  empty,
  initialSorting = [],
  initialHidden = {},
  searchable = true,
  dense = false,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  exportName?: string;
  exportTitle?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  empty?: ReactNode;
  initialSorting?: SortingState;
  initialHidden?: VisibilityState;
  searchable?: boolean;
  dense?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibility, setVisibility] = useState<VisibilityState>(initialHidden);
  const virtualize = data.length > VIRTUALIZE_ABOVE;
  // TanStack Table returns non-memoisable functions; the React Compiler lint rule is not applicable here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(virtualize ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const exportColumns = useMemo<ExportColumn<T>[]>(
    () =>
      table
        .getVisibleLeafColumns()
        .filter((c) => c.id !== "actions" && c.id !== "select")
        .map((c) => ({
          header: c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id),
          value: (row: T) => {
            const fn = c.columnDef.meta?.exportValue;
            if (fn) return fn(row);
            const accessor = "accessorFn" in c.columnDef ? c.columnDef.accessorFn : undefined;
            const v = accessor ? accessor(row, 0) : (row as Record<string, unknown>)[c.id];
            return typeof v === "number" ? v : v === undefined || v === null ? "" : String(v);
          },
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, visibility, columns],
  );

  const exportRows = () => table.getFilteredRowModel().rows.map((r) => r.original);

  const header = (
    <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur">
      {table.getHeaderGroups().map((hg) => (
        <TableRow key={hg.id}>
          {hg.headers.map((h) => {
            const sorted = h.column.getIsSorted();
            const align = h.column.columnDef.meta?.align;
            return (
              <TableHead
                key={h.id}
                className={cn("h-10 whitespace-nowrap", align === "right" && "text-right")}
                aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
              >
                {h.isPlaceholder ? null : h.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={h.column.getToggleSortingHandler()}
                    className={cn(
                      "hover:text-foreground inline-flex items-center gap-1",
                      align === "right" && "flex-row-reverse",
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3" aria-hidden="true" />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3" aria-hidden="true" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  flexRender(h.column.columnDef.header, h.getContext())
                )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );

  const renderRow = (row: (typeof rows)[number], style?: React.CSSProperties) => (
    <TableRow
      key={row.id}
      style={style}
      className={cn(onRowClick && "cursor-pointer", dense ? "h-9" : "h-11")}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(row.original) : undefined) : undefined}
      tabIndex={onRowClick ? 0 : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn("py-2", cell.column.columnDef.meta?.align === "right" && "text-right tabular-nums")}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <div className="grid gap-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        {searchable ? (
          <div className="relative min-w-56 flex-1 md:max-w-xs">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
              aria-label={searchPlaceholder}
              data-table-search
            />
          </div>
        ) : null}
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 aria-hidden="true" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(v === true)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {exportName ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download aria-hidden="true" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    downloadCsv(exportRows(), exportColumns, exportName);
                    audit("export", "report", `Exported ${exportTitle ?? exportName} (CSV)`);
                  }}
                >
                  <Download aria-hidden="true" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void downloadPdfTable(
                      exportTitle ?? exportName,
                      exportRows(),
                      exportColumns,
                      exportName,
                      `${exportRows().length} rows`,
                    );
                    audit("export", "report", `Exported ${exportTitle ?? exportName} (PDF)`);
                  }}
                >
                  <FileText aria-hidden="true" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        (empty ?? <EmptyState title="No records match" description="Try clearing the search or filters." />)
      ) : virtualize ? (
        <div ref={scrollRef} className="relative max-h-[640px] overflow-auto rounded-xl border">
          <Table>
            {header}
            <TableBody style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                return row
                  ? renderRow(row, {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      display: "table",
                      tableLayout: "fixed",
                      transform: `translateY(${vi.start}px)`,
                    })
                  : null;
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            {header}
            <TableBody>{rows.map((r) => renderRow(r))}</TableBody>
          </Table>
        </div>
      )}

      <div className="no-print text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {table.getFilteredRowModel().rows.length} of {data.length} records
        </span>
        {!virtualize && table.getPageCount() > 1 ? (
          <div className="flex items-center gap-2">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
