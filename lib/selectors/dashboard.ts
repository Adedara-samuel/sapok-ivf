import { EPISODE_TYPE_LABELS, STAGE_LABELS } from "@/lib/constants/clinical";
import { DRUG_SEED } from "@/lib/constants/catalog";
import { PREGNANT_OUTCOMES, type CycleStage } from "@/lib/schemas/cycle";
import { vitalFlags, VITAL_RANGES } from "@/lib/schemas/clinical";
import { positionCode } from "@/lib/schemas/embryology";
import {
  inBranch,
  inRange,
  isActiveTreatmentCycle,
  isCancelledDrug,
  isClosedEpisode,
  isPatient,
  isTodayPosting,
} from "@/lib/selectors/predicates";
import type { ClinicDb, DateRange } from "@/lib/selectors/types";
import { availableStock } from "@/lib/selectors/stock";
import { lastMonths, minutesBetween, monthKey, monthLabel, shiftDate, formatDate } from "@/lib/utils/dates";
import { percent } from "@/lib/utils/money";

export interface DashboardFilters extends DateRange {
  branchId: string;
}

export type TileKey =
  | "frontDesk"
  | "existingPatients"
  | "activeCycles"
  | "donors"
  | "surrogates"
  | "closedFiles"
  | "cancelledDrugs"
  | "pendingApprovals";

export interface Tile {
  key: TileKey;
  label: string;
  value: number;
  href: string;
  hint: string;
}

function rangeQuery(range: DateRange): string {
  const p = new URLSearchParams();
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  const s = p.toString();
  return s ? `&${s}` : "";
}

