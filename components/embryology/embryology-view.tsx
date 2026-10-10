"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Plus } from "lucide-react";
import { NumberField, SelectField, TextField, TextareaField } from "@/components/forms/fields";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CryoMap } from "@/components/embryology/cryo-map";
import { LabBoard } from "@/components/embryology/lab-board";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { humanize } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { CultureLog, CustodyEvent, Embryo } from "@/lib/schemas/embryology";
import type { Cycle } from "@/lib/schemas/cycle";
import { fullName } from "@/lib/schemas/person";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

export interface CycleInfo {
  cycle: Cycle;
  patientId: string;
  patientName: string;
  ivfNo: string;
  source: Embryo["source"];
}

const logForm = z.object({
  cycleId: z.string().min(1, "Choose the cycle"),
  day: z.number({ error: "Enter the day" }).int().min(0).max(7),
  incubator: z.string().trim().min(2, "Enter the incubator"),
  note: z.string().trim().min(3, "Write at least 3 characters"),
});
type LogForm = z.infer<typeof logForm>;

export function EmbryologyView() {
  const router = useRouter();
  const params = useSearchParams();
  const run = useRunAction();
  const canManage = usePermission("embryology.manage");
  const cycles = useCycleStore((s) => s.cycles);
  const episodes = useEpisodeStore((s) => s.episodes);
  const embryos = useEmbryologyStore((s) => s.embryos);
  const cultureLogs = useEmbryologyStore((s) => s.cultureLogs);
  const custody = useEmbryologyStore((s) => s.custody);
  const addLog = useEmbryologyStore((s) => s.addCultureLog);
  const { person, staffName } = useLookups();
  const [logOpen, setLogOpen] = useState(false);
  const tab = params.get("tab") ?? "board";
  const form = useZodForm<LogForm>(logForm, { cycleId: "", incubator: "Incubator A (Geri 1)", note: "" });

  const cycleInfo = useMemo(() => {
    const map = new Map<string, CycleInfo>();
    cycles.forEach((c) => {
      const ep = episodes.find((e) => e.id === c.episodeId);
      const p = person(ep?.patientId);
      if (ep && p)
        map.set(c.id, {
          cycle: c,
          patientId: p.id,
          patientName: fullName(p),
          ivfNo: ep.ivfNo,
          source: ep.type === "DONOR-OOCYTE" ? "donor-oocyte" : ep.type === "DONOR-SPERM" ? "donor-sperm" : "own",
        });
    });
    return map;
  }, [cycles, episodes, person]);

  const cultureCycles = [...cycleInfo.values()].filter((c) =>
    embryos.some((e) => e.cycleId === c.cycle.id && (e.status === "culturing" || e.status === "thawed")),
  );
  const embryoLabel = (id: string) => {
    const e = embryos.find((x) => x.id === id);
    const info = e ? cycleInfo.get(e.cycleId) : undefined;
    return e ? `${info?.ivfNo ?? ""} ${e.label}` : id;
  };

  const logRows = useMemo(
    () => [...cultureLogs].sort((a, b) => b.date.localeCompare(a.date) || b.day - a.day),
    [cultureLogs],
  );
  const custodyRows = useMemo(() => [...custody].sort((a, b) => b.at.localeCompare(a.at)), [custody]);

  const logColumns: ColumnDef<CultureLog, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => formatDate(row.original.date) },
    {
      id: "patient",
      header: "Patient",
      accessorFn: (r) => {
        const i = cycleInfo.get(r.cycleId);
        return i ? `${i.patientName} · ${i.ivfNo}` : "—";
      },
    },
    { accessorKey: "day", header: "Day", cell: ({ row }) => `D${row.original.day}` },
    { accessorKey: "incubator", header: "Incubator" },
    { accessorKey: "note", header: "Observation" },
    { id: "by", header: "Embryologist", accessorFn: (r) => staffName(r.by) },
  ];
  const custodyColumns: ColumnDef<CustodyEvent, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { id: "item", header: "Item", accessorFn: (r) => embryoLabel(r.itemId) },
    { accessorKey: "action", header: "Action", cell: ({ row }) => humanize(row.original.action) },
    { accessorKey: "detail", header: "Detail" },
    { id: "by", header: "Performed by", accessorFn: (r) => staffName(r.by) },
    { id: "witness", header: "Witness", accessorFn: (r) => staffName(r.witnessId) },
  ];

  return (
    <>
      <PageHeader
        title="Embryology lab"
        description="Daily culture board, grading, witnessed status moves and cryo-storage."
        crumbs={[{ label: "Clinical services" }, { label: "Embryology lab" }]}
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/embryology?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="board">Daily board</TabsTrigger>
          <TabsTrigger value="cryo">Cryo map</TabsTrigger>
          <TabsTrigger value="culture">Culture log</TabsTrigger>
          <TabsTrigger value="custody">Chain of custody</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="mt-4">
          <LabBoard cycleInfo={cycleInfo} canManage={canManage} />
        </TabsContent>
        <TabsContent value="cryo" className="mt-4">
          <CryoMap canManage={canManage} initialQuery={params.get("q") ?? undefined} />
        </TabsContent>
        <TabsContent value="culture" className="mt-4">
          <SectionCard
            title="Daily culture log"
            actions={
              canManage ? (
                <Button size="sm" onClick={() => setLogOpen(true)}>
                  <Plus aria-hidden="true" /> Add log entry
                </Button>
              ) : null
            }
          >
            <DataTable
              data={logRows}
              columns={logColumns}
              searchPlaceholder="Search patient, note…"
              exportName="culture-log"
              exportTitle="Culture log"
            />
          </SectionCard>
        </TabsContent>
        <TabsContent value="custody" className="mt-4">
          <SectionCard
            title="Chain of custody"
            description="Every grading, storage, move, warm, transfer and discard with its witness."
          >
            <DataTable
              data={custodyRows}
              columns={custodyColumns}
              searchPlaceholder="Search item, action…"
              exportName="chain-of-custody"
              exportTitle="Chain of custody"
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Culture log entry</DialogTitle>
            <DialogDescription>Recorded against today&apos;s date.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                if (run(() => addLog(v.cycleId, v), { success: "Culture log saved", setError: form.setError })) {
                  form.reset();
                  setLogOpen(false);
                }
              })}
            >
              <SelectField
                control={form.control}
                name="cycleId"
                label="Patient / cycle"
                required
                options={cultureCycles.map((c) => ({
                  value: c.cycle.id,
                  label: `${c.patientName} · ${c.ivfNo} · cycle ${c.cycle.number}`,
                }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField control={form.control} name="day" label="Culture day" step="1" min={0} max={7} required />
                <TextField control={form.control} name="incubator" label="Incubator" required />
              </div>
              <TextareaField control={form.control} name="note" label="Observation" rows={3} required />
              <DialogFooter>
                <Button type="submit">Save entry</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
