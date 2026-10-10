"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptPrint, StatementPrint } from "@/components/billing/billing-prints";
import { PaymentDialog, RefundDialog } from "@/components/billing/payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import type { PrintIdentifier } from "@/components/print/print-sheet";
import { useCan } from "@/hooks/use-permission";
import { accountSummary, useBillingStore } from "@/lib/stores/billing";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

function Figure({ label, value, tone }: { label: string; value: number; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

/** Full account view for one episode: summary, charges, payments, refunds and actions. */
export function AccountPanel({
  episodeId,
  identifiers,
  branchId,
  readOnly = false,
}: {
  episodeId: string;
  identifiers: PrintIdentifier[];
  branchId: string;
  readOnly?: boolean;
}) {
  const can = useCan();
  const allCharges = useBillingStore((s) => s.charges);
  const allPayments = useBillingStore((s) => s.payments);
  const allRefunds = useBillingStore((s) => s.refunds);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const charges = useMemo(
    () => allCharges.filter((c) => c.episodeId === episodeId).sort((a, b) => b.at.localeCompare(a.at)),
    [allCharges, episodeId],
  );
  const payments = useMemo(
    () => allPayments.filter((p) => p.episodeId === episodeId).sort((a, b) => b.at.localeCompare(a.at)),
    [allPayments, episodeId],
  );
  const refunds = useMemo(() => allRefunds.filter((r) => r.episodeId === episodeId), [allRefunds, episodeId]);
  const summary = accountSummary(episodeId, allCharges, allPayments, allRefunds);
  const pendingRefunds = refunds.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  // balance immediately after each payment, for receipts
  const balanceAfter = (paymentAt: string) => {
    const charged = charges.filter((c) => c.status !== "waived" && c.at <= paymentAt).reduce((s, c) => s + c.amount, 0);
    const paid = payments.filter((p) => p.at <= paymentAt).reduce((s, p) => s + p.amount, 0);
    const refunded = refunds
      .filter((r) => r.status === "approved" && r.at <= paymentAt)
      .reduce((s, r) => s + r.amount, 0);
    return charged - paid + refunded;
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Figure label="Total charges" value={summary.charged} />
        <Figure label="Payments" value={summary.paid} tone="success" />
        <Figure label="Refunds" value={summary.refunded} />
        <Figure
          label={summary.balance < 0 ? "Credit" : "Balance due"}
          value={Math.abs(summary.balance)}
          tone={summary.balance > 0 ? "danger" : "success"}
        />
      </div>
      <div className="no-print flex flex-wrap gap-2">
        {!readOnly && can("billing.collect") ? (
          <Button onClick={() => setPayOpen(true)}>
            <CircleDollarSign aria-hidden="true" /> Record payment / deposit
          </Button>
        ) : null}
        {!readOnly && can("billing.refund") ? (
          <Button
            variant="outline"
            onClick={() => setRefundOpen(true)}
            disabled={summary.paid - summary.refunded - pendingRefunds <= 0}
          >
            <Undo2 aria-hidden="true" /> Request refund
          </Button>
        ) : null}
        <StatementPrint
          charges={[...charges].reverse()}
          payments={payments}
          refunds={refunds}
          identifiers={identifiers}
          branchId={branchId}
          balance={summary.balance}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Charges ({charges.length})</h3>
          {charges.length === 0 ? (
            <EmptyState title="No charges" />
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{formatDate(c.at)}</TableCell>
                      <TableCell>
                        <span className="block">{c.description}</span>
                        <span className="text-muted-foreground text-xs">{humanize(c.department)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.paid)}</TableCell>
                      <TableCell>
                        <StatusChip status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div className="grid content-start gap-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Payments ({payments.length})</h3>
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>
                        <span className="sr-only">Print</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.receiptNo}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(p.at)}</TableCell>
                        <TableCell className="uppercase">{p.method}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.amount)}</TableCell>
                        <TableCell className="text-right">
                          <ReceiptPrint
                            payment={p}
                            identifiers={identifiers}
                            branchId={branchId}
                            balanceAfter={balanceAfter(p.at)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          {refunds.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Refunds</h3>
              <ul className="grid gap-2">
                {refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span>
                      {formatMoney(r.amount)} · {r.reason}
                    </span>
                    <StatusChip status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <PaymentDialog episodeId={episodeId} balance={summary.balance} open={payOpen} onOpenChange={setPayOpen} />
      <RefundDialog
        episodeId={episodeId}
        refundable={summary.paid - summary.refunded - pendingRefunds}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
    </div>
  );
}
