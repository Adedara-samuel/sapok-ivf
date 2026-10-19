"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { NumberField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { gatewayFeesSchema, type GatewayFees, type PlatformAuditEvent } from "@/lib/schemas/platform";
import { usePlatformStore } from "@/lib/stores/platform";
import { formatDateTime } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { gatewayFee } from "@/lib/wallet/fees";

export function PlatformSettings() {
  const run = useRunAction();
  const fees = usePlatformStore((s) => s.gatewayFees);
  const update = usePlatformStore((s) => s.updateGatewayFees);
  const auditLog = usePlatformStore((s) => s.audit);
  const tenants = usePlatformStore((s) => s.tenants);
  const form = useZodForm<GatewayFees>(gatewayFeesSchema, fees);
  const values = form.watch();
  const rows = useMemo(() => [...auditLog].sort((a, b) => b.at.localeCompare(a.at)), [auditLog]);
  const columns: ColumnDef<PlatformAuditEvent, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { accessorKey: "actor", header: "Who" },
    {
      id: "hospital",
      header: "Hospital",
      accessorFn: (r) => tenants.find((t) => t.slug === r.tenantSlug)?.name ?? "—",
    },
    { accessorKey: "summary", header: "What" },
  ];
  const example = (n: number, ch: "bank-transfer" | "card") => {
    try {
      return formatMoney(gatewayFee(n, ch, gatewayFeesSchema.parse(values)));
    } catch {
      return "—";
    }
  };
  return (
    <>
      <PageHeader title="Settings & audit" description="Gateway fee model and everything done in this console." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SectionCard
          title="Gateway fee model"
          description="Used to show hospitals what Paystack keeps. Confirm against Paystack's current pricing before go-live."
        >
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) =>
                run(
                  () => {
                    update(v);
                    return true;
                  },
                  { success: "Fee model saved", setError: form.setError, allowReadOnly: true },
                ),
              )}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  control={form.control}
                  name="transferPercent"
                  label="Transfer fee"
                  suffix="%"
                  step="0.1"
                  required
                />
                <NumberField control={form.control} name="transferCap" label="Transfer cap (₦)" step="50" required />
                <NumberField
                  control={form.control}
                  name="cardPercent"
                  label="Card fee"
                  suffix="%"
                  step="0.1"
                  required
                />
                <NumberField control={form.control} name="cardFlat" label="Card flat fee (₦)" step="50" required />
                <NumberField
                  control={form.control}
                  name="cardFlatWaivedBelow"
                  label="Flat fee waived below (₦)"
                  step="500"
                  required
                />
                <NumberField control={form.control} name="cardCap" label="Card cap (₦)" step="100" required />
              </div>
              <p className="text-muted-foreground text-xs">
                Examples: ₦40,000 transfer → {example(40_000, "bank-transfer")} · ₦2,000 card → {example(2_000, "card")}{" "}
                · ₦500,000 card → {example(500_000, "card")}
              </p>
              <Button type="submit" className="w-fit">
                Save fee model
              </Button>
            </form>
          </Form>
        </SectionCard>
        <SectionCard
          title="Platform audit log"
          description="Onboarding, plan and fee changes, payments, suspensions and support activity."
        >
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder="Search the audit log…"
            exportName="platform-audit"
            exportTitle="Platform audit log"
            empty={<EmptyState title="Nothing recorded yet" />}
          />
        </SectionCard>
      </div>
    </>
  );
}
