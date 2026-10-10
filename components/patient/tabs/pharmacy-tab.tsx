"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Ban, Pill, Plus, Syringe } from "lucide-react";
import { NumberField, SelectField, TextField } from "@/components/forms/fields";
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
import { StimulationForm } from "@/components/cycle/stimulation-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import type { PatientCtx } from "@/components/patient/types";
import { useLookups } from "@/hooks/use-lookups";
import { useCan } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { DRUG_CATALOG, catalogItem } from "@/lib/constants/catalog";
import { isActiveCycle } from "@/lib/schemas/cycle";
import type { Order } from "@/lib/schemas/orders";
import { availableStock } from "@/lib/selectors/stock";
import { cancelOrder, placeOrder } from "@/lib/services/workflows";
import { useCycleStore } from "@/lib/stores/cycle";
import { useOrderStore } from "@/lib/stores/orders";
import { formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const rxSchema = z.object({
  catalogCode: z.string().min(1, "Choose a drug"),
  dosage: z.string().trim().min(1, "Enter the dosage, e.g. 225 IU SC"),
  frequency: z.string().trim().min(1, "Enter the frequency, e.g. nocte"),
  duration: z.string().trim().min(1, "Enter the duration, e.g. 5 days"),
  qty: z
    .number({ error: "Enter a quantity" })
    .int("Whole numbers only")
    .positive("Quantity must be at least 1")
    .max(200),
});
type RxInput = z.infer<typeof rxSchema>;

export function PrescriptionDialog({
  episodeId,
  open,
  onOpenChange,
}: {
  episodeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const batches = useOrderStore((s) => s.batches);
  const form = useZodForm<RxInput>(rxSchema, { catalogCode: "", dosage: "", frequency: "", duration: "", qty: 1 });
  const code = form.watch("catalogCode");
  const qty = form.watch("qty");
  const item = catalogItem(code);
  const stock = code ? availableStock(batches, code) : 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add pharmacy item</DialogTitle>
          <DialogDescription>
            Prescriptions go to the pharmacy dispense queue and are charged to the patient&apos;s account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(() => placeOrder(episodeId, v), {
                  success: `Prescribed ${catalogItem(v.catalogCode)?.name ?? ""}`,
                  setError: form.setError,
                })
              ) {
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <SelectField
              control={form.control}
              name="catalogCode"
              label="Drug"
              required
              options={DRUG_CATALOG.map((d) => ({
                value: d.code,
                label: `${d.name} — ${formatMoney(d.price)}/${d.unit}`,
              }))}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField control={form.control} name="dosage" label="Dosage" placeholder="225 IU SC" required />
              <TextField control={form.control} name="frequency" label="Frequency" placeholder="nocte" required />
              <TextField control={form.control} name="duration" label="Duration" placeholder="5 days" required />
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="qty"
                label="Quantity"
                step="1"
                min={1}
                required
                description={item ? `${stock} ${item.unit ?? "units"} in stock` : undefined}
              />
              <div className="bg-muted rounded-lg p-3 text-sm" aria-live="polite">
                <span className="text-muted-foreground block text-xs">Amount</span>
                <span className="text-lg font-semibold tabular-nums">
                  {item && qty ? formatMoney(item.price * qty) : "—"}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Pill aria-hidden="true" /> Prescribe
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function PharmacyTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const can = useCan();
  const run = useRunAction();
  const { staffName } = useLookups();
  const orders = useOrderStore((s) => s.orders);
  const cycles = useCycleStore((s) => s.cycles);
  const [rxOpen, setRxOpen] = useState(false);
  const [stimOpen, setStimOpen] = useState(false);
  const rows = useMemo(
    () =>
      ep
        ? orders.filter((o) => o.episodeId === ep.id && o.kind === "pharmacy").sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [orders, ep],
  );
  const activeCycle = ep
    ? cycles.filter((c) => c.episodeId === ep.id && isActiveCycle(c)).sort((a, b) => b.number - a.number)[0]
    : undefined;
  if (!ep) return <EmptyState title="No episode" description="Open an episode before prescribing." />;
  const editable = ep.status !== "closed" && can("orders.pharmacy");

  const columns: ColumnDef<Order, unknown>[] = [
    {
      accessorKey: "at",
      header: "Date",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    {
      accessorKey: "name",
      header: "Drug",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "sig",
      header: "Dosage · frequency · duration",
      accessorFn: (r) => `${r.dosage ?? ""} ${r.frequency ?? ""} ${r.duration ?? ""}`,
    },
    { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatMoney(row.original.amount),
      meta: { align: "right" },
    },
    { id: "by", header: "Prescriber", accessorFn: (r) => staffName(r.orderedBy) },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="flex flex-col gap-0.5">
          <StatusChip status={row.original.status} />
          {row.original.cancelReason ? (
            <span className="text-muted-foreground text-xs">{row.original.cancelReason}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) =>
        editable && row.original.status === "ordered" ? (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                <Ban aria-hidden="true" /> Cancel
              </Button>
            }
            title={`Cancel ${row.original.name}?`}
            description="The charge will be waived. The cancellation appears in the cancelled-drugs report."
            reasonLabel="Reason for cancelling"
            confirmLabel="Cancel prescription"
            onConfirm={(reason) => {
              run(() => cancelOrder(row.original.id, reason), { success: "Prescription cancelled" });
            }}
          />
        ) : null,
    },
  ];

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Prescriptions & pharmacy"
        description="Ordered → dispensed by pharmacy, or cancelled with a reason."
        actions={
          editable ? (
            <>
              {activeCycle ? (
                <Button variant="outline" size="sm" onClick={() => setStimOpen(true)}>
                  <Syringe aria-hidden="true" /> Stimulation prescription note
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setRxOpen(true)}>
                <Plus aria-hidden="true" /> Add pharmacy item
              </Button>
            </>
          ) : null
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search drugs…"
          exportName={`prescriptions-${ep.ivfNo}`}
          exportTitle={`Prescriptions ${ep.ivfNo}`}
          empty={
            <EmptyState
              title="No prescriptions yet"
              description="Add a pharmacy item to send it to the dispense queue."
            />
          }
        />
      </SectionCard>
      <PrescriptionDialog episodeId={ep.id} open={rxOpen} onOpenChange={setRxOpen} />
      {activeCycle ? (
        <Dialog open={stimOpen} onOpenChange={setStimOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Stimulation prescription note — cycle {activeCycle.number}</DialogTitle>
              <DialogDescription>
                Injection, dosage, scan day, findings and remark. Posts to the cycle monitoring table.
              </DialogDescription>
            </DialogHeader>
            <StimulationForm cycleId={activeCycle.id} onDone={() => setStimOpen(false)} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
