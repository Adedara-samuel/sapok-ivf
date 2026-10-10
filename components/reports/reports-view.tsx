"use client";

import { DateRangeFields } from "@/components/shared/date-range-fields";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DonutChart, SimpleAreaChart, SimpleBarChart, SimpleLineChart } from "@/components/charts/lazy";
import { ReportShell } from "@/components/reports/report-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip, humanize } from "@/components/shared/status-chip";
import { useClinicDb } from "@/hooks/use-clinic-db";
import { useCan } from "@/hooks/use-permission";
import { DRUG_SEED } from "@/lib/constants/catalog";
import { EPISODE_TYPE_LABELS, OUTCOME_LABELS } from "@/lib/constants/clinical";
import { fullName } from "@/lib/schemas/person";
import { donorEligibility, surrogateEligibility, type Donor, type Surrogate } from "@/lib/schemas/programme";
import { successRates, type GroupBy, type RateRow } from "@/lib/selectors/analytics";
import { revenueVsCollections, waitingTrend } from "@/lib/selectors/dashboard";
import { patientRows, type PatientRow } from "@/lib/selectors/patients";
import { inBranch, inRange } from "@/lib/selectors/predicates";
import { useSessionStore } from "@/lib/stores/session";
import {
  formatAge,
  formatDate,
  lastMonths,
  monthKey,
  monthLabel,
  minutesBetween,
  shiftDate,
  todayIso,
} from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const REPORTS = [
  { id: "patients", label: "IVF patient report" },
  { id: "open", label: "Open folders" },
  { id: "closed", label: "IVF patient closed" },
  { id: "donors", label: "Donor report" },
  { id: "surrogates", label: "Surrogate report" },
  { id: "success", label: "Success-rate analytics" },
  { id: "volume", label: "Cycle volume" },
  { id: "revenue", label: "Revenue & collections", finance: true },
  { id: "consumption", label: "Pharmacy consumption" },
  { id: "waiting", label: "Waiting time" },
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

const pct = (v: number) => `${v}%`;

export function ReportsView() {
  const router = useRouter();
  const params = useSearchParams();
  const db = useClinicDb();
  const can = useCan();
  const branchId = useSessionStore((s) => s.branchId);
  const today = todayIso();
  const available = REPORTS.filter((r) => !("finance" in r) || can("reports.finance"));
  const tab = (available.find((r) => r.id === params.get("tab"))?.id ?? "patients") as ReportId;
  const [from, setFrom] = useState(shiftDate(today, -365));
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<GroupBy>("ageBand");
  const range = { from: from || undefined, to: to || undefined };
  const setTab = (v: string) => router.replace(`/reports?tab=${v}`, { scroll: false });

  const branchEpisodes = useMemo(() => db.episodes.filter((e) => inBranch(e, branchId)), [db.episodes, branchId]);
  const branchIds = useMemo(() => new Set(branchEpisodes.map((e) => e.id)), [branchEpisodes]);
  const pRows = useMemo(
    () => patientRows(db.persons, branchEpisodes, db.cycles, db.staff).filter((r) => r.branchId === branchId),
    [db, branchEpisodes, branchId],
  );

  const patientColumns: ColumnDef<PatientRow, unknown>[] = [
    { accessorKey: "prn", header: "PRN" },
    { accessorKey: "ivfNo", header: "IVF no" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "partner", header: "Partner" },
    { id: "age", header: "Age", accessorFn: (r) => formatAge(r.dob) },
    { accessorKey: "episodeType", header: "Type" },
    { accessorKey: "stage", header: "Stage" },
    { accessorKey: "doctor", header: "Doctor" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
      meta: { exportValue: (r) => r.status },
    },
  ];
  const patientPrint = [
    { header: "PRN", value: (r: PatientRow) => r.prn },
    { header: "IVF no", value: (r: PatientRow) => r.ivfNo },
    { header: "Name", value: (r: PatientRow) => r.name },
    { header: "Type", value: (r: PatientRow) => r.episodeType },
    { header: "Stage", value: (r: PatientRow) => r.stage },
    { header: "Doctor", value: (r: PatientRow) => r.doctor },
    { header: "Status", value: (r: PatientRow) => r.status },
  ];

  const content = (() => {
    switch (tab) {
      case "patients": {
        const rows = pRows.filter((r) => {
          const ep = branchEpisodes.find((e) => e.ivfNo === r.ivfNo);
          return !ep || inRange(ep.openedAt, range);
        });
        const byType = Object.entries(
          rows.reduce<Record<string, number>>(
            (acc, r) => ({ ...acc, [r.episodeType]: (acc[r.episodeType] ?? 0) + 1 }),
            {},
          ),
        ).map(([name, value]) => ({
          name: name === "—" ? "No episode" : (EPISODE_TYPE_LABELS[name as keyof typeof EPISODE_TYPE_LABELS] ?? name),
          value,
        }));
        return (
          <ReportShell
            id="ivf-patient-report"
            title="IVF patient report"
            description="Patients with episodes opened in the period"
            range={range}
            rows={rows}
            columns={patientColumns}
            printColumns={patientPrint}
            chart={<DonutChart data={byType} />}
          />
        );
      }
      case "open": {
        const rows = pRows.filter((r) => r.status === "open" || r.status === "on-hold");
        const byStage = Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.stage]: (acc[r.stage] ?? 0) + 1 }), {}),
        ).map(([stage, count]) => ({ stage, count }));
        return (
          <ReportShell
            id="open-folders"
            title="Open folders"
            description="Episodes currently open or on hold"
            range={{}}
            rows={rows}
            columns={patientColumns}
            printColumns={patientPrint}
            chart={<SimpleBarChart data={byStage} xKey="stage" series={[{ key: "count", label: "Folders" }]} />}
          />
        );
      }
      case "closed": {
        const closed = branchEpisodes.filter((e) => e.status === "closed" && inRange(e.closedAt, range));
        const rows = closed.map((e) => {
          const p = db.persons.find((x) => x.id === e.patientId);
          return {
            ivfNo: e.ivfNo,
            name: p ? fullName(p) : "—",
            prn: p?.prn ?? "",
            type: EPISODE_TYPE_LABELS[e.type],
            closedAt: e.closedAt ?? "",
            reason: humanize(e.closeReason ?? "other"),
            note: e.closeNote ?? "",
          };
        });
        type R = (typeof rows)[number];
        const byReason = Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {}),
        ).map(([name, value]) => ({ name, value }));
        return (
          <ReportShell<R>
            id="ivf-patient-closed"
            title="IVF patient closed"
            description="Files closed with their outcome"
            range={range}
            rows={rows}
            columns={[
              { accessorKey: "ivfNo", header: "IVF no" },
              { accessorKey: "name", header: "Patient" },
              { accessorKey: "type", header: "Type" },
              { accessorKey: "closedAt", header: "Closed", cell: ({ row }) => formatDate(row.original.closedAt) },
              { accessorKey: "reason", header: "Outcome" },
              { accessorKey: "note", header: "Note" },
            ]}
            printColumns={[
              { header: "IVF no", value: (r) => r.ivfNo },
              { header: "Patient", value: (r) => r.name },
              { header: "Closed", value: (r) => formatDate(r.closedAt) },
              { header: "Outcome", value: (r) => r.reason },
            ]}
            chart={<DonutChart data={byReason} />}
          />
        );
      }
      case "donors": {
        const byStatus = ["screening", "available", "matched", "in-cycle", "retired"].map((s) => ({
          status: humanize(s),
          oocyte: db.donors.filter((d) => d.kind === "oocyte" && d.status === s).length,
          sperm: db.donors.filter((d) => d.kind === "sperm" && d.status === s).length,
        }));
        return (
          <ReportShell<Donor>
            id="donor-report"
            title="Donor report"
            description="Anonymised donor register with eligibility"
            range={{}}
            rows={db.donors}
            columns={[
              { accessorKey: "code", header: "Code" },
              { accessorKey: "kind", header: "Kind", cell: ({ row }) => humanize(row.original.kind) },
              { accessorKey: "age", header: "Age" },
              { accessorKey: "bloodGroup", header: "Blood group" },
              { accessorKey: "complexion", header: "Complexion" },
              { id: "eligibility", header: "Eligibility", accessorFn: (d) => donorEligibility(d) },
              {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => <StatusChip status={row.original.status} />,
              },
              {
                id: "recipient",
                header: "Recipient",
                accessorFn: (d) => db.episodes.find((e) => e.id === d.matchedEpisodeId)?.ivfNo ?? "—",
              },
            ]}
            printColumns={[
              { header: "Code", value: (d) => d.code },
              { header: "Kind", value: (d) => d.kind },
              { header: "Age", value: (d) => d.age },
              { header: "Blood", value: (d) => d.bloodGroup },
              { header: "Eligibility", value: (d) => donorEligibility(d) },
              { header: "Status", value: (d) => d.status },
            ]}
            chart={
              <SimpleBarChart
                data={byStatus}
                xKey="status"
                series={[
                  { key: "oocyte", label: "Oocyte" },
                  { key: "sperm", label: "Sperm" },
                ]}
              />
            }
          />
        );
      }
      case "surrogates": {
        const byStatus = ["screening", "approved", "matched", "pregnant", "delivered", "retired"].map((s) => ({
          status: humanize(s),
          count: db.surrogates.filter((x) => x.status === s).length,
        }));
        return (
          <ReportShell<Surrogate>
            id="surrogate-report"
            title="Surrogate report"
            description="Gestational carriers by status and screening"
            range={{}}
            rows={db.surrogates}
            columns={[
              { accessorKey: "code", header: "Code" },
              { accessorKey: "age", header: "Age" },
              { accessorKey: "parity", header: "Parity" },
              { id: "eligibility", header: "Eligibility", accessorFn: (s) => surrogateEligibility(s) },
              { id: "legal", header: "Legal", accessorFn: (s) => s.screening.legal },
              {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => <StatusChip status={row.original.status} />,
              },
              {
                id: "couple",
                header: "Intending parents",
                accessorFn: (s) => db.episodes.find((e) => e.id === s.matchedEpisodeId)?.ivfNo ?? "—",
              },
            ]}
            printColumns={[
              { header: "Code", value: (s) => s.code },
              { header: "Age", value: (s) => s.age },
              { header: "Eligibility", value: (s) => surrogateEligibility(s) },
              { header: "Status", value: (s) => s.status },
            ]}
            chart={
              <SimpleBarChart
                data={byStatus}
                xKey="status"
                series={[{ key: "count", label: "Surrogates", color: "var(--chart-2)" }]}
              />
            }
          />
        );
      }
      case "success": {
        const rows = successRates(
          { ...db, cycles: db.cycles.filter((c) => branchIds.has(c.episodeId)) },
          groupBy,
          range,
        );
        const overall = successRates(
          { ...db, cycles: db.cycles.filter((c) => branchIds.has(c.episodeId)) },
          "protocol",
          range,
        );
        const total = (k: keyof Omit<RateRow, "group">) => {
          const n = overall.reduce((s, r) => s + r.cycles, 0);
          return n ? Math.round((overall.reduce((s, r) => s + r[k] * r.cycles, 0) / n) * 10) / 10 : 0;
        };
        return (
          <ReportShell<RateRow>
            id={`success-rates-${groupBy}`}
            title="Success-rate analytics"
            description={`Laboratory and clinical KPIs by ${groupBy === "ageBand" ? "age band" : groupBy}`}
            range={range}
            rows={rows}
            summary={
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="group-by" className="text-sm">
                    Group by
                  </Label>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                    <SelectTrigger id="group-by" size="sm" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ageBand">Age band</SelectItem>
                      <SelectItem value="protocol">Protocol</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="embryologist">Embryologist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <StatTile label="Fertilisation" value={pct(total("fertilisation"))} />
                  <StatTile label="Cleavage" value={pct(total("cleavage"))} />
                  <StatTile label="Blastocyst" value={pct(total("blastocyst"))} />
                  <StatTile label="Implantation" value={pct(total("implantation"))} tone="rose" />
                  <StatTile label="Clinical pregnancy" value={pct(total("clinicalPregnancy"))} tone="rose" />
                  <StatTile label="Live birth" value={pct(total("liveBirth"))} tone="rose" />
                </div>
              </div>
            }
            chart={
              <SimpleBarChart
                data={rows}
                xKey="group"
                series={[
                  { key: "fertilisation", label: "Fertilisation %" },
                  { key: "blastocyst", label: "Blastocyst %", color: "var(--chart-3)" },
                  { key: "clinicalPregnancy", label: "Clinical pregnancy %", color: "var(--chart-2)" },
                  { key: "liveBirth", label: "Live birth %", color: "var(--chart-5)" },
                ]}
              />
            }
            columns={[
              { accessorKey: "group", header: groupBy === "ageBand" ? "Age band" : humanize(groupBy) },
              { accessorKey: "cycles", header: "Cycles", meta: { align: "right" } },
              { accessorKey: "fertilisation", header: "Fertilisation %", meta: { align: "right" } },
              { accessorKey: "cleavage", header: "Cleavage %", meta: { align: "right" } },
              { accessorKey: "blastocyst", header: "Blastocyst %", meta: { align: "right" } },
              { accessorKey: "implantation", header: "Implantation %", meta: { align: "right" } },
              { accessorKey: "clinicalPregnancy", header: "Clinical pregnancy %", meta: { align: "right" } },
              { accessorKey: "liveBirth", header: "Live birth %", meta: { align: "right" } },
            ]}
            printColumns={[
              { header: "Group", value: (r) => r.group },
              { header: "Cycles", value: (r) => r.cycles },
              { header: "Fert %", value: (r) => r.fertilisation },
              { header: "Cleav %", value: (r) => r.cleavage },
              { header: "Blast %", value: (r) => r.blastocyst },
              { header: "Impl %", value: (r) => r.implantation },
              { header: "CPR %", value: (r) => r.clinicalPregnancy },
              { header: "LBR %", value: (r) => r.liveBirth },
            ]}
          />
        );
      }
      case "volume": {
        const months = lastMonths(to || today, 12);
        const rows = months.map((m) => {
          const cs = db.cycles.filter((c) => branchIds.has(c.episodeId) && monthKey(c.startDate) === m);
          return {
            month: monthLabel(m),
            fresh: cs.filter((c) => c.kind === "fresh").length,
            frozen: cs.filter((c) => c.kind === "frozen").length,
            cancelled: cs.filter((c) => c.stage === "cancelled").length,
            total: cs.length,
          };
        });
        type R = (typeof rows)[number];
        const outcomes = Object.entries(
          db.cycles
            .filter((c) => branchIds.has(c.episodeId) && inRange(c.startDate, range))
            .reduce<Record<string, number>>(
              (acc, c) => ({ ...acc, [OUTCOME_LABELS[c.outcome]]: (acc[OUTCOME_LABELS[c.outcome]] ?? 0) + 1 }),
              {},
            ),
        ).map(([name, value]) => ({ name, value }));
        return (
          <ReportShell<R>
            id="cycle-volume"
            title="Cycle volume"
            description="Cycles started per month (fresh vs frozen) and outcomes"
            range={range}
            rows={rows}
            chart={
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <SimpleBarChart
                    data={rows}
                    xKey="month"
                    series={[
                      { key: "fresh", label: "Fresh" },
                      { key: "frozen", label: "Frozen", color: "var(--chart-3)" },
                      { key: "cancelled", label: "Cancelled", color: "var(--chart-7)" },
                    ]}
                  />
                </div>
                <DonutChart data={outcomes} />
              </div>
            }
            columns={[
              { accessorKey: "month", header: "Month" },
              { accessorKey: "fresh", header: "Fresh", meta: { align: "right" } },
              { accessorKey: "frozen", header: "Frozen", meta: { align: "right" } },
              { accessorKey: "cancelled", header: "Cancelled", meta: { align: "right" } },
              { accessorKey: "total", header: "Total", meta: { align: "right" } },
            ]}
            printColumns={[
              { header: "Month", value: (r) => r.month },
              { header: "Fresh", value: (r) => r.fresh },
              { header: "Frozen", value: (r) => r.frozen },
              { header: "Cancelled", value: (r) => r.cancelled },
              { header: "Total", value: (r) => r.total },
            ]}
          />
        );
      }
      case "revenue": {
        const rows = revenueVsCollections(db, { branchId, to }, today).map((r) => ({
          ...r,
          gap: r.revenue - r.collections,
        }));
        type R = (typeof rows)[number];
        return (
          <ReportShell<R>
            id="revenue-collections"
            title="Revenue & collections"
            description="Charges raised vs payments received, last 6 months"
            range={{ to }}
            rows={rows}
            chart={
              <SimpleAreaChart
                data={rows}
                xKey="month"
                money
                series={[
                  { key: "revenue", label: "Revenue" },
                  { key: "collections", label: "Collections", color: "var(--chart-2)" },
                ]}
              />
            }
            columns={[
              { accessorKey: "month", header: "Month" },
              {
                accessorKey: "revenue",
                header: "Revenue",
                meta: { align: "right" },
                cell: ({ row }) => formatMoney(row.original.revenue),
              },
              {
                accessorKey: "collections",
                header: "Collections",
                meta: { align: "right" },
                cell: ({ row }) => formatMoney(row.original.collections),
              },
              {
                accessorKey: "gap",
                header: "Gap",
                meta: { align: "right" },
                cell: ({ row }) => formatMoney(row.original.gap),
              },
            ]}
            printColumns={[
              { header: "Month", value: (r) => r.month },
              { header: "Revenue", value: (r) => formatMoney(r.revenue) },
              { header: "Collections", value: (r) => formatMoney(r.collections) },
              { header: "Gap", value: (r) => formatMoney(r.gap) },
            ]}
          />
        );
      }
      case "consumption": {
        const rows = DRUG_SEED.map((d) => {
          const dispensed = db.orders.filter(
            (o) =>
              branchIds.has(o.episodeId) &&
              o.catalogCode === d.code &&
              o.status === "dispensed" &&
              inRange(o.dispensedAt ?? o.at, range),
          );
          const qty = dispensed.reduce((s, o) => s + o.qty, 0);
          return {
            drug: d.name,
            qty,
            value: qty * d.price,
            orders: dispensed.length,
            cancelled: db.orders.filter(
              (o) =>
                branchIds.has(o.episodeId) &&
                o.catalogCode === d.code &&
                o.status === "cancelled" &&
                inRange(o.at, range),
            ).length,
          };
        })
          .filter((r) => r.qty > 0 || r.cancelled > 0)
          .sort((a, b) => b.value - a.value);
        type R = (typeof rows)[number];
        return (
          <ReportShell<R>
            id="pharmacy-consumption"
            title="Pharmacy consumption"
            description="Units dispensed and value by drug"
            range={range}
            rows={rows}
            chart={
              <SimpleBarChart
                data={rows.slice(0, 10)}
                xKey="drug"
                layout="vertical"
                money
                height={320}
                series={[{ key: "value", label: "Value dispensed" }]}
              />
            }
            columns={[
              { accessorKey: "drug", header: "Drug" },
              { accessorKey: "orders", header: "Prescriptions", meta: { align: "right" } },
              { accessorKey: "qty", header: "Units", meta: { align: "right" } },
              {
                accessorKey: "value",
                header: "Value",
                meta: { align: "right" },
                cell: ({ row }) => formatMoney(row.original.value),
              },
              { accessorKey: "cancelled", header: "Cancelled", meta: { align: "right" } },
            ]}
            printColumns={[
              { header: "Drug", value: (r) => r.drug },
              { header: "Units", value: (r) => r.qty },
              { header: "Value", value: (r) => formatMoney(r.value) },
              { header: "Cancelled", value: (r) => r.cancelled },
            ]}
          />
        );
      }
      case "waiting": {
        const trend = waitingTrend(db, { branchId, to }, today, 14);
        const rows = db.waiting
          .filter((w) => inBranch(w, branchId) && w.calledAt && inRange(w.date, range))
          .map((w) => {
            const p = db.persons.find((x) => x.id === w.personId);
            return {
              date: w.date,
              time: w.time,
              patient: p ? fullName(p) : "—",
              purpose: w.purpose,
              doctor: db.staff.find((s) => s.id === w.doctorId)?.name ?? "",
              wait: minutesBetween(w.arrivedAt, w.calledAt ?? w.arrivedAt),
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        type R = (typeof rows)[number];
        const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.wait, 0) / rows.length) : 0;
        return (
          <ReportShell<R>
            id="waiting-time"
            title="Waiting time"
            description="Minutes from arrival to being called"
            range={range}
            rows={rows}
            summary={
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatTile label="Average wait" value={`${avg} min`} />
                <StatTile label="Visits measured" value={rows.length} />
                <StatTile label="Over 30 min" value={rows.filter((r) => r.wait > 30).length} tone="warning" />
              </div>
            }
            chart={
              <SimpleLineChart
                data={trend}
                xKey="day"
                unit=" min"
                series={[{ key: "minutes", label: "Average wait" }]}
              />
            }
            columns={[
              { accessorKey: "date", header: "Date", cell: ({ row }) => formatDate(row.original.date) },
              { accessorKey: "time", header: "Arrived" },
              { accessorKey: "patient", header: "Patient" },
              { accessorKey: "purpose", header: "Purpose" },
              { accessorKey: "doctor", header: "Doctor" },
              { accessorKey: "wait", header: "Wait (min)", meta: { align: "right" } },
            ]}
            printColumns={[
              { header: "Date", value: (r) => formatDate(r.date) },
              { header: "Patient", value: (r) => r.patient },
              { header: "Purpose", value: (r) => r.purpose },
              { header: "Wait", value: (r) => r.wait },
            ]}
          />
        );
      }
    }
  })();

  return (
    <>
      <PageHeader
        title="Reports"
        description="Live figures computed from current records. Every report can be exported to CSV/PDF or printed."
        crumbs={[{ label: "Management" }, { label: "Reports" }]}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <DateRangeFields idPrefix="rep" from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Reports" className="no-print">
          <ul className="grid gap-1">
            {available.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setTab(r.id)}
                  aria-current={tab === r.id ? "page" : undefined}
                  className={
                    tab === r.id
                      ? "bg-primary/10 text-primary w-full rounded-lg px-3 py-2 text-left text-sm font-medium"
                      : "hover:bg-accent text-muted-foreground w-full rounded-lg px-3 py-2 text-left text-sm"
                  }
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{content}</div>
      </div>
    </>
  );
}
