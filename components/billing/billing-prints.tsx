"use client";

import { FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet, type PrintIdentifier } from "@/components/print/print-sheet";
import { useLookups } from "@/hooks/use-lookups";
import type { Charge, Payment, Refund } from "@/lib/schemas/billing";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export function ReceiptPrint({
  payment,
  identifiers,
  branchId,
  balanceAfter,
}: {
  payment: Payment;
  identifiers: PrintIdentifier[];
  branchId: string;
  balanceAfter: number;
}) {
  const { staffName } = useLookups();
  return (
    <PrintDialog
      title={`Receipt ${payment.receiptNo}`}
      documentTitle={payment.receiptNo}
      auditEntity="receipt"
      auditId={payment.id}
      trigger={
        <Button size="sm" variant="ghost">
          <Receipt aria-hidden="true" /> Receipt
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet
          ref={ref}
          title={`Official receipt ${payment.receiptNo}`}
          identifiers={identifiers}
          branchId={branchId}
        >
          <PrintSection title="Payment">
            <table>
              <tbody>
                <tr>
                  <th className="w-48">Receipt number</th>
                  <td>{payment.receiptNo}</td>
                </tr>
                <tr>
                  <th>Date</th>
                  <td>{formatDateTime(payment.at)}</td>
                </tr>
                <tr>
                  <th>Amount received</th>
                  <td className="text-base font-bold">{formatMoney(payment.amount)}</td>
                </tr>
                <tr>
                  <th>Method</th>
                  <td className="uppercase">{payment.method}</td>
                </tr>
                <tr>
                  <th>Reference</th>
                  <td>{payment.reference ?? "—"}</td>
                </tr>
                <tr>
                  <th>Received by</th>
                  <td>{staffName(payment.receivedBy)}</td>
                </tr>
                <tr>
                  <th>Balance after payment</th>
                  <td>{balanceAfter <= 0 ? `${formatMoney(-balanceAfter)} credit` : formatMoney(balanceAfter)}</td>
                </tr>
              </tbody>
            </table>
          </PrintSection>
          <p className="mt-8 text-center text-[#5B6B6D]">Thank you. Please keep this receipt for your records.</p>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}

export function StatementPrint({
  charges,
  payments,
  refunds,
  identifiers,
  branchId,
  balance,
}: {
  charges: Charge[];
  payments: Payment[];
  refunds: Refund[];
  identifiers: PrintIdentifier[];
  branchId: string;
  balance: number;
}) {
  const lines = [
    ...charges.map((c) => ({
      at: c.at,
      text: c.description,
      debit: c.status === "waived" ? 0 : c.amount,
      credit: 0,
      note: c.status === "waived" ? "Waived" : "",
    })),
    ...payments.map((p) => ({
      at: p.at,
      text: `Payment ${p.receiptNo} (${p.method})`,
      debit: 0,
      credit: p.amount,
      note: "",
    })),
    ...refunds
      .filter((r) => r.status === "approved")
      .map((r) => ({ at: r.at, text: `Refund: ${r.reason}`, debit: r.amount, credit: 0, note: "" })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const balances = lines.reduce<number[]>((acc, l) => [...acc, (acc[acc.length - 1] ?? 0) + l.debit - l.credit], []);
  return (
    <PrintDialog
      title="Account statement"
      documentTitle="account-statement"
      auditEntity="statement"
      trigger={
        <Button size="sm" variant="outline">
          <FileText aria-hidden="true" /> Statement
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet ref={ref} title="Statement of account" identifiers={identifiers} branchId={branchId}>
          <PrintSection title="Transactions">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">Charges</th>
                  <th className="text-right">Payments</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  return (
                    <tr key={`${l.at}-${i}`}>
                      <td>{formatDate(l.at)}</td>
                      <td>
                        {l.text}
                        {l.note ? ` (${l.note})` : ""}
                      </td>
                      <td className="text-right">{l.debit ? formatMoney(l.debit) : ""}</td>
                      <td className="text-right">{l.credit ? formatMoney(l.credit) : ""}</td>
                      <td className="text-right">{formatMoney(balances[i] ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PrintSection>
          <p className="text-right text-base font-bold">Balance due: {formatMoney(balance)}</p>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}
