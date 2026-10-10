"use client";

import { FilePicker } from "@/components/shared/file-picker";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { AlertOctagon, Ban, Eye, FlaskConical, Paperclip, Plus, TestTube } from "lucide-react";
import { CheckboxField, NumberField, SelectField, TextareaField } from "@/components/forms/fields";
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
import { Label } from "@/components/ui/label";
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
import { LAB_CATALOG, RADIOLOGY_CATALOG, catalogItem } from "@/lib/constants/catalog";
import type { Order } from "@/lib/schemas/orders";
import { cancelOrder, placeOrder } from "@/lib/services/workflows";
import { useOrderStore } from "@/lib/stores/orders";
import { formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const orderSchema = z.object({
  catalogCode: z.string().min(1, "Choose a test"),
  qty: z.number({ error: "Enter a quantity" }).int().positive().max(10),
});
type OrderInput = z.infer<typeof orderSchema>;

const resultForm = z.object({
  resultText: z.string().trim().min(1, "Enter the result value or report"),
  abnormal: z.boolean(),
  critical: z.boolean(),
});
type ResultForm = z.infer<typeof resultForm>;

export function ResultDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const enter = useOrderStore((s) => s.enterResult);
  const [attachment, setAttachment] = useState<string | undefined>();
  const form = useZodForm<ResultForm>(resultForm, { resultText: "", abnormal: false, critical: false });
  const ref = order ? catalogItem(order.catalogCode)?.refRange : undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          form.reset();
          setAttachment(undefined);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter result — {order?.name}</DialogTitle>
          <DialogDescription>{ref ? `Reference range: ${ref}` : "Enter the value or report text."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (!order) return;
              if (
                run(() => enter(order.id, { ...v, resultAttachment: attachment }), {
                  success: v.critical ? "Critical result posted — doctor alerted" : "Result posted",
                  setError: form.setError,
                })
              )
                onOpenChange(false);
            })}
          >
            <TextareaField
              control={form.control}
              name="resultText"
              label="Result"
              rows={3}
              required
              placeholder="e.g. AMH 1.2 ng/mL"
            />
            <div className="flex flex-wrap gap-6">
              <CheckboxField control={form.control} name="abnormal" label="Abnormal" />
              <CheckboxField
                control={form.control}
                name="critical"
                label="Critical value"
                description="Raises an alert on the dashboard and bell."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="result-attachment">Attachment (mock upload)</Label>
              <FilePicker
                id="result-attachment"
                accept=".pdf,image/*"
                fileName={attachment}
                onChange={(f) => setAttachment(f?.name)}
                label="Attach report"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Post result</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function InvestigationsTab({ ctx }: { ctx: PatientCtx }) {
  const ep = ctx.episode;
  const can = useCan();
  const run = useRunAction();
  const { staffName } = useLookups();
  const orders = useOrderStore((s) => s.orders);
  const setInProgress = useOrderStore((s) => s.setInProgress);
  const [orderOpen, setOrderOpen] = useState(false);
  const [resultFor, setResultFor] = useState<Order | null>(null);
  const [viewing, setViewing] = useState<Order | null>(null);
  const form = useZodForm<OrderInput>(orderSchema, { catalogCode: "", qty: 1 });
  const rows = useMemo(
    () =>
      ep
        ? orders
            .filter((o) => o.episodeId === ep.id && (o.kind === "lab" || o.kind === "radiology"))
            .sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [orders, ep],
  );
  if (!ep) return <EmptyState title="No episode" description="Open an episode before ordering investigations." />;
  const critical = rows.filter((o) => o.critical && o.status === "resulted");
  const canOrder = can("orders.lab") && ep.status !== "closed";
  const canResult = can("results.enter");
  const code = form.watch("catalogCode");

  const columns: ColumnDef<Order, unknown>[] = [
    {
      accessorKey: "at",
      header: "Ordered",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { accessorKey: "kind", header: "Dept", cell: ({ row }) => (row.original.kind === "lab" ? "Lab" : "Radiology") },
    {
      accessorKey: "name",
      header: "Test",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "resultText",
      header: "Result",
      cell: ({ row }) =>
        row.original.resultText ? (
          <span
            className={
              row.original.critical
                ? "text-destructive font-semibold"
                : row.original.abnormal
                  ? "text-warning font-medium"
                  : ""
            }
          >
            {row.original.critical ? "⚠ " : ""}
            {row.original.resultText}
          </span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        ),
    },
    { id: "by", header: "Ordered by", accessorFn: (r) => staffName(r.orderedBy) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.status} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex justify-end gap-1">
            {o.status === "resulted" ? (
              <Button size="sm" variant="ghost" onClick={() => setViewing(o)}>
                <Eye aria-hidden="true" /> View
              </Button>
            ) : null}
            {canResult && o.status === "ordered" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run(() => setInProgress(o.id), { success: "Sample received" })}
              >
                <TestTube aria-hidden="true" /> Receive sample
              </Button>
            ) : null}
            {canResult && (o.status === "ordered" || o.status === "in-progress") ? (
              <Button size="sm" variant="outline" onClick={() => setResultFor(o)}>
                <FlaskConical aria-hidden="true" /> Enter result
              </Button>
            ) : null}
            {canOrder && (o.status === "ordered" || o.status === "in-progress") ? (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" aria-label={`Cancel ${o.name}`}>
                    <Ban />
                  </Button>
                }
                title={`Cancel ${o.name}?`}
                reasonLabel="Reason"
                confirmLabel="Cancel order"
                onConfirm={(reason) => {
                  run(() => cancelOrder(o.id, reason), { success: "Order cancelled and charge waived" });
                }}
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid gap-4">
      {critical.length > 0 ? (
        <Alert variant="destructive">
          <AlertOctagon aria-hidden="true" />
          <AlertTitle>Critical result{critical.length > 1 ? "s" : ""}</AlertTitle>
          <AlertDescription>{critical.map((c) => `${c.name}: ${c.resultText}`).join(" · ")}</AlertDescription>
        </Alert>
      ) : null}
      <SectionCard
        title="Investigations"
        description="Lab and radiology orders from the catalogue, with results."
        actions={
          canOrder ? (
            <Button size="sm" onClick={() => setOrderOpen(true)}>
              <Plus aria-hidden="true" /> Order investigation
            </Button>
          ) : null
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search tests…"
          exportName={`investigations-${ep.ivfNo}`}
          exportTitle={`Investigations ${ep.ivfNo}`}
          empty={
            <EmptyState
              title="No investigations yet"
              description="Order baseline tests such as AMH, FSH and the viral screen."
            />
          }
        />
      </SectionCard>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order investigation</DialogTitle>
            <DialogDescription>A charge is raised automatically at catalogue price.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                if (
                  run(() => placeOrder(ep.id, v), {
                    success: `Ordered ${catalogItem(v.catalogCode)?.name ?? ""}`,
                    setError: form.setError,
                  })
                ) {
                  form.reset();
                  setOrderOpen(false);
                }
              })}
            >
              <SelectField
                control={form.control}
                name="catalogCode"
                label="Test"
                required
                options={[...LAB_CATALOG, ...RADIOLOGY_CATALOG].map((c) => ({
                  value: c.code,
                  label: `${c.kind === "lab" ? "Lab" : "Radiology"} · ${c.name} — ${formatMoney(c.price)}`,
                }))}
              />
              <NumberField
                control={form.control}
                name="qty"
                label="Quantity"
                step="1"
                min={1}
                required
                description={
                  code ? `Total ${formatMoney((catalogItem(code)?.price ?? 0) * (form.watch("qty") || 0))}` : undefined
                }
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOrderOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Place order</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ResultDialog
        order={resultFor}
        open={resultFor !== null}
        onOpenChange={(o) => (!o ? setResultFor(null) : undefined)}
      />

      <Dialog open={viewing !== null} onOpenChange={(o) => (!o ? setViewing(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              Resulted {formatDateTime(viewing?.resultedAt)} ·{" "}
              {viewing ? (catalogItem(viewing.catalogCode)?.refRange ?? "") : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border p-3 text-sm whitespace-pre-line">{viewing?.resultText}</p>
          <div className="flex flex-wrap gap-2">
            {viewing?.critical ? (
              <StatusChip status="critical" />
            ) : viewing?.abnormal ? (
              <StatusChip status="abnormal" />
            ) : (
              <StatusChip status="normal" />
            )}
            {viewing?.resultAttachment ? (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <Paperclip className="size-3.5" aria-hidden="true" /> {viewing.resultAttachment}
              </span>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
