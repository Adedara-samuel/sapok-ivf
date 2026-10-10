"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet } from "@/components/print/print-sheet";
import { DataTable } from "@/components/shared/data-table";
import { SectionCard } from "@/components/shared/section-card";
import { formatDate } from "@/lib/utils/dates";

/** Standard report layout: chart + table with CSV/PDF export and a printable A4 version. */
export function ReportShell<T>({
  id,
  title,
  description,
  range,
  chart,
  rows,
  columns,
  printColumns,
  summary,
}: {
  id: string;
  title: string;
  description: string;
  range: { from?: string; to?: string };
  chart?: ReactNode;
  rows: T[];
  columns: ColumnDef<T, unknown>[];
  printColumns: { header: string; value: (r: T) => string | number }[];
  summary?: ReactNode;
}) {
  const period = range.from || range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All time";
  return (
    <SectionCard
      title={title}
      description={`${description} · ${period}`}
      actions={
        <PrintDialog title={title} documentTitle={id} auditEntity="report">
          {(ref) => (
            <PrintSheet ref={ref} title={title}>
              <p className="mb-2 text-[#5B6B6D]">
                {description} · {period} · {rows.length} rows
              </p>
              <PrintSection title="Data">
                <table>
                  <thead>
                    <tr>
                      {printColumns.map((c) => (
                        <th key={c.header}>{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 400).map((r, i) => (
                      <tr key={i}>
                        {printColumns.map((c) => (
                          <td key={c.header}>{c.value(r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PrintSection>
            </PrintSheet>
          )}
        </PrintDialog>
      }
    >
      {summary ? <div className="mb-4">{summary}</div> : null}
      {chart ? <div className="mb-4">{chart}</div> : null}
      <DataTable
        data={rows}
        columns={columns}
        exportName={id}
        exportTitle={`${title} (${period})`}
        searchPlaceholder="Search report…"
      />
    </SectionCard>
  );
}
