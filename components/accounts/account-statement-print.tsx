"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet } from "@/components/print/print-sheet";
import { useLookups } from "@/hooks/use-lookups";
import { fullName } from "@/lib/schemas/person";
import type { LedgerEntry, Wallet } from "@/lib/schemas/wallet";
import { formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import type { WalletTotals } from "@/lib/wallet/ledger";

/** Printable account statement for the family (full amounts only — fees are internal to the hospital). */
export function AccountStatementPrint({
  wallet,
  entries,
  totals,
}: {
  wallet: Wallet;
  entries: LedgerEntry[];
  totals: WalletTotals;
}) {
  const { person } = useLookups();
  const holder = person(wallet.holderId);
  const rows = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <PrintDialog
      title={`Statement — ${wallet.name}`}
      documentTitle={`statement-${wallet.code}`}
      auditEntity="wallet"
      auditId={wallet.id}
      trigger={
        <Button variant="outline">
          <FileText aria-hidden="true" /> Print statement
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet
          ref={ref}
          title="Account statement"
          branchId={wallet.branchId}
          identifiers={[
            { label: "Account", value: `${wallet.name} (${wallet.code})` },
            { label: "Holder", value: holder ? fullName(holder, true) : "—" },
            {
              label: "Account no.",
              value: wallet.virtualAccount
                ? `${wallet.virtualAccount.accountNumber} · ${wallet.virtualAccount.bankName}`
                : "Not issued",
            },
            {
              label: "Members",
              value: wallet.members
                .map((m) => {
                  const p = person(m.personId);
                  return p ? `${p.firstName} ${p.lastName}` : m.personId;
                })
                .join(", "),
            },
            { label: "Auto-debit", value: wallet.autoDebit ? "On" : "Off" },
            { label: "Credit limit", value: formatMoney(wallet.creditLimit) },
          ]}
        >
          <PrintSection title="Summary">
            <table>
              <tbody>
                <tr>
                  <th className="w-56">Total received</th>
                  <td>{formatMoney(totals.received)}</td>
                </tr>
                <tr>
                  <th>Used for charges</th>
                  <td>{formatMoney(totals.spent)}</td>
                </tr>
                <tr>
                  <th>Returned (cancelled items)</th>
                  <td>{formatMoney(totals.returned)}</td>
                </tr>
                <tr>
                  <th>Refunded to the family</th>
                  <td>{formatMoney(totals.withdrawn)}</td>
                </tr>
                <tr>
                  <th>Balance</th>
                  <td className="font-bold">{formatMoney(totals.balance)}</td>
                </tr>
              </tbody>
            </table>
          </PrintSection>
          <PrintSection title="Transactions">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th className="text-right">In</th>
                  <th className="text-right">Out</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDateTime(e.at)}</td>
                    <td>{e.description}</td>
                    <td className="text-right">{e.direction === "credit" ? formatMoney(e.amount) : ""}</td>
                    <td className="text-right">{e.direction === "debit" ? formatMoney(e.amount) : ""}</td>
                    <td className="text-right">{formatMoney(e.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}
