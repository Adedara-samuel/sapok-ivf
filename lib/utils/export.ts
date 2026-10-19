import { APP_CONFIG } from "@/lib/config";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsv(c.value(row))).join(","));
  return [header, ...body].join("\n");
}

export function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[], filename: string): void {
  downloadBlob(
    toCsv(rows, columns),
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    "text/csv;charset=utf-8",
  );
}

export async function downloadPdfTable<T>(
  title: string,
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  filename: string,
  subtitle?: string,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.setTextColor(15, 118, 110);
  // the hospital's name (each hospital exports under its own letterhead)
  const { useSettingsStore } = await import("@/lib/stores/settings");
  doc.text(useSettingsStore.getState().clinic.clinicName || APP_CONFIG.name, 40, 40);
  doc.setFontSize(11);
  doc.setTextColor(15, 31, 32);
  doc.text(title, 40, 60);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(91, 107, 109);
    doc.text(subtitle, 40, 74);
  }
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text("DEMO DATA — synthetic records only", pageWidth - 40, 40, { align: "right" });
  autoTable(doc, {
    startY: subtitle ? 86 : 74,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.value(row)))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 118, 110] },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(91, 107, 109);
      doc.text(`Page ${page}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
