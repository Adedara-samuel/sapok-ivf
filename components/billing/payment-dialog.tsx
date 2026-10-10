"use client";

import { z } from "zod";
import { NumberField, SelectField, TextField, toOptions } from "@/components/forms/fields";
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
import { humanize } from "@/components/shared/status-chip";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { PaymentMethod, type Payment } from "@/lib/schemas/billing";
import { requestRefund } from "@/lib/services/workflows";
import { useBillingStore } from "@/lib/stores/billing";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatMoney } from "@/lib/utils/money";

const payForm = z
  .object({
    amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero"),
    method: PaymentMethod,
    reference: z.string().optional(),
  })
  .refine((v) => !(v.method === "transfer" || v.method === "pos") || (v.reference ?? "").trim().length >= 4, {
    message: "Enter the transfer/POS reference",
    path: ["reference"],
  });
type PayForm = z.infer<typeof payForm>;

export function PaymentDialog({
  episodeId,
  balance,
  open,
  onOpenChange,
  onPaid,
}: {
  episodeId: string;
  balance: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid?: (p: Payment) => void;
}) {
  const run = useRunAction();
  const record = useBillingStore((s) => s.recordPayment);
  const prefix = useSettingsStore((s) => s.clinic.receiptPrefix);
  const form = useZodForm<PayForm>(payForm, { method: "cash", reference: "" });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: <strong className="tabular-nums">{formatMoney(Math.max(0, balance))}</strong>.
            Part-payments and deposits are allowed; excess becomes account credit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const p = run(() => record(episodeId, v, prefix), {
                success: (r) => `Payment recorded — receipt ${r.receiptNo}`,
                setError: form.setError,
              });
              if (p) {
                form.reset();
                onOpenChange(false);
                onPaid?.(p);
              }
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField control={form.control} name="amount" label="Amount (₦)" step="100" min={1} required />
              <SelectField
                control={form.control}
                name="method"
                label="Method"
                options={toOptions(PaymentMethod.options, (m) =>
                  m === "pos" ? "POS" : m === "hmo" ? "HMO" : humanize(m),
                )}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {balance > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue("amount", balance, { shouldValidate: true })}
                >
                  Pay full balance
                </Button>
              ) : null}
              {balance > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue("amount", Math.round(balance / 2 / 100) * 100, { shouldValidate: true })}
                >
                  Pay half
                </Button>
              ) : null}
            </div>
            <TextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder="Transfer ref, POS slip or HMO authorisation"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Record payment</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const refundForm = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero"),
  reason: z.string().trim().min(5, "Explain the refund (at least 5 characters)"),
});
type RefundForm = z.infer<typeof refundForm>;

export function RefundDialog({
  episodeId,
  refundable,
  open,
  onOpenChange,
}: {
  episodeId: string;
  refundable: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const form = useZodForm<RefundForm>(refundForm, { reason: "" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request refund</DialogTitle>
          <DialogDescription>
            Refunds need manager approval. Up to {formatMoney(Math.max(0, refundable))} can be refunded on this account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (
                run(() => requestRefund(episodeId, v), {
                  success: "Refund request sent for approval",
                  setError: form.setError,
                })
              ) {
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <NumberField control={form.control} name="amount" label="Amount (₦)" step="100" min={1} required />
            <TextField
              control={form.control}
              name="reason"
              label="Reason"
              required
              placeholder="e.g. Cycle cancelled before stimulation drugs dispensed"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit for approval</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
