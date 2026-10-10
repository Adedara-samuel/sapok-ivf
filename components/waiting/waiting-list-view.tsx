"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { ChevronDown, Clock, Plus, Stethoscope, UserPlus } from "lucide-react";
import { SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonPicker } from "@/components/shared/person-picker";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { useNow } from "@/hooks/use-now";
import { Can, usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { APP_CONFIG } from "@/lib/config";
import type { WaitingEntry, WaitingStatus } from "@/lib/schemas/admin";
import { fullName } from "@/lib/schemas/person";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useSessionStore } from "@/lib/stores/session";
import { allowedTransitions, useWaitingStore } from "@/lib/stores/waiting";
import { formatDate, shiftDate, todayIso } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const addSchema = z.object({
  personId: z.string().min(1, "Choose a patient"),
  doctorId: z.string().min(1, "Choose the doctor"),
  purpose: z.string().min(3, "Enter the purpose of the visit"),
});
type AddInput = z.infer<typeof addSchema>;

interface Row extends WaitingEntry {
  name: string;
  prn: string;
  doctor: string;
}

function WaitBadge({ entry, now }: { entry: WaitingEntry; now: number }) {
  const end = entry.calledAt
    ? Date.parse(entry.calledAt)
    : entry.status === "no-show"
      ? Date.parse(entry.arrivedAt)
      : now;
  const mins = Math.max(0, Math.round((end - Date.parse(entry.arrivedAt)) / 60_000));
  const live = !entry.calledAt && entry.status === "waiting";
  const over = mins > APP_CONFIG.waitingTargetMinutes;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm tabular-nums",
        over && live ? "text-destructive font-semibold" : over ? "text-warning" : "text-muted-foreground",
      )}
    >
      <Clock className="size-3.5" aria-hidden="true" />
      {mins} min{live ? <span className="sr-only"> and counting</span> : null}
      {live ? <span className="bg-success size-1.5 animate-pulse rounded-full" aria-hidden="true" /> : null}
    </span>
  );
}

