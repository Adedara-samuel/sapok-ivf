import type { Charge, Payment, Refund } from "@/lib/schemas/billing";
import type { Episode } from "@/lib/schemas/episode";
import type { Person } from "@/lib/schemas/person";
import { daysBetween } from "@/lib/utils/dates";

export const AGING_BUCKETS = ["0–30 days", "31–60 days", "61–90 days", "90+ days"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(chargeDate: string, today: string): AgingBucket {
  const age = daysBetween(chargeDate, today);
  if (age <= 30) return "0–30 days";
  if (age <= 60) return "31–60 days";
  if (age <= 90) return "61–90 days";
  return "90+ days";
}

export interface AccountRow {
  episode: Episode;
  patient: Person | undefined;
  charged: number;
  paid: number;
  refunded: number;
  balance: number;
  outstandingByBucket: Record<AgingBucket, number>;
  lastPaymentAt?: string;
}

export function accountRows(
  episodes: readonly Episode[],
  persons: readonly Person[],
  charges: readonly Charge[],
  payments: readonly Payment[],
  refunds: readonly Refund[],
  today: string,
): AccountRow[] {
  const personMap = new Map(persons.map((p) => [p.id, p]));
  return episodes.map((episode) => {
    const ch = charges.filter((c) => c.episodeId === episode.id && c.status !== "waived");
    const pay = payments.filter((p) => p.episodeId === episode.id);
    const refunded = refunds
      .filter((r) => r.episodeId === episode.id && r.status === "approved")
      .reduce((s, r) => s + r.amount, 0);
    const charged = ch.reduce((s, c) => s + c.amount, 0);
    const paid = pay.reduce((s, p) => s + p.amount, 0);
    const outstandingByBucket = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
    ch.forEach((c) => {
      const due = c.amount - c.paid;
      if (due > 0) outstandingByBucket[agingBucket(c.at.slice(0, 10), today)] += due;
    });
    const last = [...pay].sort((a, b) => b.at.localeCompare(a.at))[0];
    return {
      episode,
      patient: personMap.get(episode.patientId),
      charged,
      paid,
      refunded,
      balance: charged - paid + refunded,
      outstandingByBucket,
      lastPaymentAt: last?.at,
    };
  });
}

export function agingTotals(rows: readonly AccountRow[]): Record<AgingBucket, number> {
  const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  rows.forEach((r) => AGING_BUCKETS.forEach((b) => (totals[b] += r.outstandingByBucket[b])));
  return totals;
}

export interface InstalmentLine {
  label: string;
  percent: number;
  amount: number;
  dueOffsetDays: number;
}

export function instalmentSchedule(total: number, split: readonly number[]): InstalmentLine[] {
  const labels = ["On commencement", "At oocyte retrieval", "At embryo transfer", "Final"];
  let allocated = 0;
  return split.map((pct, i) => {
    const amount = i === split.length - 1 ? total - allocated : Math.round((total * pct) / 100 / 100) * 100;
    allocated += amount;
    return {
      label: labels[i] ?? `Instalment ${i + 1}`,
      percent: pct,
      amount,
      dueOffsetDays: [0, 12, 17, 30][i] ?? i * 14,
    };
  });
}
