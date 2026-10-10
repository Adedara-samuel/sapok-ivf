"use client";

import { DateRangeFields } from "@/components/shared/date-range-fields";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarDays,
  ClipboardCheck,
  FolderClosed,
  HeartHandshake,
  Pill,
  Snowflake,
  Users,
  UserRoundCheck,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart, SimpleAreaChart, SimpleBarChart, SimpleLineChart } from "@/components/charts/lazy";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip } from "@/components/shared/status-chip";
import { useClinicDb } from "@/hooks/use-clinic-db";
import { useCan } from "@/hooks/use-permission";
import { EPISODE_TYPE_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import { fullName } from "@/lib/schemas/person";
import {
  computeAlerts,
  computeTiles,
  cyclesByStage,
  ivfCollection,
  monthlyRates,
  revenueVsCollections,
  waitingTrend,
  type AlertKind,
  type TileKey,
} from "@/lib/selectors/dashboard";
import { currentCycleFor, inBranch, primaryEpisodeFor } from "@/lib/selectors/predicates";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useClinicalStore } from "@/lib/stores/clinical";
import { formatDate, formatTime, shiftDate, todayIso } from "@/lib/utils/dates";

const TILE_ICONS: Record<TileKey, typeof Users> = {
  frontDesk: UserRoundCheck,
  existingPatients: Users,
  activeCycles: Activity,
  donors: HeartHandshake,
  surrogates: Baby,
  closedFiles: FolderClosed,
  cancelledDrugs: Pill,
  pendingApprovals: ClipboardCheck,
};

const ALERT_ICONS: Record<AlertKind, typeof Users> = {
  cryo: Snowflake,
  "low-stock": Pill,
  expiry: Pill,
  vitals: AlertTriangle,
  critical: FlaskConical,
};

type Preset = "all" | "today" | "30d" | "6m" | "12m" | "custom";

function presetRange(p: Preset, today: string): { from?: string; to?: string } {
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "30d":
      return { from: shiftDate(today, -30), to: today };
    case "6m":
      return { from: shiftDate(today, -182), to: today };
    case "12m":
      return { from: shiftDate(today, -365), to: today };
    default:
      return {};
  }
}

interface ScheduleItem {
  key: string;
  time: string;
  label: string;
  detail: string;
  href: string;
  status: string;
}

