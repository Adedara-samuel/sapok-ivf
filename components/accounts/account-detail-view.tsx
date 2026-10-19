"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Copy,
  CreditCard,
  FileSignature,
  KeyRound,
  Landmark,
  MessageCircle,
  Settings2,
  Snowflake,
  Undo2,
  UserPlus,
  UserX,
  WalletCards,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AccountSettingsDialog,
  AddMemberDialog,
  ConsentDialog,
  CreditLimitDialog,
  DeskDepositDialog,
  IssueAccountDialog,
  SimulateTransferDialog,
  WithdrawalDialog,
} from "@/components/accounts/account-dialogs";
import { AccountStatementPrint } from "@/components/accounts/account-statement-print";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { useCan } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { fullName } from "@/lib/schemas/person";
import type { LedgerEntry, Settlement } from "@/lib/schemas/wallet";
import { useBillingStore } from "@/lib/stores/billing";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useRequestStore } from "@/lib/stores/requests";
import { DEPOSIT_CHANNEL_LABELS, useWalletStore } from "@/lib/stores/wallet";
import { formatDateTime, nowIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  isWalletPayable,
  pendingWithdrawals,
  settlementState,
  walletForEpisode,
  walletTotals,
  whatsappNumber,
} from "@/lib/wallet/ledger";

