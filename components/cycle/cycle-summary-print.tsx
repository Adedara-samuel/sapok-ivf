"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet, type PrintIdentifier } from "@/components/print/print-sheet";
import { useLookups } from "@/hooks/use-lookups";
import { OUTCOME_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import type { StimulationEntry } from "@/lib/schemas/clinical";
import type { Cycle } from "@/lib/schemas/cycle";
import type { Embryo } from "@/lib/schemas/embryology";
import type { Procedure } from "@/lib/schemas/procedure";
import { formatDate } from "@/lib/utils/dates";

export function CycleSummaryPrint({
  cycle,
  entries,
  embryos,
  procedures,
  identifiers,
  branchId,
}: {
  cycle: Cycle;
  entries: StimulationEntry[];
  embryos: Embryo[];
  procedures: Procedure[];
  identifiers: PrintIdentifier[];
  branchId: string;
}) {
  const { staffName } = useLookups();
  return (
    <PrintDialog
      title={`Cycle ${cycle.number} summary sheet`}
      documentTitle={`cycle-${cycle.number}-summary`}
      auditEntity="cycle"
      auditId={cycle.id}
      trigger={
        <Button variant="outline">
          <Printer aria-hidden="true" /> Print summary sheet
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet
          ref={ref}
          title={`IVF cycle ${cycle.number} — summary sheet`}
          identifiers={identifiers}
          branchId={branchId}
        >
          <PrintSection title="Cycle">
            <table>
              <tbody>
                <tr>
                  <th>Kind / protocol</th>
                  <td>
                    {cycle.kind} · {cycle.protocol}
                  </td>
                  <th>Start / LMP</th>
                  <td>
                    {formatDate(cycle.startDate)} / {formatDate(cycle.lmp)}
                  </td>
                </tr>
                <tr>
                  <th>AMH / AFC</th>
                  <td>
                    {cycle.amh ?? "—"} ng/mL / {cycle.afc ?? "—"}
                  </td>
                  <th>Stage / outcome</th>
                  <td>
                    {STAGE_LABELS[cycle.stage]} / {OUTCOME_LABELS[cycle.outcome]}
                  </td>
                </tr>
                <tr>
                  <th>Trigger</th>
                  <td>
                    {cycle.trigger
                      ? `${cycle.trigger.drug} ${formatDate(cycle.trigger.date)} ${cycle.trigger.time}`
                      : "—"}
                  </td>
                  <th>OCR</th>
                  <td>
                    {cycle.ocr ? `${cycle.ocr.eggs} eggs · ${cycle.ocr.mii} MII · ${cycle.ocr.fertilised} 2PN` : "—"}
                  </td>
                </tr>
                <tr>
                  <th>Transfer</th>
                  <td>
                    {cycle.transferPlan
                      ? `${formatDate(cycle.transferPlan.date)} · ${cycle.transferPlan.embryoIds.length} embryo(s)`
                      : "—"}
                  </td>
                  <th>Luteal support</th>
                  <td>{cycle.lutealSupport ?? "—"}</td>
                </tr>
                <tr>
                  <th>β-hCG</th>
                  <td colSpan={3}>
                    {cycle.betaHcg
                      ? `${formatDate(cycle.betaHcg.date)} ${cycle.betaHcg.value !== undefined ? `· ${cycle.betaHcg.value} IU/L` : "(due)"}`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </PrintSection>
          <PrintSection title="Stimulation monitoring">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Scan</th>
                  <th>Injections</th>
                  <th>Right (mm)</th>
                  <th>Left (mm)</th>
                  <th>ET</th>
                  <th>E2</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.date)}</td>
                    <td>{s.scanDay}</td>
                    <td>{s.injections.map((i) => `${i.drug} ${i.dose}`).join("; ")}</td>
                    <td>{s.follicles.right.join(", ")}</td>
                    <td>{s.follicles.left.join(", ")}</td>
                    <td>{s.endometriumMm ?? ""}</td>
                    <td>{s.e2 ?? ""}</td>
                    <td>{s.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
          <PrintSection title="Embryology">
            <p>
              {embryos.map((e) => `${e.label} D${e.day} ${e.grade ?? ""} (${e.status})`).join(" · ") || "No embryos"}
            </p>
          </PrintSection>
          <PrintSection title="Procedures">
            {procedures.map((p) => (
              <p key={p.id}>
                {formatDate(p.date)} {p.type} — {staffName(p.surgeonId)} — {p.status}: {p.postOpNote}
              </p>
            ))}
          </PrintSection>
          {cycle.plan ? (
            <PrintSection title="Plan">
              <p>{cycle.plan}</p>
            </PrintSection>
          ) : null}
        </PrintSheet>
      )}
    </PrintDialog>
  );
}