export function DashboardView() {
  const db = useClinicDb();
  const can = useCan();
  const stimulation = useClinicalStore((s) => s.stimulation);
  const sessionBranch = useSessionStore((s) => s.branchId);
  const branches = useSettingsStore((s) => s.branches);
  const today = todayIso();
  const [preset, setPreset] = useState<Preset>("all");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const [branchId, setBranchId] = useState<string>(sessionBranch);
  const range = preset === "custom" ? custom : presetRange(preset, today);
  const filters = useMemo(() => ({ branchId, ...range }), [branchId, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = useMemo(() => computeTiles(db, filters, today), [db, filters, today]);
  const waiting = useMemo(() => waitingTrend(db, filters, today), [db, filters, today]);
  const charts = useMemo(
    () => ({
      collection: ivfCollection(db, filters),
      stages: cyclesByStage(db, filters),
      rates: monthlyRates(db, filters, today),
      revenue: revenueVsCollections(db, filters, today),
    }),
    [db, filters, today],
  );
  const alerts = useMemo(() => computeAlerts(db, today, filters), [db, today, filters]);

  const schedule = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = [];
    const ep = (id: string) => db.episodes.find((e) => e.id === id);
    const nameFor = (episodeId: string) => {
      const p = db.persons.find((x) => x.id === ep(episodeId)?.patientId);
      return p ? { name: fullName(p), id: p.id } : { name: "Patient", id: "" };
    };
    db.waiting
      .filter((w) => w.date === today && inBranch(w, branchId))
      .forEach((w) => {
        const p = db.persons.find((x) => x.id === w.personId);
        items.push({
          key: w.id,
          time: w.time,
          label: p ? fullName(p) : "Patient",
          detail: w.purpose,
          href: "/waiting-list",
          status: w.status,
        });
      });
    db.procedures
      .filter((p) => p.date === today)
      .forEach((p) => {
        const cyc = db.cycles.find((c) => c.id === p.cycleId);
        if (!cyc || !inBranch(ep(cyc.episodeId) ?? { branchId: "" }, branchId)) return;
        const who = nameFor(cyc.episodeId);
        items.push({
          key: p.id,
          time: p.time,
          label: who.name,
          detail: `${p.type} procedure`,
          href: `/patients/${who.id}?tab=procedures`,
          status: p.status,
        });
      });
    db.cycles.forEach((c) => {
      const e = ep(c.episodeId);
      if (!e || e.status === "closed" || !inBranch(e, branchId)) return;
      const who = nameFor(c.episodeId);
      if (c.trigger?.date === today && c.stage !== "completed" && c.stage !== "cancelled")
        items.push({
          key: `${c.id}-trig`,
          time: c.trigger.time,
          label: who.name,
          detail: `Trigger: ${c.trigger.drug}`,
          href: `/patients/${who.id}/cycles/${c.id}`,
          status: "pending",
        });
      if (c.transferPlan?.date === today && c.stage === "transfer")
        items.push({
          key: `${c.id}-et`,
          time: "11:00",
          label: who.name,
          detail: `Embryo transfer (${c.transferPlan.embryoIds.length})`,
          href: `/patients/${who.id}/cycles/${c.id}`,
          status: "pending",
        });
      if (c.betaHcg?.date === today && c.betaHcg.value === undefined)
        items.push({
          key: `${c.id}-bhcg`,
          time: "08:00",
          label: who.name,
          detail: "Beta-hCG due",
          href: `/patients/${who.id}/cycles/${c.id}`,
          status: "pending",
        });
    });
    stimulation
      .filter((s) => s.nextScan === today)
      .forEach((s) => {
        const c = db.cycles.find((x) => x.id === s.cycleId);
        const e = c ? ep(c.episodeId) : undefined;
        if (!c || !e || !inBranch(e, branchId)) return;
        const who = nameFor(c.episodeId);
        items.push({
          key: `${s.id}-scan`,
          time: "09:00",
          label: who.name,
          detail: "Follicular scan due",
          href: `/patients/${who.id}/cycles/${c.id}`,
          status: "pending",
        });
      });
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [db, stimulation, today, branchId]);

  const recent = useMemo(
    () =>
      db.persons
        .filter((p) => p.roles.includes("patient") && inBranch(p, branchId))
        .map((p) => ({ p, ep: primaryEpisodeFor(p.id, db.episodes) }))
        .sort((a, b) => (b.ep?.openedAt ?? b.p.createdAt).localeCompare(a.ep?.openedAt ?? a.p.createdAt))
        .slice(0, 8),
    [db, branchId],
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${branchId === "all" ? "all branches" : (branches.find((b) => b.id === branchId)?.name ?? branchId)} · ${formatDate(today)}`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="dash-range" className="text-xs">
                Date range
              </Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger id="dash-range" size="sm" className="w-40">
                  <CalendarDays aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="6m">Last 6 months</SelectItem>
                  <SelectItem value="12m">Last 12 months</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" ? (
              <>
                <DateRangeFields
                  idPrefix="dash"
                  from={custom.from}
                  to={custom.to}
                  onFromChange={(v) => setCustom((c) => ({ ...c, from: v || undefined }))}
                  onToChange={(v) => setCustom((c) => ({ ...c, to: v || undefined }))}
                />
              </>
            ) : null}
            {branches.length > 1 ? (
              <div className="grid gap-1">
                <Label htmlFor="dash-branch" className="text-xs">
                  Branch
                </Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger id="dash-branch" size="sm" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        }
      />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            label={t.label}
            value={t.value}
            hint={t.hint}
            href={t.href}
            icon={TILE_ICONS[t.key]}
            tone={
              t.key === "cancelledDrugs" ? "warning" : t.key === "surrogates" || t.key === "donors" ? "rose" : "primary"
            }
            trend={t.key === "frontDesk" ? waiting.map((w) => w.visits) : undefined}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3" aria-label="Charts">
        <SectionCard title="IVF collection" description="Episodes by treatment type">
          {charts.collection.length ? (
            <DonutChart data={charts.collection} />
          ) : (
            <EmptyState title="No episodes in this range" />
          )}
        </SectionCard>
        <SectionCard title="Active cycles by stage" className="lg:col-span-2">
          {charts.stages.length ? (
            <SimpleBarChart data={charts.stages} xKey="stage" series={[{ key: "count", label: "Cycles" }]} />
          ) : (
            <EmptyState title="No active cycles" />
          )}
        </SectionCard>
        <SectionCard
          title="Pregnancy & live-birth rates"
          description="Per transfer with a known outcome, last 12 months"
          className="lg:col-span-2"
        >
          <SimpleLineChart
            data={charts.rates}
            xKey="month"
            unit="%"
            yDomain={[0, 100]}
            series={[
              { key: "pregnancyRate", label: "Clinical pregnancy", color: "var(--chart-2)" },
              { key: "liveBirthRate", label: "Live birth", color: "var(--chart-1)" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Waiting time" description="Average minutes from arrival to being called (14 days)">
          <SimpleBarChart
            data={waiting}
            xKey="day"
            series={[{ key: "minutes", label: "Avg wait (min)", color: "var(--chart-4)" }]}
          />
        </SectionCard>
        {can("reports.finance") || can("billing.view") ? (
          <SectionCard title="Revenue vs collections" description="Last 6 months" className="lg:col-span-3">
            <SimpleAreaChart
              data={charts.revenue}
              xKey="month"
              money
              series={[
                { key: "revenue", label: "Revenue (charges)" },
                { key: "collections", label: "Collections (payments)", color: "var(--chart-2)" },
              ]}
            />
          </SectionCard>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Today's schedule" description={`${schedule.length} item(s)`}>
          {schedule.length === 0 ? (
            <EmptyState
              title="Nothing scheduled today"
              description="Add patients from the waiting list to get started."
              action={
                <Button asChild size="sm">
                  <Link href="/waiting-list">Open waiting list</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid max-h-96 gap-1 overflow-y-auto">
              {schedule.map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="hover:bg-accent flex items-center gap-3 rounded-lg p-2">
                    <span className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums">{s.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.label}</span>
                      <span className="text-muted-foreground block truncate text-xs">{s.detail}</span>
                    </span>
                    <StatusChip status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Alerts" description="Cryo consents, stock, expiring drugs, vitals, critical results">
          {alerts.length === 0 ? (
            <EmptyState title="No alerts" description="Everything is within range." />
          ) : (
            <ul className="grid max-h-96 gap-1 overflow-y-auto">
              {alerts.map((a) => {
                const Icon = ALERT_ICONS[a.kind];
                return (
                  <li key={a.id}>
                    <Link href={a.href} className="hover:bg-accent flex gap-3 rounded-lg p-2">
                      <Icon
                        className={
                          a.severity === "critical"
                            ? "text-destructive mt-0.5 size-4 shrink-0"
                            : "text-warning mt-0.5 size-4 shrink-0"
                        }
                        aria-hidden="true"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          {a.title}{" "}
                          <StatusChip
                            status={a.severity === "critical" ? "critical" : "pending"}
                            label={a.severity === "critical" ? "Critical" : "Warning"}
                          />
                        </span>
                        <span className="text-muted-foreground block text-xs">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent patients" contentClassName="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Patient</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map(({ p, ep }) => {
                  const cyc = ep ? currentCycleFor(ep.id, db.cycles) : undefined;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">
                        <span className="block font-medium">{fullName(p)}</span>
                        <span className="text-muted-foreground text-xs">{p.prn}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block text-sm">{ep ? EPISODE_TYPE_LABELS[ep.type] : "Registered"}</span>
                        <span className="text-muted-foreground text-xs">
                          {cyc ? STAGE_LABELS[cyc.stage] : ep ? ep.ivfNo : formatTime(p.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/patients/${p.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </section>
    </>
  );
}
