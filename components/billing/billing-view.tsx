"use client";

import { DatePicker } from "@/components/shared/date-picker";
import { DateRangeFields } from "@/components/shared/date-range-fields";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, PackageOpen, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountPanel } from "@/components/billing/account-panel";
import { SettlementsPanel } from "@/components/billing/settlements-panel";
import { SimpleBarChart } from "@/components/charts/lazy";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { PACKAGES, catalogItem } from "@/lib/constants/catalog";
import { PayerCategory } from "@/lib/schemas/common";
import type { HmoClaim } from "@/lib/schemas/billing";
import { fullName } from "@/lib/schemas/person";
import { AGING_BUCKETS, accountRows, agingTotals, instalmentSchedule, type AccountRow } from "@/lib/selectors/billing";
import { inRange } from "@/lib/selectors/predicates";
import { placeOrder } from "@/lib/services/workflows";
import { useBillingStore } from "@/lib/stores/billing";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";
import { useSessionStore } from "@/lib/stores/session";
import { formatDate, formatDateTime, shiftDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export function BillingView() {
  const router = useRouter();
  const params = useSearchParams();
  const run = useRunAction();
  const canCollect = usePermission("billing.collect");
  const canFinance = usePermission("reports.finance");
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);
  const charges = useBillingStore((s) => s.charges);
  const payments = useBillingStore((s) => s.payments);
  const refunds = useBillingStore((s) => s.refunds);
  const claims = useBillingStore((s) => s.claims);
  const submitClaim = useBillingStore((s) => s.submitClaim);
  const decideClaim = useBillingStore((s) => s.decideClaim);
  const branchId = useSessionStore((s) => s.branchId);
  const today = todayIso();
  const tab = params.get("tab") ?? "accounts";
  const [openEpisode, setOpenEpisode] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [rFrom, setRFrom] = useState(shiftDate(today, -30));
  const [rTo, setRTo] = useState(today);
  const [rPayer, setRPayer] = useState("all");
  const [rDept, setRDept] = useState("all");
  const [pkgCode, setPkgCode] = useState(PACKAGES[0]?.code ?? "");
  const [pkgEpisode, setPkgEpisode] = useState("");
  const [pkgStart, setPkgStart] = useState(today);

  const scoped = useMemo(() => episodes.filter((e) => e.branchId === branchId), [episodes, branchId]);
  const rows = useMemo(
    () => accountRows(scoped, persons, charges, payments, refunds, today),
    [scoped, persons, charges, payments, refunds, today],
  );
  const totals = agingTotals(rows);
  const outstanding = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const collected30 = payments
    .filter((p) => scoped.some((e) => e.id === p.episodeId) && p.at.slice(0, 10) >= shiftDate(today, -30))
    .reduce((s, p) => s + p.amount, 0);
  const selectedRow = rows.find((r) => r.episode.id === openEpisode);

  const found =
    lookup.trim().length >= 3
      ? rows
          .filter((r) =>
            `${r.episode.ivfNo} ${r.patient?.prn ?? ""} ${r.patient ? fullName(r.patient) : ""} ${r.patient?.phone ?? ""}`
              .toLowerCase()
              .includes(lookup.trim().toLowerCase()),
          )
          .slice(0, 5)
      : [];

  const accountColumns: ColumnDef<AccountRow, unknown>[] = [
    { id: "ivfNo", header: "IVF no", accessorFn: (r) => r.episode.ivfNo },
    {
      id: "patient",
      header: "Patient",
      accessorFn: (r) => (r.patient ? fullName(r.patient) : "—"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.patient ? fullName(row.original.patient) : "—"}</span>
      ),
    },
    { id: "prn", header: "PRN", accessorFn: (r) => r.patient?.prn ?? "" },
    {
      id: "payer",
      header: "Payer",
      accessorFn: (r) =>
        r.patient
          ? `${humanize(r.patient.payer.category)}${r.patient.payer.sponsor ? ` · ${r.patient.payer.sponsor}` : r.patient.payer.company ? ` · ${r.patient.payer.company}` : ""}`
          : "",
    },
    {
      accessorKey: "charged",
      header: "Charged",
      meta: { align: "right", exportValue: (r) => r.charged },
      cell: ({ row }) => formatMoney(row.original.charged),
    },
    {
      accessorKey: "paid",
      header: "Paid",
      meta: { align: "right", exportValue: (r) => r.paid },
      cell: ({ row }) => formatMoney(row.original.paid),
    },
    {
      accessorKey: "balance",
      header: "Balance",
      meta: { align: "right", exportValue: (r) => r.balance },
      cell: ({ row }) => (
        <span className={row.original.balance > 0 ? "text-destructive font-semibold" : "text-success"}>
          {formatMoney(row.original.balance)}
        </span>
      ),
    },
    {
      id: "last",
      header: "Last payment",
      accessorFn: (r) => r.lastPaymentAt ?? "",
      cell: ({ row }) => formatDate(row.original.lastPaymentAt),
    },
    {
      id: "status",
      header: "Episode",
      accessorFn: (r) => r.episode.status,
      cell: ({ row }) => <StatusChip status={row.original.episode.status} />,
    },
  ];

  const agingRows = rows.filter((r) => AGING_BUCKETS.some((b) => r.outstandingByBucket[b] > 0));
  const agingColumns: ColumnDef<AccountRow, unknown>[] = [
    {
      id: "patient",
      header: "Patient",
      accessorFn: (r) => (r.patient ? `${fullName(r.patient)} · ${r.episode.ivfNo}` : r.episode.ivfNo),
    },
    ...AGING_BUCKETS.map(
      (b) =>
        ({
          id: b,
          header: b,
          meta: { align: "right" as const, exportValue: (r: AccountRow) => r.outstandingByBucket[b] },
          accessorFn: (r: AccountRow) => r.outstandingByBucket[b],
          cell: ({ row }: { row: { original: AccountRow } }) =>
            row.original.outstandingByBucket[b] ? formatMoney(row.original.outstandingByBucket[b]) : "—",
        }) as ColumnDef<AccountRow, unknown>,
    ),
    {
      id: "total",
      header: "Total due",
      meta: { align: "right", exportValue: (r) => AGING_BUCKETS.reduce((s, b) => s + r.outstandingByBucket[b], 0) },
      accessorFn: (r) => AGING_BUCKETS.reduce((s, b) => s + r.outstandingByBucket[b], 0),
      cell: ({ getValue }) => <strong>{formatMoney(Number(getValue()))}</strong>,
    },
  ];

  // Account report (date, payer, department)
  const scopedIds = new Set(scoped.map((e) => e.id));
  const reportCharges = charges.filter(
    (c) =>
      scopedIds.has(c.episodeId) &&
      c.status !== "waived" &&
      inRange(c.at, { from: rFrom, to: rTo }) &&
      (rPayer === "all" || c.payer === rPayer) &&
      (rDept === "all" || c.department === rDept),
  );
  const reportPayments = payments.filter(
    (p) =>
      scopedIds.has(p.episodeId) &&
      inRange(p.at, { from: rFrom, to: rTo }) &&
      (rPayer === "all" ||
        persons.find((x) => x.id === episodes.find((e) => e.id === p.episodeId)?.patientId)?.payer.category === rPayer),
  );
  const byDept = ["service", "lab", "radiology", "pharmacy"].map((d) => ({
    dept: humanize(d),
    amount: reportCharges.filter((c) => c.department === d).reduce((s, c) => s + c.amount, 0),
  }));

  const pkg = PACKAGES.find((p) => p.code === pkgCode);
  const pkgTotal = pkg ? pkg.items.reduce((s, code) => s + (catalogItem(code)?.price ?? 0), 0) : 0;
  const schedule = pkg ? instalmentSchedule(pkgTotal, pkg.instalments) : [];

  const hmoEpisodes = scoped.filter((e) => persons.find((p) => p.id === e.patientId)?.payer.category === "hmo");
  const claimRows = claims
    .filter((c) => scopedIds.has(c.episodeId))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const claimColumns: ColumnDef<HmoClaim, unknown>[] = [
    { accessorKey: "submittedAt", header: "Submitted", cell: ({ row }) => formatDate(row.original.submittedAt) },
    {
      id: "patient",
      header: "Patient",
      accessorFn: (c) => {
        const ep = episodes.find((e) => e.id === c.episodeId);
        const p = persons.find((x) => x.id === ep?.patientId);
        return p ? `${fullName(p)} · ${ep?.ivfNo}` : "—";
      },
    },
    { accessorKey: "hmo", header: "HMO" },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusChip status={row.original.status} /> },
    { accessorKey: "decidedAt", header: "Decided", cell: ({ row }) => formatDate(row.original.decidedAt) },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) =>
        canCollect && row.original.status === "submitted" ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                run(
                  () => {
                    decideClaim(row.original.id, "approved");
                    return true;
                  },
                  { success: "Claim approved" },
                )
              }
            >
              <Check aria-hidden="true" /> Approved
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                run(
                  () => {
                    decideClaim(row.original.id, "rejected");
                    return true;
                  },
                  { success: "Claim marked rejected" },
                )
              }
            >
              <X aria-hidden="true" /> Rejected
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Billing"
        description="Accounts, collections, aging, packages and HMO claims."
        crumbs={[{ label: "Clinical services" }, { label: "Billing" }]}
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          hint={`${rows.filter((r) => r.balance > 0).length} accounts owe`}
          tone="danger"
        />
        <StatTile label="Collected (30 days)" value={formatMoney(collected30)} />
        <StatTile label="Over 90 days" value={formatMoney(totals["90+ days"])} tone="warning" />
        <StatTile
          label="HMO claims pending"
          value={claimRows.filter((c) => c.status === "submitted").length}
          tone="rose"
        />
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(`/billing?tab=${v}`, { scroll: false })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="report">Account report</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="claims">HMO claims</TabsTrigger>
          {canFinance ? <TabsTrigger value="settlements">Collections & settlements</TabsTrigger> : null}
        </TabsList>

        {canFinance ? (
          <TabsContent value="settlements" className="mt-4">
            <SettlementsPanel />
          </TabsContent>
        ) : null}

        <TabsContent value="accounts" className="mt-4 grid gap-4">
          <SectionCard title="Check account balance" description="Type a PRN, IVF number, name or phone.">
            <div className="relative max-w-md">
              <Search
                className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                className="pl-8"
                placeholder="e.g. IVF-2026-0001"
                aria-label="Check account balance"
              />
            </div>
            {found.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {found.map((r) => (
                  <li key={r.episode.id}>
                    <button
                      type="button"
                      onClick={() => setOpenEpisode(r.episode.id)}
                      className="hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left"
                    >
                      <span>
                        <span className="block font-medium">{r.patient ? fullName(r.patient) : "—"}</span>
                        <span className="text-muted-foreground text-xs">
                          {r.episode.ivfNo} · {r.patient?.prn}
                        </span>
                      </span>
                      <span
                        className={
                          r.balance > 0
                            ? "text-destructive text-lg font-semibold tabular-nums"
                            : "text-success text-lg font-semibold tabular-nums"
                        }
                      >
                        {formatMoney(r.balance)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : lookup.trim().length >= 3 ? (
              <p className="text-muted-foreground mt-3 text-sm">No account matches “{lookup}”.</p>
            ) : null}
          </SectionCard>
          <SectionCard
            title="Accounts"
            description="Click an account to record payments, request refunds and print receipts or statements."
          >
            <DataTable
              data={rows}
              columns={accountColumns}
              searchPlaceholder="Search accounts…"
              exportName="accounts"
              exportTitle="Account balances"
              onRowClick={(r) => setOpenEpisode(r.episode.id)}
              initialSorting={[{ id: "balance", desc: true }]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="aging" className="mt-4 grid gap-4 lg:grid-cols-3">
          <SectionCard title="Aging buckets" description="Outstanding charges by age">
            <SimpleBarChart
              data={AGING_BUCKETS.map((b) => ({ bucket: b, amount: totals[b] }))}
              xKey="bucket"
              money
              series={[{ key: "amount", label: "Outstanding", color: "var(--chart-4)" }]}
            />
          </SectionCard>
          <SectionCard title="Aged debtors" className="lg:col-span-2">
            <DataTable
              data={agingRows}
              columns={agingColumns}
              searchPlaceholder="Search patient…"
              exportName="aging-report"
              exportTitle="Aged debtors"
              onRowClick={(r) => setOpenEpisode(r.episode.id)}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="report" className="mt-4 grid gap-4">
          <SectionCard title="Account report" description="Revenue and collections by date, payer and department">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <DateRangeFields idPrefix="r" from={rFrom} to={rTo} onFromChange={setRFrom} onToChange={setRTo} />
              <Select value={rPayer} onValueChange={setRPayer}>
                <SelectTrigger size="sm" className="w-40" aria-label="Payer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payers</SelectItem>
                  {PayerCategory.options.map((p) => (
                    <SelectItem key={p} value={p}>
                      {humanize(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rDept} onValueChange={setRDept}>
                <SelectTrigger size="sm" className="w-40" aria-label="Department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {["service", "lab", "radiology", "pharmacy"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {humanize(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid content-start gap-3">
                <StatTile
                  label="Charges in period"
                  value={formatMoney(reportCharges.reduce((s, c) => s + c.amount, 0))}
                  hint={`${reportCharges.length} items`}
                />
                <StatTile
                  label="Collections in period"
                  value={formatMoney(reportPayments.reduce((s, p) => s + p.amount, 0))}
                  hint={`${reportPayments.length} receipts`}
                />
              </div>
              <div className="lg:col-span-2">
                <SimpleBarChart data={byDept} xKey="dept" money series={[{ key: "amount", label: "Revenue" }]} />
              </div>
            </div>
            <div className="mt-4">
              <DataTable
                data={reportCharges}
                columns={[
                  {
                    accessorKey: "at",
                    header: "Date",
                    cell: ({ row }) => formatDate(row.original.at),
                    meta: { exportValue: (r) => formatDate(r.at) },
                  },
                  {
                    id: "ivf",
                    header: "IVF no",
                    accessorFn: (c) => episodes.find((e) => e.id === c.episodeId)?.ivfNo ?? "",
                  },
                  { accessorKey: "description", header: "Item" },
                  {
                    accessorKey: "department",
                    header: "Department",
                    cell: ({ row }) => humanize(row.original.department),
                  },
                  { accessorKey: "payer", header: "Payer", cell: ({ row }) => humanize(row.original.payer) },
                  {
                    accessorKey: "amount",
                    header: "Amount",
                    meta: { align: "right" },
                    cell: ({ row }) => formatMoney(row.original.amount),
                  },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: ({ row }) => <StatusChip status={row.original.status} />,
                  },
                ]}
                searchPlaceholder="Search items…"
                exportName={`account-report-${rFrom}-to-${rTo}`}
                exportTitle={`Account report ${formatDate(rFrom)} – ${formatDate(rTo)}`}
              />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="packages" className="mt-4 grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Package pricing"
            description="Bundled IVF, ICSI, FET and IUI prices with instalment plans."
          >
            <div className="grid gap-3">
              <Select value={pkgCode} onValueChange={setPkgCode}>
                <SelectTrigger aria-label="Package">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGES.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Table>
                <TableBody>
                  {pkg?.items.map((code) => (
                    <TableRow key={code}>
                      <TableCell>{catalogItem(code)?.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(catalogItem(code)?.price ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Package total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(pkgTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </SectionCard>
          <SectionCard title="Instalment schedule">
            <div className="mb-3 grid gap-1">
              <Label htmlFor="pkg-start" className="text-xs">
                Treatment start
              </Label>
              <DatePicker
                id="pkg-start"
                className="w-44"
                value={pkgStart}
                onChange={(v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) && setPkgStart(v)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instalment</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((s) => (
                  <TableRow key={s.label}>
                    <TableCell>{s.label}</TableCell>
                    <TableCell>{formatDate(shiftDate(pkgStart, s.dueOffsetDays))}</TableCell>
                    <TableCell className="text-right">{s.percent}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(s.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {canCollect ? (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Select value={pkgEpisode} onValueChange={setPkgEpisode}>
                  <SelectTrigger className="w-72" aria-label="Apply package to episode">
                    <SelectValue placeholder="Choose an open episode…" />
                  </SelectTrigger>
                  <SelectContent>
                    {scoped
                      .filter((e) => e.status !== "closed")
                      .map((e) => {
                        const p = persons.find((x) => x.id === e.patientId);
                        return (
                          <SelectItem key={e.id} value={e.id}>
                            {e.ivfNo} · {p ? fullName(p) : ""}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <ConfirmDialog
                  trigger={
                    <Button disabled={!pkgEpisode}>
                      <PackageOpen aria-hidden="true" /> Apply package
                    </Button>
                  }
                  destructive={false}
                  title={`Apply ${pkg?.name}?`}
                  description={`Raises ${pkg?.items.length} charges totalling ${formatMoney(pkgTotal)} on the selected account.`}
                  confirmLabel="Apply"
                  onConfirm={() => {
                    if (!pkg) return;
                    const ok = run(
                      () => {
                        pkg.items.forEach((code) => placeOrder(pkgEpisode, { catalogCode: code, qty: 1 }));
                        return true;
                      },
                      { success: `${pkg.name} applied` },
                    );
                    if (ok) setOpenEpisode(pkgEpisode);
                  }}
                />
              </div>
            ) : null}
          </SectionCard>
        </TabsContent>

        <TabsContent value="claims" className="mt-4 grid gap-4">
          {canCollect && hmoEpisodes.length > 0 ? (
            <SectionCard title="Submit HMO claim" description="Claims the outstanding HMO-payer charges on an account.">
              <div className="flex flex-wrap gap-2">
                {hmoEpisodes.slice(0, 8).map((e) => {
                  const p = persons.find((x) => x.id === e.patientId);
                  const due = charges
                    .filter((c) => c.episodeId === e.id && c.payer === "hmo" && c.status !== "waived")
                    .reduce((s, c) => s + c.amount - c.paid, 0);
                  return (
                    <Button
                      key={e.id}
                      variant="outline"
                      size="sm"
                      disabled={due <= 0}
                      onClick={() =>
                        run(() => submitClaim(e.id, p?.payer.sponsor ?? "HMO", due), {
                          success: `Claim submitted for ${formatMoney(due)}`,
                        })
                      }
                    >
                      <Send aria-hidden="true" /> {e.ivfNo} · {formatMoney(due)}
                    </Button>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}
          <SectionCard title="HMO claims">
            <DataTable
              data={claimRows}
              columns={claimColumns}
              searchPlaceholder="Search HMO, patient…"
              exportName="hmo-claims"
              exportTitle="HMO claims"
              empty={<EmptyState title="No HMO claims" />}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Sheet open={selectedRow !== undefined} onOpenChange={(o) => (!o ? setOpenEpisode(null) : undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
          {selectedRow ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedRow.patient ? fullName(selectedRow.patient) : selectedRow.episode.ivfNo}
                </SheetTitle>
                <SheetDescription>
                  {selectedRow.episode.ivfNo} · {selectedRow.patient?.prn} · last payment{" "}
                  {formatDateTime(selectedRow.lastPaymentAt)}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <AccountPanel
                  episodeId={selectedRow.episode.id}
                  branchId={selectedRow.episode.branchId}
                  identifiers={[
                    { label: "Patient", value: selectedRow.patient ? fullName(selectedRow.patient) : "—" },
                    { label: "PRN", value: selectedRow.patient?.prn ?? "—" },
                    { label: "IVF no", value: selectedRow.episode.ivfNo },
                    { label: "Payer", value: selectedRow.patient ? humanize(selectedRow.patient.payer.category) : "—" },
                  ]}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
