"use client";

import { useMemo } from "react";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { NumberField, SelectField, toOptions } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleLineChart } from "@/components/charts/lazy";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { humanize } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { VITAL_RANGES, vitalFlags, type VitalKey } from "@/lib/schemas/clinical";
import { useClinicalStore } from "@/lib/stores/clinical";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const vitalsForm = z.object({
  phase: z.enum(["pre-op", "post-op", "routine"]),
  pulse: z.number({ error: "Required" }).min(30, "30–220").max(220, "30–220"),
  resp: z.number({ error: "Required" }).min(6, "6–60").max(60, "6–60"),
  bpSys: z.number({ error: "Required" }).min(60, "60–260").max(260, "60–260"),
  bpDia: z.number({ error: "Required" }).min(30, "30–160").max(160, "30–160"),
  tempC: z.number({ error: "Required" }).min(34, "34–42").max(42, "34–42"),
  spo2: z.number({ error: "Required" }).min(70, "70–100").max(100, "70–100"),
});
type VitalsForm = z.infer<typeof vitalsForm>;

const FIELDS: VitalKey[] = ["pulse", "resp", "bpSys", "bpDia", "tempC", "spo2"];

export function VitalsTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const run = useRunAction();
  const canRecord = usePermission("vitals.record");
  const { staffName } = useLookups();
  const all = useClinicalStore((s) => s.vitals);
  const add = useClinicalStore((s) => s.addVitals);
  const rows = useMemo(
    () => (ep ? all.filter((v) => v.episodeId === ep.id).sort((a, b) => b.at.localeCompare(a.at)) : []),
    [all, ep],
  );
  const form = useZodForm<VitalsForm>(vitalsForm, { phase: "routine" });
  if (!ep) return <EmptyState title="No episode" description="Open an episode first." />;
  const values = form.watch();
  const live = FIELDS.filter(
    (k) => typeof values[k] === "number" && (values[k] < VITAL_RANGES[k].min || values[k] > VITAL_RANGES[k].max),
  );
  const trend = [...rows].reverse().map((v) => ({
    at: formatDateTime(v.at).slice(0, 5),
    pulse: v.pulse,
    bpSys: v.bpSys,
    bpDia: v.bpDia,
    spo2: v.spo2,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {canRecord && ep.status !== "closed" ? (
        <SectionCard title="Record vitals" className="lg:col-span-2">
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                if (
                  run(() => add(ep.id, v), {
                    success: vitalFlags(v).length ? "Vitals saved — out-of-range values flagged" : "Vitals saved",
                    setError: form.setError,
                  })
                )
                  form.reset({ phase: v.phase });
              })}
            >
              <SelectField
                control={form.control}
                name="phase"
                label="Phase"
                options={toOptions(["pre-op", "post-op", "routine"] as const, humanize)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map((k) => (
                  <NumberField
                    key={k}
                    control={form.control}
                    name={k}
                    label={VITAL_RANGES[k].label}
                    suffix={VITAL_RANGES[k].unit}
                    step={k === "tempC" ? "0.1" : "1"}
                    required
                  />
                ))}
              </div>
              {live.length > 0 ? (
                <p className="text-warning flex items-center gap-2 text-sm" role="status">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Out of range:{" "}
                  {live.map((k) => VITAL_RANGES[k].label).join(", ")}
                </p>
              ) : null}
              <Button type="submit">Save vitals</Button>
            </form>
          </Form>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Vitals history"
        description="Out-of-range values are highlighted and marked with ⚠."
        className={canRecord && ep.status !== "closed" ? "lg:col-span-3" : "lg:col-span-5"}
      >
        {rows.length === 0 ? (
          <EmptyState title="No vitals recorded" />
        ) : (
          <>
            <SimpleLineChart
              data={trend}
              xKey="at"
              height={200}
              series={[
                { key: "pulse", label: "Pulse" },
                { key: "bpSys", label: "Systolic" },
                { key: "bpDia", label: "Diastolic" },
                { key: "spo2", label: "SpO₂" },
              ]}
            />
            <div className="mt-4 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-right">Pulse</TableHead>
                    <TableHead className="text-right">Resp</TableHead>
                    <TableHead className="text-right">BP</TableHead>
                    <TableHead className="text-right">Temp</TableHead>
                    <TableHead className="text-right">SpO₂</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((v) => {
                    const flags = new Set(vitalFlags(v));
                    const cell = (k: VitalKey, text: string) => (
                      <TableCell
                        className={cn("text-right tabular-nums", flags.has(k) && "text-destructive font-semibold")}
                      >
                        {flags.has(k) ? "⚠ " : ""}
                        {text}
                        {flags.has(k) ? <span className="sr-only"> (out of range)</span> : null}
                      </TableCell>
                    );
                    return (
                      <TableRow key={v.id}>
                        <TableCell>{formatDateTime(v.at)}</TableCell>
                        <TableCell>{humanize(v.phase)}</TableCell>
                        {cell("pulse", String(v.pulse))}
                        {cell("resp", String(v.resp))}
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            (flags.has("bpSys") || flags.has("bpDia")) && "text-destructive font-semibold",
                          )}
                        >
                          {flags.has("bpSys") || flags.has("bpDia") ? "⚠ " : ""}
                          {v.bpSys}/{v.bpDia}
                        </TableCell>
                        {cell("tempC", `${v.tempC}°C`)}
                        {cell("spo2", `${v.spo2}%`)}
                        <TableCell className="text-muted-foreground text-xs">{staffName(v.postedBy)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