function withBranch(href: string, branchId: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}branch=${encodeURIComponent(branchId || "all")}`;
}

export function scopedEpisodes(db: Pick<ClinicDb, "episodes">, branchId: string) {
  return db.episodes.filter((e) => inBranch(e, branchId));
}

export function computeTiles(db: ClinicDb, f: DashboardFilters, today: string): Tile[] {
  const episodes = scopedEpisodes(db, f.branchId);
  const episodeIds = new Set(episodes.map((e) => e.id));
  const byId = new Map(db.episodes.map((e) => [e.id, e]));
  const range: DateRange = { from: f.from, to: f.to };
  return [
    {
      key: "frontDesk",
      label: "Front-desk postings today",
      value: db.waiting.filter((w) => inBranch(w, f.branchId) && isTodayPosting(w, today)).length,
      href: withBranch("/waiting-list", f.branchId),
      hint: "Visits added to today's waiting list",
    },
    {
      key: "existingPatients",
      label: "Existing patients",
      value: db.persons.filter((p) => isPatient(p) && inBranch(p, f.branchId)).length,
      href: withBranch("/patients", f.branchId),
      hint: "Registered female patients",
    },
    {
      key: "activeCycles",
      label: "Active cycles",
      value: db.cycles.filter((c) => episodeIds.has(c.episodeId) && isActiveTreatmentCycle(c, byId)).length,
      href: withBranch("/patients?view=active-cycles", f.branchId),
      hint: "Cycles not yet completed or cancelled",
    },
    { key: "donors", label: "Donors", value: db.donors.length, href: "/donors", hint: "Oocyte and sperm donors" },
    {
      key: "surrogates",
      label: "Surrogates",
      value: db.surrogates.length,
      href: "/surrogates",
      hint: "Gestational carriers",
    },
    {
      key: "closedFiles",
      label: "Closed files",
      value: episodes.filter((e) => isClosedEpisode(e, range)).length,
      href: withBranch(`/patients?status=closed${rangeQuery(range)}`, f.branchId),
      hint: "Episodes closed with an outcome",
    },
    {
      key: "cancelledDrugs",
      label: "Cancelled drugs",
      value: db.orders.filter((o) => episodeIds.has(o.episodeId) && isCancelledDrug(o, range)).length,
      href: withBranch(`/pharmacy?tab=cancelled${rangeQuery(range)}`, f.branchId),
      hint: "Pharmacy orders cancelled with a reason",
    },
    {
      key: "pendingApprovals",
      label: "Pending approvals",
      value: db.requests.filter((r) => r.status === "pending").length,
      href: "/requests?tab=approvals",
      hint: "Staff requests awaiting a decision",
    },
  ];
}

export function ivfCollection(db: ClinicDb, f: DashboardFilters) {
  const counts = new Map<string, number>();
  scopedEpisodes(db, f.branchId)
    .filter((e) => inRange(e.openedAt, f))
    .forEach((e) => counts.set(e.type, (counts.get(e.type) ?? 0) + 1));
  return [...counts.entries()].map(([type, value]) => ({
    name: EPISODE_TYPE_LABELS[type as keyof typeof EPISODE_TYPE_LABELS] ?? type,
    value,
  }));
}

export function cyclesByStage(db: ClinicDb, f: DashboardFilters) {
  const episodes = scopedEpisodes(db, f.branchId);
  const ids = new Set(episodes.map((e) => e.id));
  const byId = new Map(db.episodes.map((e) => [e.id, e]));
  const counts = new Map<CycleStage, number>();
  db.cycles
    .filter((c) => ids.has(c.episodeId) && isActiveTreatmentCycle(c, byId))
    .forEach((c) => counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1));
  return (Object.keys(STAGE_LABELS) as CycleStage[])
    .filter((s) => counts.has(s))
    .map((s) => ({ stage: STAGE_LABELS[s], count: counts.get(s) ?? 0 }));
}

/** Transfer cycles with a decided outcome, grouped by transfer month. */
export function monthlyRates(db: ClinicDb, f: DashboardFilters, today: string) {
  const ids = new Set(scopedEpisodes(db, f.branchId).map((e) => e.id));
  const months = lastMonths(f.to ?? today, 12);
  return months.map((m) => {
    const transfers = db.cycles.filter(
      (c) =>
        ids.has(c.episodeId) &&
        c.transferPlan &&
        c.transferPlan.embryoIds.length > 0 &&
        monthKey(c.transferPlan.date) === m &&
        c.outcome !== "pending" &&
        c.outcome !== "cancelled",
    );
    const pregnant = transfers.filter((c) => PREGNANT_OUTCOMES.includes(c.outcome)).length;
    const live = transfers.filter((c) => c.outcome === "live-birth").length;
    return {
      month: monthLabel(m),
      transfers: transfers.length,
      pregnancyRate: transfers.length ? percent(pregnant, transfers.length) : null,
      liveBirthRate: transfers.length ? percent(live, transfers.length) : null,
    };
  });
}

export function revenueVsCollections(db: ClinicDb, f: DashboardFilters, today: string) {
  const ids = new Set(scopedEpisodes(db, f.branchId).map((e) => e.id));
  return lastMonths(f.to ?? today, 6).map((m) => ({
    month: monthLabel(m),
    revenue: db.charges
      .filter((c) => ids.has(c.episodeId) && c.status !== "waived" && monthKey(c.at) === m)
      .reduce((s, c) => s + c.amount, 0),
    collections: db.payments
      .filter((p) => ids.has(p.episodeId) && monthKey(p.at) === m)
      .reduce((s, p) => s + p.amount, 0),
  }));
}

export function waitingTrend(db: ClinicDb, f: DashboardFilters, today: string, days = 14) {
  const end = f.to && f.to < today ? f.to : today;
  return Array.from({ length: days }, (_, i) => shiftDate(end, i - days + 1)).map((d) => {
    const seen = db.waiting.filter((w) => inBranch(w, f.branchId) && w.date === d && w.calledAt);
    const avg = seen.length
      ? Math.round(seen.reduce((s, w) => s + minutesBetween(w.arrivedAt, w.calledAt ?? w.arrivedAt), 0) / seen.length)
      : 0;
    return { day: formatDate(d).slice(0, 5), minutes: avg, visits: seen.length };
  });
}

export type AlertKind = "cryo" | "low-stock" | "expiry" | "vitals" | "critical";
export interface Alert {
  id: string;
  kind: AlertKind;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export function computeAlerts(db: ClinicDb, today: string, f: Partial<DashboardFilters> = {}): Alert[] {
  const alerts: Alert[] = [];
  const branchEpisodes = new Set(db.episodes.filter((e) => inBranch(e, f.branchId)).map((e) => e.id));
  db.storage
    .filter((p) => p.consentExpiry <= shiftDate(today, 45))
    .sort((a, b) => a.consentExpiry.localeCompare(b.consentExpiry))
    .forEach((p) =>
      alerts.push({
        id: `cryo-${p.id}`,
        kind: "cryo",
        severity: p.consentExpiry < today ? "critical" : "warning",
        title: p.consentExpiry < today ? "Storage consent expired" : "Storage consent expiring",
        detail: `${p.label} · ${positionCode(p)} · ${p.consentExpiry < today ? "expired" : "expires"} ${formatDate(p.consentExpiry)}`,
        href: `/embryology?tab=cryo&q=${encodeURIComponent(positionCode(p))}`,
      }),
    );
  DRUG_SEED.forEach((d) => {
    const stock = availableStock(db.batches, d.code, today);
    if (stock < d.reorderLevel)
      alerts.push({
        id: `low-${d.code}`,
        kind: "low-stock",
        severity: stock === 0 ? "critical" : "warning",
        title: "Low stock",
        detail: `${d.name}: ${stock} left (reorder at ${d.reorderLevel})`,
        href: "/pharmacy?tab=stock",
      });
  });
  db.batches
    .filter((b) => b.qty > 0 && b.expiry <= shiftDate(today, 60))
    .forEach((b) => {
      const name = DRUG_SEED.find((d) => d.code === b.code)?.name ?? b.code;
      alerts.push({
        id: `exp-${b.id}`,
        kind: "expiry",
        severity: b.expiry < today ? "critical" : "warning",
        title: b.expiry < today ? "Expired batch in stock" : "Batch expiring soon",
        detail: `${name} · batch ${b.batchNo} · ${b.qty} units · ${formatDate(b.expiry)}`,
        href: "/pharmacy?tab=stock",
      });
    });
  db.vitals
    .filter((v) => branchEpisodes.has(v.episodeId) && v.at.slice(0, 10) >= shiftDate(today, -14))
    .forEach((v) => {
      const flags = vitalFlags(v);
      if (flags.length === 0) return;
      const ep = db.episodes.find((e) => e.id === v.episodeId);
      const patient = db.persons.find((p) => p.id === ep?.patientId);
      alerts.push({
        id: `vit-${v.id}`,
        kind: "vitals",
        severity: "warning",
        title: "Out-of-range vitals",
        detail: `${patient ? `${patient.firstName} ${patient.lastName}` : "Patient"} (${v.phase}): ${flags.map((k) => `${VITAL_RANGES[k].label} ${k === "bpSys" || k === "bpDia" ? `${v.bpSys}/${v.bpDia}` : v[k]}`).join(", ")}`,
        href: patient ? `/patients/${patient.id}?tab=vitals` : "/patients",
      });
    });
  db.orders
    .filter(
      (o) =>
        o.critical &&
        o.status === "resulted" &&
        branchEpisodes.has(o.episodeId) &&
        (o.resultedAt ?? o.at).slice(0, 10) >= shiftDate(today, -7),
    )
    .forEach((o) => {
      const ep = db.episodes.find((e) => e.id === o.episodeId);
      const patient = db.persons.find((p) => p.id === ep?.patientId);
      alerts.push({
        id: `crit-${o.id}`,
        kind: "critical",
        severity: "critical",
        title: "Critical result",
        detail: `${patient ? `${patient.firstName} ${patient.lastName}` : ""}: ${o.resultText ?? o.name}`,
        href: patient ? `/patients/${patient.id}?tab=investigations` : "/patients",
      });
    });
  const order: Record<Alert["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