function Figure({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "danger" | "success" | "warning";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {formatMoney(value)}
      </p>
      {hint ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  );
}

type DialogKey = "member" | "deposit" | "simulate" | "settings" | "credit" | "issue" | "consent" | "withdraw" | null;

export function AccountDetailView({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();
  const run = useRunAction();
  const { staffName, person } = useLookups();
  const wallet = useWalletStore((s) => s.wallets.find((w) => w.id === id));
  const wallets = useWalletStore((s) => s.wallets);
  const allEntries = useWalletStore((s) => s.entries);
  const allSettlements = useWalletStore((s) => s.settlements);
  const allMessages = useWalletStore((s) => s.messages);
  const settle = useWalletStore((s) => s.settle);
  const removeMember = useWalletStore((s) => s.removeMember);
  const setFrozen = useWalletStore((s) => s.setFrozen);
  const charges = useBillingStore((s) => s.charges);
  const episodes = useEpisodeStore((s) => s.episodes);
  const requests = useRequestStore((s) => s.requests);
  const [dialog, setDialog] = useState<DialogKey>(null);
  const tab = params.get("tab") ?? "statement";

  const entries = useMemo(
    () => allEntries.filter((e) => e.walletId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [allEntries, id],
  );
  const settlements = useMemo(
    () => allSettlements.filter((s) => s.walletId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [allSettlements, id],
  );
  const messages = useMemo(
    () => allMessages.filter((m) => m.walletId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [allMessages, id],
  );
  const myEpisodes = useMemo(
    () => episodes.filter((e) => walletForEpisode(wallets, e)?.id === id),
    [episodes, wallets, id],
  );
  const unpaid = useMemo(() => {
    const ids = new Set(myEpisodes.map((e) => e.id));
    return charges.filter((c) => ids.has(c.episodeId) && isWalletPayable(c)).sort((a, b) => a.at.localeCompare(b.at));
  }, [charges, myEpisodes]);

  if (!wallet) {
    return (
      <EmptyState
        icon={WalletCards}
        title="Account not found"
        description="It may have been removed by a data reset."
        action={
          <Button asChild>
            <Link href="/accounts">Back to accounts</Link>
          </Button>
        }
      />
    );
  }

  const totals = walletTotals(allEntries, wallet.id);
  const reserved = pendingWithdrawals(requests, wallet.id);
  const available = totals.balance + wallet.creditLimit - reserved;
  const owed = unpaid.reduce((s, c) => s + c.amount - c.paid, 0);
  const holder = person(wallet.holderId);
  const manage = can("wallets.manage");
  const active = wallet.status === "active";
  const setTab = (v: string) => router.replace(`/accounts/${id}?tab=${v}`, { scroll: false });

  const statementColumns: ColumnDef<LedgerEntry, unknown>[] = [
    {
      accessorKey: "at",
      header: "Date",
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{formatDateTime(row.original.at)}</span>,
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    {
      accessorKey: "description",
      header: "Details",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <span className="flex items-start gap-2">
            {e.direction === "credit" ? (
              <ArrowDownLeft className="text-success mt-0.5 size-4 shrink-0" aria-label="Money in" />
            ) : (
              <ArrowUpRight className="text-destructive mt-0.5 size-4 shrink-0" aria-label="Money out" />
            )}
            <span>
              <span className="block">{e.description}</span>
              <span className="text-muted-foreground text-xs">
                {e.kind === "deposit" && e.channel
                  ? DEPOSIT_CHANNEL_LABELS[e.channel]
                  : e.kind === "charge"
                    ? "Auto-debit"
                    : e.kind === "reversal"
                      ? "Returned"
                      : "Refund"}
                {e.gatewayRef ? ` · ref ${e.gatewayRef}` : ""}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      id: "in",
      header: "Money in",
      meta: { align: "right", exportValue: (r) => (r.direction === "credit" ? r.amount : "") },
      accessorFn: (r) => (r.direction === "credit" ? r.amount : 0),
      cell: ({ row }) =>
        row.original.direction === "credit" ? (
          <span className="text-success tabular-nums">{formatMoney(row.original.amount)}</span>
        ) : null,
    },
    {
      id: "out",
      header: "Money out",
      meta: { align: "right", exportValue: (r) => (r.direction === "debit" ? r.amount : "") },
      accessorFn: (r) => (r.direction === "debit" ? r.amount : 0),
      cell: ({ row }) =>
        row.original.direction === "debit" ? (
          <span className="tabular-nums">{formatMoney(row.original.amount)}</span>
        ) : null,
    },
    {
      accessorKey: "balanceAfter",
      header: "Balance",
      meta: { align: "right", exportValue: (r) => r.balanceAfter },
      cell: ({ row }) => (
        <span className={cn("font-medium tabular-nums", row.original.balanceAfter < 0 && "text-destructive")}>
          {formatMoney(row.original.balanceAfter)}
        </span>
      ),
    },
    {
      id: "by",
      header: "By",
      accessorFn: (r) => (r.by === "SYSTEM" ? "Automatic (gateway)" : staffName(r.by)),
    },
  ];

  const settlementColumns: ColumnDef<Settlement, unknown>[] = [
    {
      accessorKey: "at",
      header: "Received",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
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
      cell: ({ row }) =>
        `${formatMoney(row.original.platformFee)}${row.original.feePercent ? ` (${row.original.feePercent}%)` : ""}`,
    },
    {
      accessorKey: "hospitalNet",
      header: "To hospital bank",
      meta: { align: "right" },
      cell: ({ row }) => <strong className="tabular-nums">{formatMoney(row.original.hospitalNet)}</strong>,
    },
    {
      id: "state",
      header: "Settlement",
      accessorFn: (r) => settlementState(r, nowIso()),
      cell: ({ row }) => {
        const state = settlementState(row.original, nowIso());
        return (
          <StatusChip
            status={state}
            tone={state === "settled" ? "done" : state === "pending" ? "waiting" : "neutral"}
            label={
              state === "pending"
                ? `Settles ${formatDateTime(row.original.settledAt)}`
                : state === "collected-at-desk"
                  ? "Collected at desk"
                  : "Settled"
            }
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {wallet.name}
            <Badge variant="outline" className="capitalize">
              {wallet.kind}
            </Badge>
            <StatusChip status={wallet.status} tone={active ? "done" : "waiting"} />
          </span>
        }
        description={`${wallet.code} · holder ${holder ? fullName(holder, true) : "—"} · opened ${formatDateTime(wallet.createdAt)}`}
        crumbs={[{ label: "Accounts", href: "/accounts" }, { label: wallet.code }]}
        actions={<AccountStatementPrint wallet={wallet} entries={entries} totals={totals} />}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="from-primary to-primary/70 text-primary-foreground relative overflow-hidden rounded-xl bg-gradient-to-br p-5 shadow-sm">
          <Landmark className="absolute -right-4 -bottom-4 size-28 opacity-10" aria-hidden="true" />
          {wallet.virtualAccount ? (
            <>
              <p className="text-xs tracking-wide uppercase opacity-80">Pay by transfer to</p>
              <p className="mt-1 text-3xl font-semibold tracking-wider tabular-nums" data-testid="account-number">
                {wallet.virtualAccount.accountNumber}
              </p>
              <p className="text-sm">{wallet.virtualAccount.bankName}</p>
              <p className="mt-1 text-xs opacity-80">{wallet.virtualAccount.accountName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(wallet.virtualAccount?.accountNumber ?? "")
                      .then(() => toast.success("Account number copied"))
                      .catch(() => toast.error("Copy failed"));
                  }}
                >
                  <Copy aria-hidden="true" /> Copy
                </Button>
                {holder ? (
                  <Button size="sm" variant="secondary" asChild>
                    <a
                      href={`https://wa.me/${whatsappNumber(holder.phone)}?text=${encodeURIComponent(`Hello ${holder.firstName}, please fund ${wallet.name} by transfer to ${wallet.virtualAccount.bankName} ${wallet.virtualAccount.accountNumber} (${wallet.virtualAccount.accountName}). Treatment bills are deducted automatically.`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle aria-hidden="true" /> Send on WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-[11px] opacity-70">
                Paystack dedicated account · BVN ••••{wallet.bvnLast4 ?? "—"} · demo number
              </p>
            </>
          ) : (
            <div className="grid gap-2">
              <p className="font-semibold">No account number yet</p>
              <p className="text-sm opacity-90">Needs the account holder&apos;s BVN to issue one with Paystack.</p>
              {manage ? (
                <Button size="sm" variant="secondary" className="w-fit" onClick={() => setDialog("issue")}>
                  <KeyRound aria-hidden="true" /> Issue account number
                </Button>
              ) : null}
            </div>
          )}
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Figure label="Total received" value={totals.received} tone="success" />
            <Figure
              label="Used for charges"
              value={totals.spent - totals.returned}
              hint={totals.returned ? `${formatMoney(totals.returned)} returned` : undefined}
            />
            <Figure label="Refunded to family" value={totals.withdrawn} />
            <Figure
              label="Available balance"
              value={available}
              tone={
                totals.balance < 0
                  ? "danger"
                  : wallet.lowBalanceAlert && totals.balance < wallet.lowBalanceAlert
                    ? "warning"
                    : "success"
              }
              hint={
                [
                  totals.balance !== available ? `Balance ${formatMoney(totals.balance)}` : null,
                  wallet.creditLimit ? `credit limit ${formatMoney(wallet.creditLimit)}` : null,
                  reserved ? `${formatMoney(reserved)} refund pending` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status="auto"
              tone={wallet.autoDebit ? "done" : "neutral"}
              label={`Auto-debit ${wallet.autoDebit ? "on" : "off"}`}
            />
            {owed > 0 ? <StatusChip status="unpaid" label={`${formatMoney(owed)} waiting for payment`} /> : null}
            {wallet.consent ? (
              <StatusChip status="signed" label={`Authorised by ${wallet.consent.signerName}`} />
            ) : (
              <StatusChip status="pending" label="Auto-debit authorisation not signed" />
            )}
          </div>
          <div className="no-print flex flex-wrap gap-2">
            {active && wallet.virtualAccount && can("billing.collect") ? (
              <Button onClick={() => setDialog("simulate")}>
                <Zap aria-hidden="true" /> Simulate bank transfer
              </Button>
            ) : null}
            {active && can("billing.collect") ? (
              <Button variant="outline" onClick={() => setDialog("deposit")}>
                <Banknote aria-hidden="true" /> Cash / POS deposit
              </Button>
            ) : null}
            {active && owed > 0 && manage ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={available <= 0}>
                    <CreditCard aria-hidden="true" /> Pay outstanding now
                  </Button>
                }
                destructive={false}
                title="Pay outstanding charges from this account?"
                description={`Up to ${formatMoney(Math.min(owed, Math.max(0, available)))} of ${formatMoney(owed)} will be deducted, oldest charges first.`}
                confirmLabel="Pay now"
                onConfirm={() => {
                  run(() => settle(wallet.id, "manual"), {
                    success: (r) =>
                      r.debited > 0
                        ? `${formatMoney(r.debited)} paid${r.stillOwed ? ` — ${formatMoney(r.stillOwed)} still owed` : ""}`
                        : "Nothing could be paid — top up the account",
                  });
                }}
              />
            ) : null}
            {can("billing.refund") && totals.balance - reserved > 0 ? (
              <Button variant="outline" onClick={() => setDialog("withdraw")}>
                <Undo2 aria-hidden="true" /> Refund balance
              </Button>
            ) : null}
            {manage ? (
              <Button variant="ghost" onClick={() => setDialog("settings")}>
                <Settings2 aria-hidden="true" /> Settings
              </Button>
            ) : null}
            {can("wallets.credit") ? (
              <Button variant="ghost" onClick={() => setDialog("credit")}>
                <CreditCard aria-hidden="true" /> Credit limit
              </Button>
            ) : null}
            {manage && !wallet.consent ? (
              <Button variant="ghost" onClick={() => setDialog("consent")}>
                <FileSignature aria-hidden="true" /> Sign authorisation
              </Button>
            ) : null}
            {can("wallets.credit") && wallet.status !== "closed" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost">
                    <Snowflake aria-hidden="true" /> {active ? "Freeze" : "Unfreeze"}
                  </Button>
                }
                title={active ? `Freeze ${wallet.name}?` : `Unfreeze ${wallet.name}?`}
                description={
                  active
                    ? "No deductions or desk deposits while frozen. Transfers still arrive and are held."
                    : "Deductions resume; outstanding charges are not paid until the next deposit or “Pay outstanding now”."
                }
                reasonLabel="Reason"
                confirmLabel={active ? "Freeze account" : "Unfreeze account"}
                onConfirm={(reason) => {
                  run(() => setFrozen(wallet.id, active, reason), {
                    success: active ? "Account frozen" : "Account active again",
                  });
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="statement">Statement ({entries.length})</TabsTrigger>
            <TabsTrigger value="members">Members ({wallet.members.length})</TabsTrigger>
            <TabsTrigger value="unpaid">Waiting for payment ({unpaid.length})</TabsTrigger>
            {can("reports.finance") ? <TabsTrigger value="breakdown">Money breakdown</TabsTrigger> : null}
            <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="statement" className="mt-4">
          <SectionCard
            title="Statement"
            description="Every naira in and out, newest first. Entries are never edited — corrections are new entries."
          >
            <DataTable
              data={entries}
              columns={statementColumns}
              searchPlaceholder="Search the statement…"
              exportName={`statement-${wallet.code}`}
              exportTitle={`Statement — ${wallet.name} (${wallet.code})`}
              empty={<EmptyState title="No transactions yet" description="Deposits and deductions appear here." />}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <SectionCard
            title="Members"
            description="Everyone whose bills this account pays."
            actions={
              manage && wallet.kind === "family" && active ? (
                <Button size="sm" onClick={() => setDialog("member")}>
                  <UserPlus aria-hidden="true" /> Link patient
                </Button>
              ) : null
            }
          >
            <ul className="grid gap-2">
              {wallet.members.map((m) => {
                const p = person(m.personId);
                const eps = myEpisodes.filter((e) => e.patientId === m.personId);
                const due = charges
                  .filter((c) => eps.some((e) => e.id === c.episodeId) && isWalletPayable(c))
                  .reduce((s, c) => s + c.amount - c.paid, 0);
                const fileId = p?.roles.includes("patient")
                  ? p.id
                  : episodes.find((e) => e.partnerId === m.personId)?.patientId;
                return (
                  <li
                    key={m.personId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {p ? fullName(p, true) : m.personId}
                        <Badge variant="secondary">{m.relationship}</Badge>
                        {m.personId === wallet.holderId ? <Badge>Holder</Badge> : null}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {p?.prn} · {p?.phone} · {eps.map((e) => e.ivfNo).join(", ") || "no episode of their own"}
                        {due > 0 ? ` · ${formatMoney(due)} unpaid` : ""}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      {fileId ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/patients/${fileId}?tab=billing`}>Open file</Link>
                        </Button>
                      ) : null}
                      {manage && m.personId !== wallet.holderId ? (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost" aria-label={`Remove ${p?.firstName ?? "member"}`}>
                              <UserX aria-hidden="true" />
                            </Button>
                          }
                          title={`Remove ${p ? fullName(p) : "member"} from ${wallet.name}?`}
                          description="Their future bills will no longer be paid from this account. Past payments stay on the statement."
                          confirmLabel="Remove"
                          onConfirm={() => {
                            run(() => removeMember(wallet.id, m.personId), { success: "Member removed" });
                          }}
                        />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="unpaid" className="mt-4">
          <SectionCard
            title="Waiting for payment"
            description={
              wallet.autoDebit
                ? "These are paid automatically as soon as money arrives."
                : "Auto-debit is off: use “Pay outstanding now” to pay these from the balance."
            }
          >
            {unpaid.length === 0 ? (
              <EmptyState title="Nothing waiting" description="Every bill for this account's members is paid." />
            ) : (
              <ul className="grid gap-2">
                {unpaid.map((c) => {
                  const ep = episodes.find((e) => e.id === c.episodeId);
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <span>
                        <span className="block font-medium">{c.description}</span>
                        <span className="text-muted-foreground text-xs">
                          {ep?.ivfNo} · {fullName(person(ep?.patientId) ?? { firstName: "—", lastName: "" })} ·{" "}
                          {formatDateTime(c.at)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{formatMoney(c.amount - c.paid)}</span>
                        <StatusChip status={c.status} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {can("reports.finance") ? (
          <TabsContent value="breakdown" className="mt-4">
            <SectionCard
              title="Money breakdown"
              description="Where each payment went. The family is always credited the full amount; gateway and platform fees come out of the hospital's settlement."
            >
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Figure label="Patients paid" value={settlements.reduce((s, x) => s + x.gross, 0)} />
                <Figure label="Gateway fees" value={settlements.reduce((s, x) => s + x.gatewayFee, 0)} />
                <Figure label="Platform service charge" value={settlements.reduce((s, x) => s + x.platformFee, 0)} />
                <Figure
                  label="To hospital bank"
                  value={settlements.reduce((s, x) => s + x.hospitalNet, 0)}
                  tone="success"
                />
              </div>
              <DataTable
                data={settlements}
                columns={settlementColumns}
                searchable={false}
                exportName={`settlements-${wallet.code}`}
                exportTitle={`Settlements — ${wallet.name}`}
                empty={<EmptyState title="No deposits yet" />}
              />
            </SectionCard>
          </TabsContent>
        ) : null}

        <TabsContent value="messages" className="mt-4">
          <SectionCard
            title="Messages to the account holder"
            description="Sent automatically for deposits, deductions, low balance and refunds (WhatsApp in production; logged here in the demo)."
          >
            {messages.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              <ul className="grid gap-2">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-lg border p-3 text-sm">
                    <p className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <MessageCircle className="size-3.5" aria-hidden="true" /> WhatsApp to {m.to} ·{" "}
                      {formatDateTime(m.at)}
                      <a
                        className="text-primary ml-auto hover:underline"
                        href={`https://wa.me/${whatsappNumber(m.to)}?text=${encodeURIComponent(m.body)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Re-send
                      </a>
                    </p>
                    <p>{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {wallet.consent ? (
        <SectionCard
          title="Auto-debit authorisation"
          className="mt-4"
          description={`Signed ${formatDateTime(wallet.consent.signedAt)}`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={wallet.consent.signatureDataUrl}
              alt={`Signature of ${wallet.consent.signerName}`}
              className="h-16 rounded border bg-white"
            />
            <p className="text-sm">{wallet.consent.signerName}</p>
          </div>
        </SectionCard>
      ) : null}

      <AddMemberDialog
        wallet={wallet}
        open={dialog === "member"}
        onOpenChange={(o) => setDialog(o ? "member" : null)}
      />
      <DeskDepositDialog
        wallet={wallet}
        open={dialog === "deposit"}
        onOpenChange={(o) => setDialog(o ? "deposit" : null)}
      />
      <SimulateTransferDialog
        wallet={wallet}
        open={dialog === "simulate"}
        onOpenChange={(o) => setDialog(o ? "simulate" : null)}
      />
      <AccountSettingsDialog
        key={`s-${wallet.autoDebit}-${wallet.name}`}
        wallet={wallet}
        open={dialog === "settings"}
        onOpenChange={(o) => setDialog(o ? "settings" : null)}
      />
      <CreditLimitDialog
        key={`c-${wallet.creditLimit}`}
        wallet={wallet}
        open={dialog === "credit"}
        onOpenChange={(o) => setDialog(o ? "credit" : null)}
      />
      <IssueAccountDialog
        wallet={wallet}
        open={dialog === "issue"}
        onOpenChange={(o) => setDialog(o ? "issue" : null)}
      />
      <ConsentDialog
        wallet={wallet}
        open={dialog === "consent"}
        onOpenChange={(o) => setDialog(o ? "consent" : null)}
      />
      <WithdrawalDialog
        wallet={wallet}
        refundable={totals.balance - reserved}
        open={dialog === "withdraw"}
        onOpenChange={(o) => setDialog(o ? "withdraw" : null)}
      />
    </>
  );
}
