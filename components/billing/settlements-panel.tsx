"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DateRangeFields } from "@/components/shared/date-range-fields";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip } from "@/components/shared/status-chip";
import { useActiveTenant } from "@/hooks/use-tenant";
import type { Settlement } from "@/lib/schemas/wallet";
import { DEPOSIT_CHANNEL_LABELS, useWalletStore } from "@/lib/stores/wallet";
import { formatDateTime, nowIso, shiftDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { settlementState } from "@/lib/wallet/ledger";

interface Row extends Settlement {
  account: string;
  state: Settlement["status"];
}

/** Every payment into patient accounts, split into what the patient paid, fees, and what reaches the hospital. */
export function SettlementsPanel() {
  const router = useRouter();
  const tenant = useActiveTenant();
  const settlements = useWalletStore((s) => s.settlements);
  const wallets = useWalletStore((s) => s.wallets);
  const today = todayIso();
  const [from, setFrom] = useState(shiftDate(today, -30));
  const [to, setTo] = useState(today);
  const now = nowIso();

  const rows = useMemo<Row[]>(
    () =>
      settlements
        .filter((s) => s.at.slice(0, 10) >= from && s.at.slice(0, 10) <= to)
        .map((s) => {
          const w = wallets.find((x) => x.id === s.walletId);
          return { ...s, account: w ? `${w.name} (${w.code})` : s.walletId, state: settlementState(s, now) };
        })
        .sort((a, b) => b.at.localeCompare(a.at)),
    [settlements, wallets, from, to, now],
  );
  const sum = (k: "gross" | "gatewayFee" | "platformFee" | "hospitalNet") => rows.reduce((s, r) => s + r[k], 0);
  const pending = rows.filter((r) => r.state === "pending").reduce((s, r) => s + r.hospitalNet, 0);

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "at",
      header: "Received",
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{formatDateTime(row.original.at)}</span>,
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { accessorKey: "account", header: "Account" },
    { id: "channel", header: "Channel", accessorFn: (r) => DEPOSIT_CHANNEL_LABELS[r.channel] },
    {
      accessorKey: "gross",
      header: "Patient paid",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.gross),
    },
    {
      accessorKey: "gatewayFee",
      header: "Gateway fee",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.gatewayFee),
    },
    {
      accessorKey: "platformFee",
      header: "Platform fee",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.platformFee),
    },
    {
      accessorKey: "hospitalNet",
      header: "To hospital bank",
      meta: { align: "right" },
      cell: ({ row }) => <strong className="tabular-nums">{formatMoney(row.original.hospitalNet)}</strong>,
    },
    {
      accessorKey: "state",
      header: "Settlement",
      cell: ({ row }) => (
        <StatusChip
          status={row.original.state}
          tone={row.original.state === "settled" ? "done" : row.original.state === "pending" ? "waiting" : "neutral"}
          label={
            row.original.state === "pending"
              ? `Due ${formatDateTime(row.original.settledAt)}`
              : row.original.state === "collected-at-desk"
                ? "Collected at desk"
                : "Settled"
          }
        />
      ),
    },
    { accessorKey: "gatewayRef", header: "Reference" },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Patients paid in" value={formatMoney(sum("gross"))} hint={`${rows.length} payments`} />
        <StatTile label="Gateway fees" value={formatMoney(sum("gatewayFee"))} hint="Paystack" tone="warning" />
        <StatTile
          label="Platform service charge"
          value={formatMoney(sum("platformFee"))}
          hint={
            tenant
              ? `${tenant.feePercent}% of gateway payments${tenant.feeCap ? `, max ${formatMoney(tenant.feeCap)}` : ""}`
              : undefined
          }
          tone="rose"
        />
        <StatTile label="Net to hospital bank" value={formatMoney(sum("hospitalNet"))} />
        <StatTile label="Awaiting settlement" value={formatMoney(pending)} hint="Next working day" tone="warning" />
      </div>
      <SectionCard
        title="Collections & settlements"
        description={`Patients and families are always credited the full amount they pay. Fees are deducted from what is settled to ${tenant?.settlement.bankName ?? "the hospital's bank"} ••••${tenant?.settlement.accountNumber.slice(-4) ?? ""}.`}
        actions={<DateRangeFields idPrefix="stl" from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}
      >
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search account or reference…"
          exportName={`settlements-${from}-to-${to}`}
          exportTitle="Collections & settlements"
          onRowClick={(r) => router.push(`/accounts/${r.walletId}?tab=breakdown`)}
          empty={<EmptyState title="No payments in this period" />}
        />
      </SectionCard>
    </div>
  );
}
