"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { PLANS, type SubscriptionStatus, type Tenant } from "@/lib/schemas/platform";
import { tenantMoney } from "@/lib/platform/revenue";
import { effectiveStatus, STATUS_LABELS } from "@/lib/platform/subscription";
import { usePlatformStore } from "@/lib/stores/platform";
import { formatDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export const STATUS_TONES: Record<SubscriptionStatus, "done" | "waiting" | "critical"> = {
  active: "done",
  grace: "waiting",
  "read-only": "critical",
  suspended: "critical",
};

export interface HospitalRow {
  tenant: Tenant;
  status: SubscriptionStatus;
  fees: number;
  volume: number;
  accounts: number;
  opened: boolean;
  openTickets: number;
}

export function useHospitalRows(): HospitalRow[] {
  const tenants = usePlatformStore((s) => s.tenants);
  const tickets = usePlatformStore((s) => s.tickets);
  return useMemo(() => {
    const today = todayIso();
    return tenants.map((t) => {
      const money = tenantMoney(t.slug);
      return {
        tenant: t,
        status: effectiveStatus(t, today),
        fees: money.platformFees,
        volume: money.gross,
        accounts: money.accounts,
        opened: money.opened,
        openTickets: tickets.filter(
          (k) => k.tenantSlug === t.slug && (k.status === "open" || k.status === "in-progress"),
        ).length,
      };
    });
  }, [tenants, tickets]);
}

export function TenantMark({ tenant, size = "size-8" }: { tenant: Tenant; size?: string }) {
  return tenant.logoDataUrl ? (
    <img src={tenant.logoDataUrl} alt="" className={`${size} shrink-0 rounded-full border object-contain`} />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ background: tenant.primaryColor }}
      aria-hidden="true"
    >
      {tenant.shortName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function HospitalsTable({ rows }: { rows: HospitalRow[] }) {
  const router = useRouter();
  const columns: ColumnDef<HospitalRow, unknown>[] = [
    {
      id: "name",
      header: "Hospital",
      accessorFn: (r) => r.tenant.name,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <TenantMark tenant={row.original.tenant} />
          <span>
            <span className="block font-medium">{row.original.tenant.name}</span>
            <span className="text-muted-foreground text-xs">/h/{row.original.tenant.slug}</span>
          </span>
        </span>
      ),
    },
    { id: "plan", header: "Plan", accessorFn: (r) => PLANS[r.tenant.plan].label },
    {
      accessorKey: "status",
      header: "Subscription",
      cell: ({ row }) => (
        <StatusChip
          status={row.original.status}
          tone={STATUS_TONES[row.original.status]}
          label={STATUS_LABELS[row.original.status]}
        />
      ),
    },
    {
      id: "paid",
      header: "Paid until",
      accessorFn: (r) => r.tenant.paidUntil,
      cell: ({ row }) => formatDate(row.original.tenant.paidUntil),
    },
    {
      id: "fee",
      header: "Fee",
      accessorFn: (r) => r.tenant.feePercent,
      cell: ({ row }) =>
        `${row.original.tenant.feePercent}%${row.original.tenant.feeCap ? ` (max ${formatMoney(row.original.tenant.feeCap)})` : ""}`,
    },
    {
      accessorKey: "volume",
      header: "Patient payments",
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.opened ? (
          formatMoney(row.original.volume)
        ) : (
          <span className="text-muted-foreground text-xs">not opened yet</span>
        ),
    },
    {
      accessorKey: "fees",
      header: "Fees earned",
      meta: { align: "right" },
      cell: ({ row }) => <strong className="tabular-nums">{formatMoney(row.original.fees)}</strong>,
    },
    { accessorKey: "openTickets", header: "Open tickets", meta: { align: "right" } },
  ];
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Search hospitals…"
      exportName="hospitals"
      exportTitle="Hospitals on the platform"
      onRowClick={(r) => router.push(`/platform/hospitals/${r.tenant.slug}`)}
      empty={<EmptyState icon={Building2} title="No hospitals yet" description="Onboard your first hospital." />}
    />
  );
}
