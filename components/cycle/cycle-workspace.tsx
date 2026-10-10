"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleLineChart } from "@/components/charts/lazy";
import { ConsentPrint } from "@/components/consent/consent-print";
import { CycleSummaryPrint } from "@/components/cycle/cycle-summary-print";
import {
  EmbryoListPanel,
  LutealPanel,
  OcrPanel,
  OutcomePanel,
  TransferPanel,
  TriggerPanel,
} from "@/components/cycle/cycle-panels";
import { StageStepper } from "@/components/cycle/stage-stepper";
import { StimulationForm } from "@/components/cycle/stimulation-form";
import { identifiersFor, type PatientCtx } from "@/components/patient/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { OUTCOME_LABELS } from "@/lib/constants/clinical";
import { isActiveCycle } from "@/lib/schemas/cycle";
import { fullName } from "@/lib/schemas/person";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDate } from "@/lib/utils/dates";

const lead = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

export function CycleWorkspace({ patientId, cycleId }: { patientId: string; cycleId: string }) {
  const run = useRunAction();
  const canManage = usePermission("cycles.manage");
  const { staffName } = useLookups();
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);
  const cycles = useCycleStore((s) => s.cycles);
  const setStage = useCycleStore((s) => s.setStage);
  const cancel = useCycleStore((s) => s.cancel);
  const stimulation = useClinicalStore((s) => s.stimulation);
  const embryosAll = useEmbryologyStore((s) => s.embryos);
  const procedures = useProcedureStore((s) => s.procedures);
  const consentTemplates = useSettingsStore((s) => s.consentTemplates);
  const [addOpen, setAddOpen] = useState(false);

  const cycle = cycles.find((c) => c.id === cycleId);
  const episode = episodes.find((e) => e.id === cycle?.episodeId);
  const patient = persons.find((p) => p.id === patientId);
  const entries = useMemo(
    () => stimulation.filter((s) => s.cycleId === cycleId).sort((a, b) => a.date.localeCompare(b.date)),
    [stimulation, cycleId],
  );
  const embryos = useMemo(() => embryosAll.filter((e) => e.cycleId === cycleId), [embryosAll, cycleId]);
  const candidates = useMemo(() => {
    if (!episode) return [];
    const ids = new Set(cycles.filter((c) => c.episodeId === episode.id).map((c) => c.id));
    return embryosAll.filter(
      (e) =>
        ids.has(e.cycleId) &&
        ((e.status === "culturing" && e.day >= 3) ||
          e.status === "cryopreserved" ||
          e.status === "thawed" ||
          cycle?.transferPlan?.embryoIds.includes(e.id)),
    );
  }, [embryosAll, cycles, episode, cycle]);

  if (!cycle || !episode || !patient || episode.patientId !== patient.id) {
    return (
      <EmptyState
        title="Cycle not found"
        description="It may have been removed by a data reset."
        action={
          <Button asChild>
            <Link href={`/patients/${patientId}`}>Back to patient file</Link>
          </Button>
        }
      />
    );
  }

  const ctx: PatientCtx = {
    patient,
    partner: persons.find((p) => p.id === episode.partnerId),
    episode,
    episodes: episodes.filter((e) => e.patientId === patient.id),
  };
  const editable = canManage && isActiveCycle(cycle) && episode.status !== "closed";
  const last = entries[entries.length - 1];
  const follicleData = entries.map((s) => ({
    day: s.scanDay.split(" ")[0] ?? s.scanDay,
    rightLead: lead(s.follicles.right),
    leftLead: lead(s.follicles.left),
    rightMean: mean(s.follicles.right),
    leftMean: mean(s.follicles.left),
  }));
  const endoData = entries.map((s) => ({
    day: s.scanDay.split(" ")[0] ?? s.scanDay,
    endometrium: s.endometriumMm ?? null,
  }));
  const hormoneData = entries.map((s) => ({
    day: s.scanDay.split(" ")[0] ?? s.scanDay,
    e2: s.e2 ?? null,
    lh: s.lh ?? null,
    p4: s.progesterone ?? null,
  }));
  const doseChanges = entries.flatMap((s, i) => {
    const prev = entries[i - 1];
    return s.injections
      .filter((inj) => !prev || !prev.injections.some((p) => p.drug === inj.drug && p.dose === inj.dose))
      .map((inj) => ({
        date: s.date,
        scan: s.scanDay,
        drug: inj.drug,
        dose: inj.dose,
        kind: prev?.injections.some((p) => p.drug === inj.drug) ? "Dose change" : "Started",
      }));
  });
  const cycleProcedures = procedures.filter((p) => p.cycleId === cycle.id);
  const ivfConsent = consentTemplates.find((t) => t.id === (episode.type === "ICSI" ? "icsi" : "ivf"));

  return (
    <>
      <PageHeader
        title={`Cycle ${cycle.number} · ${cycle.kind === "fresh" ? "Fresh" : "Frozen"} · ${cycle.protocol.replace("-", " ")}`}
        description={`${fullName(patient)} · ${episode.ivfNo} · started ${formatDate(cycle.startDate)}${cycle.lmp ? ` · LMP ${formatDate(cycle.lmp)}` : ""}${cycle.amh !== undefined ? ` · AMH ${cycle.amh}` : ""}${cycle.afc !== undefined ? ` · AFC ${cycle.afc}` : ""}`}
        crumbs={[
          { label: "Patients", href: "/patients" },
          { label: fullName(patient), href: `/patients/${patient.id}?tab=cycles` },
          { label: `Cycle ${cycle.number}` },
        ]}
        actions={
          <>
            <CycleSummaryPrint
              cycle={cycle}
              entries={entries}
              embryos={embryos}
              procedures={cycleProcedures}
              identifiers={identifiersFor(ctx)}
              branchId={patient.branchId}
            />
            {ivfConsent ? (
              <ConsentPrint
                template={ivfConsent}
                identifiers={identifiersFor(ctx)}
                branchId={patient.branchId}
                label="Print consent"
              />
            ) : null}
            {editable ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Ban aria-hidden="true" /> Cancel cycle
                  </Button>
                }
                title="Cancel this cycle?"
                description="The cycle will be closed with outcome 'cancelled'. A new cycle can be started afterwards."
                reasonLabel="Reason (e.g. poor response: 2 follicles at D9)"
                confirmLabel="Cancel cycle"
                onConfirm={(reason) => {
                  run(() => cancel(cycle.id, reason), { success: "Cycle cancelled" });
                }}
              />
            ) : null}
          </>
        }
      />

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            Stage <StatusChip status={cycle.outcome} label={OUTCOME_LABELS[cycle.outcome]} />
          </span>
        }
        description={
          cycle.cancelReason
            ? `Cancelled: ${cycle.cancelReason}`
            : (cycle.plan ?? (editable ? "Click a stage to move the cycle." : undefined))
        }
        className="mb-4"
      >
        <StageStepper
          cycle={cycle}
          disabled={!editable}
          onSelect={editable ? (s) => run(() => setStage(cycle.id, s), { success: "Stage updated" }) : undefined}
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Stimulation monitoring"
          description={`${entries.length} scan(s)${last?.nextScan ? ` · next scan ${formatDate(last.nextScan)}` : ""}`}
          className="xl:col-span-2"
          actions={
            editable ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus aria-hidden="true" /> Add entry
              </Button>
            ) : null
          }
        >
          {entries.length === 0 ? (
            <EmptyState
              title="No monitoring entries yet"
              description="Post the baseline scan to start the follicle chart."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Scan</TableHead>
                    <TableHead>Injections</TableHead>
                    <TableHead>Right (mm)</TableHead>
                    <TableHead>Left (mm)</TableHead>
                    <TableHead className="text-right">ET</TableHead>
                    <TableHead className="text-right">E2</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(s.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.scanDay}</TableCell>
                      <TableCell className="text-xs">
                        {s.injections.map((i) => `${i.drug} ${i.dose}`).join("; ") || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{s.follicles.right.join(", ") || "—"}</TableCell>
                      <TableCell className="tabular-nums">{s.follicles.left.join(", ") || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.endometriumMm ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.e2 ?? "—"}</TableCell>
                      <TableCell className="max-w-64 text-xs">
                        {s.remark}
                        <span className="text-muted-foreground block">{staffName(s.postedBy)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
        <SectionCard title="Drug & dose changes">
          {doseChanges.length === 0 ? (
            <EmptyState title="No injections recorded" />
          ) : (
            <ol className="grid gap-2 text-sm">
              {doseChanges.map((d, i) => (
                <li key={`${d.date}-${d.drug}-${i}`} className="rounded-md border p-2">
                  <span className="text-muted-foreground text-xs">
                    {formatDate(d.date)} · {d.scan} · {d.kind}
                  </span>
                  <span className="block font-medium">
                    {d.drug} — {d.dose}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <SectionCard
            title="Follicle growth"
            description="Lead and mean follicle size by scan day (mm)"
            className="xl:col-span-1"
          >
            <SimpleLineChart
              data={follicleData}
              xKey="day"
              unit=" mm"
              series={[
                { key: "rightLead", label: "Right lead", color: "var(--chart-1)" },
                { key: "leftLead", label: "Left lead", color: "var(--chart-2)" },
                { key: "rightMean", label: "Right mean", color: "var(--chart-3)" },
                { key: "leftMean", label: "Left mean", color: "var(--chart-5)" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Endometrium" description="Thickness (mm)">
            <SimpleLineChart
              data={endoData}
              xKey="day"
              unit=" mm"
              series={[{ key: "endometrium", label: "Endometrium", color: "var(--chart-2)" }]}
            />
          </SectionCard>
          <SectionCard title="Hormones" description="Estradiol (pg/mL), LH (IU/L), progesterone (ng/mL)">
            <SimpleLineChart
              data={hormoneData}
              xKey="day"
              series={[
                { key: "e2", label: "E2", color: "var(--chart-4)" },
                { key: "lh", label: "LH", color: "var(--chart-3)" },
                { key: "p4", label: "P4", color: "var(--chart-6)" },
              ]}
            />
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {cycle.kind === "fresh" ? <TriggerPanel cycle={cycle} last={last} editable={editable} /> : null}
        {cycle.kind === "fresh" ? <OcrPanel cycle={cycle} editable={editable} /> : null}
        <EmbryoListPanel embryos={embryos} />
        <TransferPanel cycle={cycle} candidates={candidates} editable={editable} />
        <LutealPanel cycle={cycle} editable={editable} />
        <OutcomePanel
          cycle={cycle}
          editable={canManage && episode.status !== "closed" && cycle.stage !== "cancelled"}
        />
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New monitoring entry</DialogTitle>
            <DialogDescription>Scan findings, hormones and the injection plan until the next scan.</DialogDescription>
          </DialogHeader>
          <StimulationForm cycleId={cycle.id} defaultInjections={last?.injections} onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
