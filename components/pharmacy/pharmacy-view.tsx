"use client";

import { DateRangeFields } from "@/components/shared/date-range-fields";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  PackagePlus,
  SlidersHorizontal,
} from "lucide-react";
import { NumberField, SelectField, TextField, DateField } from "@/components/forms/fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { DRUG_SEED, catalogItem } from "@/lib/constants/catalog";
import { isoDate } from "@/lib/schemas/common";
import type { Order, StockMovement } from "@/lib/schemas/orders";
import { fullName } from "@/lib/schemas/person";
import { isCancelledDrug } from "@/lib/selectors/predicates";
import { availableStock } from "@/lib/selectors/stock";
import { cancelOrder } from "@/lib/services/workflows";
import { useBillingStore } from "@/lib/stores/billing";
import { useWalletStore } from "@/lib/stores/wallet";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useOrderStore } from "@/lib/stores/orders";
import { useSessionStore } from "@/lib/stores/session";
import { formatDate, formatDateTime, shiftDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const receiveForm = z.object({
  code: z.string().min(1, "Choose a drug"),
  batchNo: z.string().trim().min(3, "Enter the batch number"),
  qty: z.number({ error: "Enter a quantity" }).int().positive("Quantity must be at least 1"),
  expiry: isoDate,
});
type ReceiveForm = z.infer<typeof receiveForm>;

const adjustForm = z.object({
  batchId: z.string().min(1, "Choose a batch"),
  delta: z
    .number({ error: "Enter the change (negative to reduce)" })
    .int()
    .refine((n) => n !== 0, "Change cannot be zero"),
  reason: z.string().trim().min(3, "Give a reason for the adjustment"),
});
type AdjustForm = z.infer<typeof adjustForm>;

interface QueueRow extends Order {
  patient: string;
  patientId: string;
  ivfNo: string;
  stock: number;
}

export function PharmacyView() {
  const router = useRouter();
  const params = useSearchParams();
  const run = useRunAction();
  const canDispense = usePermission("pharmacy.dispense");
  const canStock = usePermission("pharmacy.stock");
  const { person, staffName } = useLookups();
  const orders = useOrderStore((s) => s.orders);
  const batches = useOrderStore((s) => s.batches);
  const movements = useOrderStore((s) => s.movements);
  const dispense = useOrderStore((s) => s.dispense);
  const receive = useOrderStore((s) => s.receiveStock);
  const adjust = useOrderStore((s) => s.adjustStock);
  const episodes = useEpisodeStore((s) => s.episodes);
  const sessionBranch = useSessionStore((s) => s.branchId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const branch = params.get("branch") ?? sessionBranch;
  const tab = params.get("tab") ?? "queue";
  const today = todayIso();
  const rForm = useZodForm<ReceiveForm>(receiveForm, { code: "", batchNo: "", expiry: shiftDate(today, 365) });
  const aForm = useZodForm<AdjustForm>(adjustForm, { batchId: "", reason: "" });

  const epById = useMemo(() => new Map(episodes.map((e) => [e.id, e])), [episodes]);
  const charges = useBillingStore((s) => s.charges);
  const ledger = useWalletStore((s) => s.entries);
  const chargeByOrder = useMemo(
    () => new Map(charges.filter((c) => c.orderId).map((c) => [c.orderId as string, c])),
    [charges],
  );
  const accountPaidCharges = useMemo(() => new Set(ledger.flatMap((e) => e.chargeIds ?? [])), [ledger]);
  const inBranch = (o: Order) => {
    const ep = epById.get(o.episodeId);
    return branch === "all" || ep?.branchId === branch;
  };
  const enrich = (o: Order): QueueRow => {
    const ep = epById.get(o.episodeId);
    const p = person(ep?.patientId);
    return {
      ...o,
      patient: p ? fullName(p) : "—",
      patientId: p?.id ?? "",
      ivfNo: ep?.ivfNo ?? "—",
      stock: availableStock(batches, o.catalogCode, today),
    };
  };
  const queue = orders
    .filter((o) => o.kind === "pharmacy" && o.status === "ordered" && inBranch(o))
    .map(enrich)
    .sort((a, b) => a.at.localeCompare(b.at));
  const cancelled = orders
    .filter((o) => inBranch(o) && isCancelledDrug(o, { from: from || undefined, to: to || undefined }))
    .map(enrich)
    .sort((a, b) => b.at.localeCompare(a.at));

  const stockRows = DRUG_SEED.map((d) => {
    const bs = batches.filter((b) => b.code === d.code).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const avail = availableStock(batches, d.code, today);
    const expiring = bs.filter((b) => b.qty > 0 && b.expiry <= shiftDate(today, 60));
    return {
      ...d,
      batches: bs,
      avail,
      total: bs.reduce((s, b) => s + b.qty, 0),
      low: avail < d.reorderLevel,
      expiring,
    };
  });
  const lowCount = stockRows.filter((r) => r.low).length;
  const expCount = stockRows.reduce((s, r) => s + r.expiring.length, 0);

  const queueColumns: ColumnDef<QueueRow, unknown>[] = [
    {
      accessorKey: "at",
      header: "Prescribed",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => (
        <Link href={`/patients/${row.original.patientId}?tab=pharmacy`} className="font-medium hover:underline">
          {row.original.patient}
        </Link>
      ),
    },
    { accessorKey: "ivfNo", header: "IVF no" },
    { accessorKey: "name", header: "Drug" },
    { id: "sig", header: "Sig", accessorFn: (r) => `${r.dosage ?? ""} ${r.frequency ?? ""} × ${r.duration ?? ""}` },
    { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
    {
      accessorKey: "stock",
      header: "In stock",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className={cn(row.original.stock < row.original.qty && "text-destructive font-semibold")}>
          {row.original.stock}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    {
      id: "payment",
      header: "Payment",
      accessorFn: (r) => chargeByOrder.get(r.id)?.status ?? "unpaid",
      cell: ({ row }) => {
        const charge = chargeByOrder.get(row.original.id);
        if (!charge) return "—";
        const fromAccount = accountPaidCharges.has(charge.id) && charge.status === "paid";
        return (
          <StatusChip
            status={charge.status}
            label={
              fromAccount
                ? "Paid · account"
                : charge.status === "part-paid"
                  ? `Part-paid ${formatMoney(charge.paid)}`
                  : undefined
            }
          />
        );
      },
    },
    { id: "by", header: "Prescriber", accessorFn: (r) => staffName(r.orderedBy) },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) =>
        canDispense ? (
          <div className="flex justify-end gap-1">
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={row.original.stock < row.original.qty}>
                  <PackageCheck aria-hidden="true" /> Dispense
                </Button>
              }
              destructive={false}
              title={`Dispense ${row.original.name} × ${row.original.qty}?`}
              description={`Stock will reduce from ${row.original.stock} to ${row.original.stock - row.original.qty} (earliest-expiring batch first). ${
                chargeByOrder.get(row.original.id)?.status === "paid"
                  ? "Already paid."
                  : "Not fully paid yet — the charge is on the patient's bill and is deducted from their account as soon as funds arrive."
              }`}
              confirmLabel="Dispense"
              onConfirm={() => {
                run(() => dispense(row.original.id), {
                  success: `Dispensed ${row.original.name} to ${row.original.patient}`,
                });
              }}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost" aria-label={`Cancel ${row.original.name}`}>
                  <Ban />
                </Button>
              }
              title={`Cancel ${row.original.name}?`}
              reasonLabel="Reason"
              confirmLabel="Cancel prescription"
              onConfirm={(reason) => {
                run(() => cancelOrder(row.original.id, reason), { success: "Prescription cancelled" });
              }}
            />
          </div>
        ) : null,
    },
  ];

  const cancelledColumns: ColumnDef<QueueRow, unknown>[] = [
    {
      accessorKey: "at",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.at),
      meta: { exportValue: (r) => formatDate(r.at) },
    },
    { accessorKey: "patient", header: "Patient" },
    { accessorKey: "ivfNo", header: "IVF no" },
    { accessorKey: "name", header: "Drug" },
    { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
    {
      accessorKey: "amount",
      header: "Value",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    { accessorKey: "cancelReason", header: "Reason" },
    { id: "by", header: "Prescriber", accessorFn: (r) => staffName(r.orderedBy) },
  ];

  const moveRows = useMemo(() => [...movements].sort((a, b) => b.at.localeCompare(a.at)), [movements]);
  const moveColumns: ColumnDef<StockMovement, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { id: "drug", header: "Drug", accessorFn: (r) => catalogItem(r.code)?.name ?? r.code },
    { id: "batch", header: "Batch", accessorFn: (r) => batches.find((b) => b.id === r.batchId)?.batchNo ?? r.batchId },
    { accessorKey: "kind", header: "Type", cell: ({ row }) => humanize(row.original.kind) },
    {
      accessorKey: "delta",
      header: "Change",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className={row.original.delta < 0 ? "text-destructive" : "text-success"}>
          {row.original.delta > 0 ? `+${row.original.delta}` : row.original.delta}
        </span>
      ),
    },
    { accessorKey: "reason", header: "Reason" },
    { id: "by", header: "By", accessorFn: (r) => staffName(r.by) },
  ];

  return (
    <>
      <PageHeader
        title="Pharmacy"
        description="Dispense queue, stock by batch and expiry, and the cancelled-drugs report."
        crumbs={[{ label: "Clinical services" }, { label: "Pharmacy" }]}
        actions={
          canStock ? (
            <>
              <Button variant="outline" onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal aria-hidden="true" /> Adjust stock
              </Button>
              <Button onClick={() => setReceiveOpen(true)}>
                <PackagePlus aria-hidden="true" /> Receive stock
              </Button>
            </>
          ) : null
        }
      />
      {lowCount + expCount > 0 ? (
        <Alert className="mb-4">
          <AlertTriangle aria-hidden="true" className="text-warning" />
          <AlertTitle>
            {lowCount} drug(s) below reorder level · {expCount} batch(es) expired or expiring within 60 days
          </AlertTitle>
          <AlertDescription>Review the stock tab to reorder or quarantine affected batches.</AlertDescription>
        </Alert>
      ) : null}
      <Tabs value={tab} onValueChange={(v) => router.replace(`/pharmacy?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="queue">Dispense queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled drugs ({cancelled.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4">
          <SectionCard
            title="Pending prescriptions"
            description="Oldest first. Dispensing deducts stock from the earliest-expiring usable batch."
          >
            <DataTable
              data={queue}
              columns={queueColumns}
              searchPlaceholder="Search patient or drug…"
              exportName="dispense-queue"
              exportTitle="Dispense queue"
              empty={
                <EmptyState
                  icon={PackageCheck}
                  title="Queue is clear"
                  description="New prescriptions from doctors will appear here."
                />
              }
            />
          </SectionCard>
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <SectionCard
            title="Formulary stock"
            description="Available excludes expired batches. Click a row to see its batches."
          >
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-8">
                      <span className="sr-only">Expand</span>
                    </TableHead>
                    <TableHead>Drug</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder at</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((r) => {
                    const open = expanded.has(r.code);
                    return (
                      <Fragment key={r.code}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(r.code)) n.delete(r.code);
                              else n.add(r.code);
                              return n;
                            })
                          }
                        >
                          <TableCell>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${open ? "Hide" : "Show"} batches for ${r.name}`}
                            >
                              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(r.price)}</TableCell>
                          <TableCell
                            className={cn("text-right tabular-nums", r.low && "text-destructive font-semibold")}
                          >
                            {r.avail}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.reorderLevel}</TableCell>
                          <TableCell className="flex flex-wrap gap-1">
                            {r.low ? (
                              <StatusChip status="critical" label="Low stock" />
                            ) : (
                              <StatusChip status="approved" label="OK" />
                            )}
                            {r.expiring.length > 0 ? (
                              <StatusChip status="expiring" label={`${r.expiring.length} batch expiring`} />
                            ) : null}
                          </TableCell>
                        </TableRow>
                        {open
                          ? r.batches.map((b) => (
                              <TableRow key={b.id} className="bg-muted/30">
                                <TableCell />
                                <TableCell className="pl-6 text-xs">Batch {b.batchNo}</TableCell>
                                <TableCell className="text-xs">Received {formatDate(b.receivedAt)}</TableCell>
                                <TableCell />
                                <TableCell className="text-right text-xs tabular-nums">{b.qty}</TableCell>
                                <TableCell className="text-xs">Expires {formatDate(b.expiry)}</TableCell>
                                <TableCell>
                                  {b.expiry < today ? (
                                    <StatusChip status="expired" label="Expired" />
                                  ) : b.expiry <= shiftDate(today, 60) ? (
                                    <StatusChip status="expiring" label="≤60 days" />
                                  ) : (
                                    <StatusChip status="signed" label="In date" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <SectionCard title="Stock movements">
            <DataTable
              data={moveRows}
              columns={moveColumns}
              searchPlaceholder="Search drug, reason…"
              exportName="stock-movements"
              exportTitle="Stock movements"
            />
          </SectionCard>
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4">
          <SectionCard
            title="Cancelled drugs report"
            description={`Branch: ${branch === "all" ? "all branches" : branch}`}
          >
            <DataTable
              data={cancelled}
              columns={cancelledColumns}
              searchPlaceholder="Search drug, reason…"
              exportName="cancelled-drugs"
              exportTitle="Cancelled drugs report"
              toolbar={
                <div className="flex items-end gap-2">
                  <DateRangeFields idPrefix="cx" from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
                </div>
              }
              empty={<EmptyState title="No cancelled drugs in this range" />}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>Creates a new batch with its expiry date.</DialogDescription>
          </DialogHeader>
          <Form {...rForm}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={rForm.handleSubmit((v) => {
                if (
                  run(() => receive(v), {
                    success: `Received ${v.qty} × ${catalogItem(v.code)?.name ?? ""}`,
                    setError: rForm.setError,
                  })
                ) {
                  rForm.reset();
                  setReceiveOpen(false);
                }
              })}
            >
              <SelectField
                control={rForm.control}
                name="code"
                label="Drug"
                required
                options={DRUG_SEED.map((d) => ({ value: d.code, label: d.name }))}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField control={rForm.control} name="batchNo" label="Batch no" required />
                <NumberField control={rForm.control} name="qty" label="Quantity" step="1" min={1} required />
                <DateField control={rForm.control} name="expiry" label="Expiry" required />
              </div>
              <DialogFooter>
                <Button type="submit">Receive</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              Use a negative number to remove units (breakage, expiry write-off, count variance).
            </DialogDescription>
          </DialogHeader>
          <Form {...aForm}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={aForm.handleSubmit((v) => {
                const ok = run(
                  () => {
                    adjust(v);
                    return true;
                  },
                  { success: "Stock adjusted", setError: aForm.setError },
                );
                if (ok) {
                  aForm.reset();
                  setAdjustOpen(false);
                }
              })}
            >
              <SelectField
                control={aForm.control}
                name="batchId"
                label="Batch"
                required
                options={batches.map((b) => ({
                  value: b.id,
                  label: `${catalogItem(b.code)?.name ?? b.code} · ${b.batchNo} · ${b.qty} left · exp ${formatDate(b.expiry)}`,
                }))}
              />
              <NumberField control={aForm.control} name="delta" label="Change" step="1" required />
              <TextField
                control={aForm.control}
                name="reason"
                label="Reason"
                required
                placeholder="e.g. Expired batch written off"
              />
              <DialogFooter>
                <Button type="submit">Save adjustment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
