"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CreditCard, Landmark, Plus, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpenAccountDialog } from "@/components/accounts/account-dialogs";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip } from "@/components/shared/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { fullName } from "@/lib/schemas/person";
import type { Wallet } from "@/lib/schemas/wallet";
import { usePersonStore } from "@/lib/stores/person";
import { useWalletStore } from "@/lib/stores/wallet";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { walletBalance } from "@/lib/wallet/ledger";

interface Row {
  wallet: Wallet;
  holder: string;
  balance: number;
  low: boolean;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "low", label: "Low / empty" },
  { value: "credit", label: "On credit" },
  { value: "pending", label: "No account number" },
  { value: "manual", label: "Auto-debit off" },
] as const;

export function AccountsListView() {
  const router = useRouter();
  const params = useSearchParams();
  const canManage = usePermission("wallets.manage");
  const wallets = useWalletStore((s) => s.wallets);
  const entries = useWalletStore((s) => s.entries);
  const persons = usePersonStore((s) => s.persons);
  const [openNew, setOpenNew] = useState(false);
  const filter = params.get("filter") ?? "all";

  const rows = useMemo<Row[]>(
    () =>
      wallets.map((w) => {
        const holder = persons.find((p) => p.id === w.holderId);
        const balance = walletBalance(entries, w.id);
        return {
          wallet: w,
          holder: holder ? fullName(holder) : "—",
          balance,
          low: balance <= 0 || (w.lowBalanceAlert > 0 && balance < w.lowBalanceAlert),
        };
      }),
    [wallets, entries, persons],
  );
  const filtered = rows.filter((r) =>
    filter === "low"
      ? r.low
      : filter === "credit"
        ? r.balance < 0
        : filter === "pending"
          ? !r.wallet.virtualAccount
          : filter === "manual"
            ? !r.wallet.autoDebit
            : true,
  );
  const held = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const onCredit = rows.reduce((s, r) => s + Math.min(0, r.balance), 0);

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "code", header: "Account", accessorFn: (r) => r.wallet.code },
    {
      id: "name",
      header: "Name",
      accessorFn: (r) => r.wallet.name,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.original.wallet.name}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {row.original.wallet.kind}
          </Badge>
        </span>
      ),
    },
    { accessorKey: "holder", header: "Holder" },
    {
      id: "members",
      header: "Members",
      meta: { align: "right" },
      accessorFn: (r) => r.wallet.members.length,
    },
    {
      id: "number",
      header: "Account number",
      accessorFn: (r) => r.wallet.virtualAccount?.accountNumber ?? "",
      cell: ({ row }) =>
        row.original.wallet.virtualAccount ? (
          <span className="tabular-nums">
            {row.original.wallet.virtualAccount.accountNumber}
            <span className="text-muted-foreground block text-xs">{row.original.wallet.virtualAccount.bankName}</span>
          </span>
        ) : (
          <StatusChip status="pending" label="Needs BVN" />
        ),
    },
    {
      accessorKey: "balance",
      header: "Balance",
      meta: { align: "right", exportValue: (r) => r.balance },
      cell: ({ row }) => (
        <span
          className={cn(
            "font-semibold tabular-nums",
            row.original.balance < 0 ? "text-destructive" : row.original.low ? "text-warning" : "text-success",
          )}
        >
          {formatMoney(row.original.balance)}
          {row.original.low ? <AlertTriangle className="ml-1 inline size-3.5" aria-label="Low balance" /> : null}
        </span>
      ),
    },
    {
      id: "auto",
      header: "Auto-debit",
      accessorFn: (r) => (r.wallet.autoDebit ? "On" : "Off"),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.wallet.autoDebit ? "active" : "off"}
          tone={row.original.wallet.autoDebit ? "done" : "neutral"}
          label={row.original.wallet.autoDebit ? "On" : "Off"}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.wallet.status,
      cell: ({ row }) => (
        <StatusChip
          status={row.original.wallet.status}
          tone={row.original.wallet.status === "active" ? "done" : "waiting"}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Family & patient accounts"
        description="Each patient or family has an account number. Money paid in goes to the hospital's bank; bills are deducted automatically."
        crumbs={[{ label: "Front office" }, { label: "Accounts" }]}
        actions={
          canManage ? (
            <Button onClick={() => setOpenNew(true)}>
              <Plus aria-hidden="true" /> Open account
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Accounts"
          value={rows.length}
          icon={WalletCards}
          hint={`${rows.filter((r) => r.wallet.kind === "family").length} family · ${rows.filter((r) => r.wallet.kind === "individual").length} individual`}
        />
        <StatTile
          label="Held for patients"
          value={formatMoney(held)}
          icon={Landmark}
          hint="Unspent deposits (already in the hospital's bank)"
        />
        <StatTile
          label="Low or empty"
          value={rows.filter((r) => r.low).length}
          icon={AlertTriangle}
          tone="warning"
          href="/accounts?filter=low"
        />
        <StatTile
          label="Running on credit"
          value={formatMoney(-onCredit)}
          icon={CreditCard}
          tone="danger"
          href="/accounts?filter=credit"
        />
      </div>
      <SectionCard
        title="Accounts"
        description="Click an account to see its statement, members, account number and deductions."
        actions={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter accounts">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? "default" : "outline"}
                aria-pressed={filter === f.value}
                onClick={() =>
                  router.replace(f.value === "all" ? "/accounts" : `/accounts?filter=${f.value}`, { scroll: false })
                }
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Search name, holder, account number…"
          exportName="patient-accounts"
          exportTitle="Patient & family accounts"
          onRowClick={(r) => router.push(`/accounts/${r.wallet.id}`)}
          initialSorting={[{ id: "name", desc: false }]}
          empty={
            <EmptyState
              icon={Users}
              title={filter === "all" ? "No accounts yet" : "No accounts match this filter"}
              description="Open an account for a patient or family to give them an account number."
            />
          }
        />
      </SectionCard>
      <OpenAccountDialog open={openNew} onOpenChange={setOpenNew} onCreated={(w) => router.push(`/accounts/${w.id}`)} />
    </>
  );
}
