"use client";

import { useMemo } from "react";
import Link from "next/link";
import { z } from "zod";
import { Microscope, Target } from "lucide-react";
import { NumberField, SelectField, TextareaField, toOptions, DateField, TimeField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { OUTCOME_LABELS } from "@/lib/constants/clinical";
import type { StimulationEntry } from "@/lib/schemas/clinical";
import { isoDate } from "@/lib/schemas/common";
import { CycleOutcome, type Cycle } from "@/lib/schemas/cycle";
import type { Embryo } from "@/lib/schemas/embryology";
import { useCycleStore } from "@/lib/stores/cycle";
import { formatDate, shiftDate, todayIso } from "@/lib/utils/dates";
import { gradeScore } from "@/lib/utils/embryo";
import { percent } from "@/lib/utils/money";

const TRIGGER_DRUGS = ["Choriogonadotropin alfa 250 mcg", "hCG 5000 IU", "Triptorelin 0.1 mg"] as const;

const triggerForm = z.object({
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
  drug: z.string().min(2, "Choose the trigger drug"),
});
type TriggerForm = z.infer<typeof triggerForm>;

export function TriggerPanel({ cycle, last, editable }: { cycle: Cycle; last?: StimulationEntry; editable: boolean }) {
  const run = useRunAction();
  const setTrigger = useCycleStore((s) => s.setTrigger);
  const form = useZodForm<TriggerForm>(
    triggerForm,
    cycle.trigger ?? { date: todayIso(), time: "22:00", drug: TRIGGER_DRUGS[0] },
  );
  const sizes = last ? [...last.follicles.right, ...last.follicles.left] : [];
  const mature = sizes.filter((s) => s >= 17).length;
  const near = sizes.filter((s) => s >= 14).length;
  const ready = mature >= 3;
  const t = form.watch();
  return (
    <SectionCard title="Trigger planning" description="Trigger when ≥3 follicles reach 17 mm; OCR 34–36 hours later.">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Target className="text-primary size-4" aria-hidden="true" />
        {last ? (
          <>
            Latest scan {formatDate(last.date)}: <strong>{mature}</strong> follicle(s) ≥17 mm, <strong>{near}</strong>{" "}
            ≥14 mm.
            <StatusChip
              status={ready ? "approved" : "pending"}
              label={ready ? "Trigger criteria met" : "Not yet — continue stimulation"}
            />
          </>
        ) : (
          "No monitoring scans yet."
        )}
      </div>
      {cycle.trigger ? (
        <p className="mb-3 text-sm">
          Planned: <strong>{cycle.trigger.drug}</strong> on {formatDate(cycle.trigger.date)} at {cycle.trigger.time} →
          OCR {formatDate(shiftDate(cycle.trigger.date, cycle.trigger.time >= "12:00" ? 2 : 1))} morning.
        </p>
      ) : null}
      {editable ? (
        <Form {...form}>
          <form
            noValidate
            className="grid gap-3 sm:grid-cols-4 sm:items-end"
            onSubmit={form.handleSubmit((v) =>
              run(() => setTrigger(cycle.id, v), { success: "Trigger planned", setError: form.setError }),
            )}
          >
            <SelectField
              control={form.control}
              name="drug"
              label="Trigger drug"
              options={toOptions(TRIGGER_DRUGS)}
              required
              className="sm:col-span-2"
            />
            <DateField control={form.control} name="date" label="Date" required />
            <TimeField control={form.control} name="time" label="Time" required />
            <p className="text-muted-foreground text-xs sm:col-span-3">
              {t.date && t.time
                ? `OCR due ~${formatDate(shiftDate(t.date, t.time >= "12:00" ? 2 : 1))} 08:00–10:00 (34–36 h).`
                : ""}
            </p>
            <Button type="submit">{cycle.trigger ? "Update trigger" : "Plan trigger"}</Button>
          </form>
        </Form>
      ) : null}
    </SectionCard>
  );
}

const ocrForm = z
  .object({
    eggs: z.number({ error: "Required" }).int().nonnegative(),
    mii: z.number({ error: "Required" }).int().nonnegative(),
    fertilised: z.number({ error: "Required" }).int().nonnegative(),
  })
  .refine((o) => o.mii <= o.eggs, { message: "MII cannot exceed eggs retrieved", path: ["mii"] })
  .refine((o) => o.fertilised <= o.mii, { message: "Fertilised cannot exceed MII", path: ["fertilised"] });
type OcrForm = z.infer<typeof ocrForm>;

export function OcrPanel({ cycle, editable }: { cycle: Cycle; editable: boolean }) {
  const run = useRunAction();
  const setOcr = useCycleStore((s) => s.setOcr);
  const form = useZodForm<OcrForm>(ocrForm, cycle.ocr ?? {});
  const o = cycle.ocr;
  return (
    <SectionCard title="OCR summary" description="Oocytes retrieved, mature (MII) and fertilised (2PN).">
      {o ? (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[
            { l: "Eggs", v: o.eggs },
            { l: "MII", v: o.mii, s: `${percent(o.mii, o.eggs)}% maturity` },
            { l: "Fertilised", v: o.fertilised, s: `${percent(o.fertilised, o.mii)}% fertilisation` },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border p-3">
              <p className="text-2xl font-semibold tabular-nums">{x.v}</p>
              <p className="text-muted-foreground text-xs">{x.l}</p>
              {x.s ? <p className="text-primary text-xs">{x.s}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {editable && cycle.kind === "fresh" ? (
        <Form {...form}>
          <form
            noValidate
            className="grid grid-cols-3 items-end gap-3"
            onSubmit={form.handleSubmit((v) =>
              run(() => setOcr(cycle.id, v), { success: "OCR summary saved", setError: form.setError }),
            )}
          >
            <NumberField control={form.control} name="eggs" label="Eggs" step="1" min={0} required />
            <NumberField control={form.control} name="mii" label="MII" step="1" min={0} required />
            <NumberField control={form.control} name="fertilised" label="Fertilised" step="1" min={0} required />
            <Button type="submit" className="col-span-3 w-fit">
              Save OCR summary
            </Button>
          </form>
        </Form>
      ) : !o ? (
        <EmptyState title={cycle.kind === "frozen" ? "Not applicable to frozen cycles" : "No retrieval recorded"} />
      ) : null}
    </SectionCard>
  );
}

export function EmbryoListPanel({ embryos }: { embryos: Embryo[] }) {
  const sorted = [...embryos].sort((a, b) => gradeScore(b.grade) - gradeScore(a.grade));
  return (
    <SectionCard
      title="Embryos"
      description={`${embryos.length} total · ${embryos.filter((e) => e.day >= 5).length} blastocyst(s)`}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/embryology">
            <Microscope aria-hidden="true" /> Lab board
          </Link>
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState title="No embryos for this cycle" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <span>
                <span className="font-medium">{e.label}</span>{" "}
                <span className="text-muted-foreground">
                  D{e.day} · {e.stage}
                </span>
                {e.grade ? (
                  <Badge variant="secondary" className="ml-2">
                    {e.grade}
                  </Badge>
                ) : null}
                {e.pgtResult !== "not-tested" ? <StatusChip status={e.pgtResult} className="ml-2" /> : null}
              </span>
              <StatusChip status={e.status} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const transferForm = z.object({
  date: isoDate,
  embryoIds: z.array(z.string()).min(1, "Select at least one embryo").max(3, "No more than 3 embryos"),
});
type TransferForm = z.infer<typeof transferForm>;

export function TransferPanel({
  cycle,
  candidates,
  editable,
}: {
  cycle: Cycle;
  candidates: Embryo[];
  editable: boolean;
}) {
  const run = useRunAction();
  const setPlan = useCycleStore((s) => s.setTransferPlan);
  const form = useZodForm<TransferForm>(
    transferForm,
    cycle.transferPlan ?? { date: shiftDate(todayIso(), 1), embryoIds: [] },
  );
  const sorted = useMemo(() => [...candidates].sort((a, b) => gradeScore(b.grade) - gradeScore(a.grade)), [candidates]);
  return (
    <SectionCard
      title="Transfer planning"
      description="Select embryos from culture or cryo-storage (best grade first)."
    >
      {cycle.transferPlan ? (
        <p className="mb-3 text-sm">
          Planned for <strong>{formatDate(cycle.transferPlan.date)}</strong>: {cycle.transferPlan.embryoIds.length}{" "}
          embryo(s).
        </p>
      ) : null}
      {editable ? (
        sorted.length === 0 ? (
          <EmptyState
            title="No embryos available"
            description="Embryos in culture (D3+) or cryopreserved for this couple appear here."
          />
        ) : (
          <Form {...form}>
            <form
              noValidate
              className="grid gap-3"
              onSubmit={form.handleSubmit((v) =>
                run(() => setPlan(cycle.id, v), { success: "Transfer plan saved", setError: form.setError }),
              )}
            >
              <FormField
                control={form.control}
                name="embryoIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Embryos</FormLabel>
                    <FormControl>
                      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Embryos for transfer">
                        {sorted.map((e) => (
                          <Label
                            key={e.id}
                            className="hover:bg-accent flex items-center gap-2 rounded-md border p-2 font-normal"
                          >
                            <Checkbox
                              checked={field.value.includes(e.id)}
                              onCheckedChange={(c) =>
                                field.onChange(
                                  c === true ? [...field.value, e.id] : field.value.filter((x) => x !== e.id),
                                )
                              }
                            />
                            <span>
                              {e.label} · D{e.day} {e.grade ?? ""}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({e.status}
                                {e.pgtResult !== "not-tested" ? `, ${e.pgtResult}` : ""})
                              </span>
                            </span>
                          </Label>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end gap-3">
                <DateField control={form.control} name="date" label="Transfer date" required />
                <Button type="submit">Save plan</Button>
              </div>
            </form>
          </Form>
        )
      ) : null}
    </SectionCard>
  );
}

const lutealForm = z.object({ lutealSupport: z.string().trim().min(3, "Describe the regimen") });
type LutealForm = z.infer<typeof lutealForm>;

export function LutealPanel({ cycle, editable }: { cycle: Cycle; editable: boolean }) {
  const run = useRunAction();
  const setLuteal = useCycleStore((s) => s.setLuteal);
  const form = useZodForm<LutealForm>(lutealForm, { lutealSupport: cycle.lutealSupport ?? "" });
  return (
    <SectionCard title="Luteal support">
      {editable ? (
        <Form {...form}>
          <form
            noValidate
            className="grid gap-3"
            onSubmit={form.handleSubmit((v) =>
              run(() => setLuteal(cycle.id, v.lutealSupport), {
                success: "Luteal support saved",
                setError: form.setError,
              }),
            )}
          >
            <TextareaField
              control={form.control}
              name="lutealSupport"
              label="Regimen"
              rows={2}
              placeholder="Progesterone in oil 100 mg IM daily + vaginal gel"
              required
            />
            <Button type="submit" className="w-fit">
              Save
            </Button>
          </form>
        </Form>
      ) : (
        <p className="text-sm">{cycle.lutealSupport ?? "—"}</p>
      )}
    </SectionCard>
  );
}

const outcomeForm = z.object({
  outcome: CycleOutcome.exclude(["pending"]),
  betaValue: z.number().nonnegative().optional(),
  betaDate: isoDate.optional(),
});
type OutcomeForm = z.infer<typeof outcomeForm>;

export function OutcomePanel({ cycle, editable }: { cycle: Cycle; editable: boolean }) {
  const run = useRunAction();
  const record = useCycleStore((s) => s.recordOutcome);
  const form = useZodForm<OutcomeForm>(outcomeForm, { betaDate: cycle.betaHcg?.date, betaValue: cycle.betaHcg?.value });
  return (
    <SectionCard
      title="Pregnancy test & outcome"
      description={cycle.betaHcg?.date ? `Beta-hCG due ${formatDate(cycle.betaHcg.date)}` : undefined}
    >
      <p className="mb-3 flex items-center gap-2 text-sm">
        Current outcome: <StatusChip status={cycle.outcome} label={OUTCOME_LABELS[cycle.outcome]} />
        {cycle.betaHcg?.value !== undefined ? (
          <span className="text-muted-foreground">β-hCG {cycle.betaHcg.value} IU/L</span>
        ) : null}
      </p>
      {editable ? (
        <Form {...form}>
          <form
            noValidate
            className="grid gap-3 sm:grid-cols-3 sm:items-end"
            onSubmit={form.handleSubmit((v) =>
              run(() => record(cycle.id, v), {
                success: "Outcome recorded — cycle completed",
                setError: form.setError,
              }),
            )}
          >
            <DateField control={form.control} name="betaDate" label="β-hCG date" />
            <NumberField control={form.control} name="betaValue" label="β-hCG" suffix="IU/L" />
            <SelectField
              control={form.control}
              name="outcome"
              label="Outcome"
              required
              options={CycleOutcome.options
                .filter((o) => o !== "pending")
                .map((o) => ({ value: o, label: OUTCOME_LABELS[o] }))}
            />
            <Button type="submit" className="w-fit">
              Record outcome
            </Button>
          </form>
        </Form>
      ) : null}
    </SectionCard>
  );
}