export function WaitingListView() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow(15_000);
  const run = useRunAction();
  const entries = useWaitingStore((s) => s.entries);
  const add = useWaitingStore((s) => s.add);
  const setStatus = useWaitingStore((s) => s.setStatus);
  const episodes = useEpisodeStore((s) => s.episodes);
  const branchId = useSessionStore((s) => s.branchId);
  const { person, staffName, staff } = useLookups();
  const canManage = usePermission("waiting.manage");
  const [open, setOpen] = useState(() => params.get("add") === "1" && canManage);
  const today = todayIso();
  const scope = params.get("branch") ?? branchId;
  const form = useZodForm<AddInput>(addSchema, { personId: "", doctorId: "", purpose: "" });

  const { todayRows, noShows } = useMemo(() => {
    const inScope = (e: WaitingEntry) => scope === "all" || e.branchId === scope;
    const toRow = (e: WaitingEntry): Row => {
      const p = person(e.personId);
      return { ...e, name: p ? fullName(p) : "Unknown", prn: p?.prn ?? "—", doctor: staffName(e.doctorId) };
    };
    return {
      todayRows: entries
        .filter((e) => e.date === today && inScope(e))
        .map(toRow)
        .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt)),
      noShows: entries
        .filter((e) => e.date === shiftDate(today, -1) && e.status === "no-show" && inScope(e))
        .map(toRow),
    };
  }, [entries, today, scope, person, staffName]);

  const counts = (["waiting", "called", "in-consultation", "completed", "no-show"] as WaitingStatus[]).map((s) => ({
    s,
    n: todayRows.filter((r) => r.status === s).length,
  }));

  const startConsultation = (row: Row) => {
    const res = run(
      () =>
        row.status === "waiting"
          ? setStatus(setStatus(row.id, "called").id, "in-consultation")
          : setStatus(row.id, "in-consultation"),
      { success: `Consultation started for ${row.name}` },
    );
    if (res) router.push(`/patients/${row.personId}`);
  };

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "time", header: "Visit time", meta: { label: "Visit time" } },
    { accessorKey: "prn", header: "PRN", meta: { label: "PRN" } },
    {
      accessorKey: "name",
      header: "Full name",
      cell: ({ row }) => (
        <Link href={`/patients/${row.original.personId}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "doctor", header: "Doctor" },
    { accessorKey: "purpose", header: "Purpose" },
    {
      id: "wait",
      header: "Wait",
      enableSorting: false,
      cell: ({ row }) => <WaitBadge entry={row.original} now={now} />,
      meta: {
        exportValue: (r) =>
          r.calledAt ? Math.round((Date.parse(r.calledAt) - Date.parse(r.arrivedAt)) / 60000) : "waiting",
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.status} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        const next = allowedTransitions(r.status);
        if (!canManage) return null;
        return (
          <div className="flex justify-end gap-2">
            {r.status === "waiting" || r.status === "called" ? (
              <Button size="sm" onClick={() => startConsultation(r)}>
                <Stethoscope aria-hidden="true" /> Start consultation
              </Button>
            ) : null}
            {next.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" aria-label={`Change status for ${r.name}`}>
                    Status <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {next.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onSelect={() => run(() => setStatus(r.id, s), { success: `${r.name}: ${humanize(s)}` })}
                    >
                      {humanize(s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        );
      },
    },
  ];

  const onAdd = (values: AddInput) => {
    const ep = episodes.find((e) => e.patientId === values.personId && e.status !== "closed");
    const res = run(() => add({ ...values, episodeId: ep?.id, branchId }), {
      success: "Added to today's waiting list",
      setError: form.setError,
    });
    if (res) {
      setOpen(false);
      form.reset();
    }
  };

  const doctors = staff.filter((s) => s.role === "doctor" && s.active).map((s) => ({ value: s.id, label: s.name }));

  return (
    <>
      <PageHeader
        title="Waiting list"
        description={`Today's visits · ${formatDate(today)}`}
        crumbs={[{ label: "Front office" }, { label: "Waiting list" }]}
        actions={
          <Can capability="waiting.manage">
            <Button variant="outline" asChild>
              <Link href="/patients/new?from=waiting">
                <UserPlus aria-hidden="true" /> Register new
              </Link>
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> Add patient to list
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Status summary">
        {counts.map(({ s, n }) => (
          <span key={s} className="flex items-center gap-2">
            <StatusChip status={s} label={`${humanize(s)}: ${n}`} />
          </span>
        ))}
      </div>

      <SectionCard
        title="Today"
        description="Search by full name. Wait time counts from arrival until the patient is called."
      >
        <DataTable
          data={todayRows}
          columns={columns}
          searchPlaceholder="Search by full name…"
          exportName={`waiting-list-${today}`}
          exportTitle="Waiting list"
          empty={
            <EmptyState
              title="No data found for today"
              description="No patient has been added to today's waiting list yet."
              action={
                canManage ? (
                  <Button onClick={() => setOpen(true)}>
                    <Plus aria-hidden="true" /> Add patient
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </SectionCard>

      {noShows.length > 0 ? (
        <SectionCard title="Yesterday's no-shows" description="Follow up and rebook." className="mt-4">
          <ul className="grid gap-2">
            {noShows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <span>
                  <Link href={`/patients/${r.personId}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    · {r.prn} · {r.purpose} with {r.doctor}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusChip status="no-show" />
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          () =>
                            add({
                              personId: r.personId,
                              episodeId: r.episodeId,
                              doctorId: r.doctorId,
                              purpose: r.purpose,
                              branchId,
                            }),
                          { success: `${r.name} added to today's list` },
                        )
                      }
                    >
                      Add to today
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add patient to today&apos;s list</DialogTitle>
            <DialogDescription>Select an existing patient. New patients must be registered first.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAdd)} className="grid gap-4" noValidate>
              <FormField
                control={form.control}
                name="personId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <FormControl>
                      <PersonPicker
                        value={field.value}
                        invalid={Boolean(fieldState.error)}
                        onChange={(p) => {
                          field.onChange(p.id);
                          const ep = episodes.find((e) => e.patientId === p.id && e.status !== "closed");
                          if (ep && !form.getValues("doctorId"))
                            form.setValue("doctorId", ep.doctorId, { shouldValidate: true });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SelectField control={form.control} name="doctorId" label="Doctor" options={doctors} required />
              <TextField
                control={form.control}
                name="purpose"
                label="Purpose of visit"
                placeholder="e.g. Follicular scan"
                required
              />
              <DialogFooter>
                <Button type="button" variant="outline" asChild>
                  <Link href="/patients/new?from=waiting">Register new patient</Link>
                </Button>
                <Button type="submit">Add to list</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
