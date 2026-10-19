"use client";

import Link from "next/link";
import { Banknote, Building2, CircleDollarSign, LifeBuoy, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HospitalsTable, useHospitalRows } from "@/components/platform/hospitals-table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip } from "@/components/shared/status-chip";
import { PRIORITY_TONES } from "@/components/subscription/ticket-thread";
import { PLANS } from "@/lib/schemas/platform";
import { usePlatformStore } from "@/lib/stores/platform";
import { formatDateTime, shiftDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export function PlatformOverview() {
  const rows = useHospitalRows();
  const invoices = usePlatformStore((s) => s.invoices);
  const tickets = usePlatformStore((s) => s.tickets);
  const since = shiftDate(todayIso(), -30);
  const live = rows.filter((r) => r.status !== "suspended");
  const mrr = live.reduce((s, r) => s + PLANS[r.tenant.plan].monthly, 0);
  const subs30 = invoices.filter((i) => i.paidAt.slice(0, 10) >= since).reduce((s, i) => s + i.amount, 0);
  const fees = rows.reduce((s, r) => s + r.fees, 0);
  const volume = rows.reduce((s, r) => s + r.volume, 0);
  const open = tickets
    .filter((t) => t.status === "open" || t.status === "in-progress")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const nameOf = (slug: string) => rows.find((r) => r.tenant.slug === slug)?.tenant.name ?? slug;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every hospital on Overcare, their subscriptions and what the platform earns."
        actions={
          <Button asChild>
            <Link href="/platform/hospitals/new">
              <Plus aria-hidden="true" /> Onboard hospital
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          label="Hospitals"
          value={rows.length}
          icon={Building2}
          hint={`${rows.filter((r) => r.status === "active").length} active · ${rows.filter((r) => r.status !== "active").length} need attention`}
          href="/platform/hospitals"
        />
        <StatTile
          label="Monthly recurring revenue"
          value={formatMoney(mrr)}
          icon={Repeat}
          hint="Subscriptions of hospitals not suspended"
        />
        <StatTile label="Subscriptions paid (30 days)" value={formatMoney(subs30)} icon={CircleDollarSign} />
        <StatTile
          label="Service charges earned"
          value={formatMoney(fees)}
          icon={Banknote}
          tone="rose"
          hint={`on ${formatMoney(volume)} of patient payments`}
        />
        <StatTile label="Open tickets" value={open.length} icon={LifeBuoy} tone="warning" href="/platform/tickets" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <SectionCard title="Hospitals" description="Click a hospital to manage branding, plan, fees and subscription.">
          <HospitalsTable rows={rows} />
        </SectionCard>
        <SectionCard title="Latest open tickets">
          {open.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open tickets. 🎉</p>
          ) : (
            <ul className="grid gap-2">
              {open.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/platform/tickets?ticket=${t.id}`}
                    className="hover:bg-accent block rounded-lg border p-3"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.subject}</span>
                      <StatusChip status={t.priority} tone={PRIORITY_TONES[t.priority]} />
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t.number} · {nameOf(t.tenantSlug)} · {formatDateTime(t.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

export function HospitalsListPage() {
  const rows = useHospitalRows();
  return (
    <>
      <PageHeader
        title="Hospitals"
        description="Each hospital has its own link, branding, data, plan and platform fee."
        actions={
          <Button asChild>
            <Link href="/platform/hospitals/new">
              <Plus aria-hidden="true" /> Onboard hospital
            </Link>
          </Button>
        }
      />
      <SectionCard title={`${rows.length} hospitals`}>
        <HospitalsTable rows={rows} />
      </SectionCard>
    </>
  );
}
