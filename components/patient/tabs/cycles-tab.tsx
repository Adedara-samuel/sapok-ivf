"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowRight, Plus, Snowflake, Sun } from "lucide-react";
import { NumberField, SelectField, toOptions, DateField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { OUTCOME_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import { isoDate } from "@/lib/schemas/common";
import { CycleProtocol, type Cycle } from "@/lib/schemas/cycle";
import { useCycleStore } from "@/lib/stores/cycle";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDate, todayIso } from "@/lib/utils/dates";

const newCycleForm = z.object({
  kind: z.enum(["fresh", "frozen"]),
  protocol: CycleProtocol,
  startDate: isoDate,
  lmp: isoDate.optional(),
  amh: z.number().nonnegative().optional(),
  afc: z.number().int().nonnegative().optional(),
});
type NewCycleForm = z.infer<typeof newCycleForm>;

function CycleRow({ c, patientId }: { c: Cycle; patientId: string }) {
  return (
    <li>
      <Link
        href={`/patients/${patientId}/cycles/${c.id}`}
        className="hover:bg-accent flex flex-wrap items-center gap-3 rounded-lg border p-3"
      >
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg font-semibold">
          {c.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium capitalize">
            Cycle {c.number} · {c.protocol.replace("-", " ")}
          </span>
          <span className="text-muted-foreground text-xs">
            Started {formatDate(c.startDate)}
            {c.ocr ? ` · ${c.ocr.eggs} eggs / ${c.ocr.mii} MII / ${c.ocr.fertilised} 2PN` : ""}
            {c.transferPlan ? ` · transfer ${formatDate(c.transferPlan.date)}` : ""}
          </span>
        </span>
        <StatusChip
          status={c.stage === "cancelled" ? "cancelled" : c.stage === "completed" ? "completed" : "in-progress"}
          label={STAGE_LABELS[c.stage]}
        />
        <StatusChip status={c.outcome} label={OUTCOME_LABELS[c.outcome]} />
        <ArrowRight className="text-muted-foreground size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function CyclesTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const run = useRunAction();
  const canManage = usePermission("cycles.manage");
  const all = useCycleStore((s) => s.cycles);
  const create = useCycleStore((s) => s.create);
  const protocols = useSettingsStore((s) => s.protocols);
  const [open, setOpen] = useState(false);
  const cycles = useMemo(
    () => (ep ? all.filter((c) => c.episodeId === ep.id).sort((a, b) => b.number - a.number) : []),
    [all, ep],
  );
  const form = useZodForm<NewCycleForm>(newCycleForm, { kind: "fresh", protocol: "antagonist", startDate: todayIso() });
  const kind = form.watch("kind");
  if (!ep) return <EmptyState title="No episode" description="Open an episode to start a cycle." />;
  const fresh = cycles.filter((c) => c.kind === "fresh");
  const frozen = cycles.filter((c) => c.kind === "frozen");
  const canStart = canManage && ep.status !== "closed";

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        {canStart ? (
          <Button onClick={() => setOpen(true)}>
            <Plus aria-hidden="true" /> Start new cycle
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Sun className="text-warning size-4" aria-hidden="true" /> Fresh cycles
            </span>
          }
          description="Stimulation, retrieval and fresh transfer or IUI"
        >
          {fresh.length ? (
            <ul className="grid gap-2">
              {fresh.map((c) => (
                <CycleRow key={c.id} c={c} patientId={ctx.patient.id} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No fresh cycles" />
          )}
        </SectionCard>
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Snowflake className="text-info size-4" aria-hidden="true" /> Frozen cycles
            </span>
          }
          description="Endometrial preparation and frozen embryo transfer"
        >
          {frozen.length ? (
            <ul className="grid gap-2">
              {frozen.map((c) => (
                <CycleRow key={c.id} c={c} patientId={ctx.patient.id} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No frozen cycles" />
          )}
        </SectionCard>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new cycle</DialogTitle>
            <DialogDescription>The previous cycle must be completed or cancelled first.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                if (
                  run(() => create(ep.id, v), { success: (c) => `Cycle ${c.number} started`, setError: form.setError })
                ) {
                  form.reset();
                  setOpen(false);
                }
              })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="kind"
                  label="Kind"
                  options={toOptions(["fresh", "frozen"] as const, (k) => (k === "fresh" ? "Fresh" : "Frozen (FET)"))}
                  required
                />
                <SelectField
                  control={form.control}
                  name="protocol"
                  label="Protocol"
                  required
                  options={protocols
                    .filter((p) => (kind === "frozen" ? p.id.startsWith("fet") : !p.id.startsWith("fet")))
                    .map((p) => ({ value: p.id, label: p.name }))}
                />
                <DateField control={form.control} name="startDate" label="Start date" required />
                <DateField control={form.control} name="lmp" label="LMP" />
                <NumberField control={form.control} name="amh" label="AMH" suffix="ng/mL" step="0.01" />
                <NumberField control={form.control} name="afc" label="AFC" step="1" />
              </div>
              <p className="text-muted-foreground text-xs">
                {protocols.find((p) => p.id === form.watch("protocol"))?.description}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Start cycle</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
