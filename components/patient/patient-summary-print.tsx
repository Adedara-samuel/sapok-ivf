"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet } from "@/components/print/print-sheet";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { EPISODE_TYPE_LABELS, OUTCOME_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useCycleStore } from "@/lib/stores/cycle";
import { useOrderStore } from "@/lib/stores/orders";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

export function PatientSummaryPrint({ ctx }: { ctx: PatientCtx }) {
  const { staffName } = useLookups();
  const cycles = useCycleStore((s) => s.cycles);
  const notes = useClinicalStore((s) => s.notes);
  const orders = useOrderStore((s) => s.orders);
  const ep = ctx.episode;
  const epCycles = ep ? cycles.filter((c) => c.episodeId === ep.id) : [];
  const epNotes = ep ? notes.filter((n) => n.episodeId === ep.id).slice(-6) : [];
  const results = ep
    ? orders.filter(
        (o) => o.episodeId === ep.id && o.status === "resulted" && (o.kind === "lab" || o.kind === "radiology"),
      )
    : [];
  return (
    <PrintDialog
      title="Patient summary"
      documentTitle={`Patient summary ${ctx.patient.prn}`}
      auditEntity="patient"
      auditId={ctx.patient.id}
      trigger={
        <Button variant="outline">
          <Printer aria-hidden="true" /> Print summary
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet ref={ref} title="Patient summary" identifiers={identifiersFor(ctx)} branchId={ctx.patient.branchId}>
          <PrintSection title="Episode">
            {ep ? (
              <p>
                {EPISODE_TYPE_LABELS[ep.type]} · opened {formatDate(ep.openedAt)} · {ep.status} · Doctor:{" "}
                {staffName(ep.doctorId)} · Diagnosis: {ep.diagnosis.join(", ")}
              </p>
            ) : (
              <p>No episode opened.</p>
            )}
          </PrintSection>
          <PrintSection title="Cycles">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kind</th>
                  <th>Protocol</th>
                  <th>Start</th>
                  <th>Stage</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {epCycles.map((c) => (
                  <tr key={c.id}>
                    <td>{c.number}</td>
                    <td>{c.kind}</td>
                    <td>{c.protocol}</td>
                    <td>{formatDate(c.startDate)}</td>
                    <td>{STAGE_LABELS[c.stage]}</td>
                    <td>{OUTCOME_LABELS[c.outcome]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
          <PrintSection title="Results">
            <table>
              <tbody>
                {results.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.resultText}</td>
                    <td>{o.abnormal ? "Abnormal" : "Normal"}</td>
                    <td>{formatDate(o.resultedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
          <PrintSection title="Recent notes">
            {epNotes.map((n) => (
              <p key={n.id} className="mb-1">
                <strong>
                  {formatDateTime(n.createdAt)} · {staffName(n.authorId)} ({n.kind}):
                </strong>{" "}
                {n.body}
              </p>
            ))}
          </PrintSection>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}
