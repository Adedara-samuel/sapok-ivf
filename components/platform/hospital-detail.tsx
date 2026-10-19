"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Building2, CalendarClock, CircleDollarSign, ExternalLink, PlayCircle, Trash2 } from "lucide-react";
import { CheckboxField, NumberField, SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandFields, CopyHospitalLink } from "@/components/admin/branding-panel";
import { STATUS_TONES, TenantMark } from "@/components/platform/hospitals-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusChip } from "@/components/shared/status-chip";
import { TICKET_TONES } from "@/components/subscription/ticket-thread";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import {
  brandingSchema,
  NIGERIAN_BANKS,
  Plan,
  PLANS,
  settlementAccountSchema,
  type Branding,
  type SettlementAccount,
  type SubscriptionInvoice,
  type Tenant,
} from "@/lib/schemas/platform";
import type { Settlement } from "@/lib/schemas/wallet";
import { tenantMoney } from "@/lib/platform/revenue";
import { daysLate, effectiveStatus, STATUS_LABELS } from "@/lib/platform/subscription";
import { tenantSettingsSchema, usePlatformStore, type TenantSettingsInput } from "@/lib/stores/platform";
import { DEFAULT_TENANT } from "@/lib/tenancy";
import { formatDate, formatDateTime, shiftDate, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

function BrandingCard({ tenant }: { tenant: Tenant }) {
  const run = useRunAction();
  const update = usePlatformStore((s) => s.updateBranding);
  const form = useZodForm<Branding>(brandingSchema, {
    name: tenant.name,
    shortName: tenant.shortName,
    tagline: tenant.tagline,
    primaryColor: tenant.primaryColor,
    logoDataUrl: tenant.logoDataUrl,
    address: tenant.address,
    city: tenant.city,
    phone: tenant.phone,
    email: tenant.email,
  });
  const values = form.watch();
  return (
    <SectionCard title="Branding" description="Name, logo and colour the hospital's staff see.">
      <Form {...form}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            run(() => update(tenant.slug, v, "Super admin"), {
              success: "Branding saved",
              setError: form.setError,
              allowReadOnly: true,
            }),
          )}
        >
          <BrandFields
            logo={values.logoDataUrl}
            color={values.primaryColor}
            onLogo={(d) => form.setValue("logoDataUrl", d, { shouldDirty: true })}
            onColor={(c) => form.setValue("primaryColor", c, { shouldDirty: true, shouldValidate: true })}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField control={form.control} name="name" label="Hospital name" required />
            <TextField control={form.control} name="shortName" label="Short name" required />
            <TextField control={form.control} name="tagline" label="Tagline" />
            <TextField control={form.control} name="address" label="Address" required className="sm:col-span-2" />
            <TextField control={form.control} name="city" label="City" required />
            <TextField control={form.control} name="phone" label="Phone" type="tel" required />
            <TextField control={form.control} name="email" label="Email" type="email" required />
          </div>
          <Button type="submit" className="w-fit">
            Save branding
          </Button>
        </form>
      </Form>
    </SectionCard>
  );
}

function PlanCard({ tenant }: { tenant: Tenant }) {
  const run = useRunAction();
  const update = usePlatformStore((s) => s.updateSettings);
  const form = useZodForm<TenantSettingsInput>(tenantSettingsSchema, {
    plan: tenant.plan,
    feePercent: tenant.feePercent,
    feeCap: tenant.feeCap,
    aiEnabled: tenant.aiEnabled,
  });
  return (
    <SectionCard title="Plan & platform fee" description="Your service charge applies to future patient payments only.">
      <Form {...form}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            run(() => update(tenant.slug, v), {
              success: "Plan & fee saved",
              setError: form.setError,
              allowReadOnly: true,
            }),
          )}
        >
          <SelectField
            control={form.control}
            name="plan"
            label="Plan"
            required
            options={Plan.options.map((p) => ({
              value: p,
              label: `${PLANS[p].label} — ${formatMoney(PLANS[p].monthly)}/mo`,
            }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              control={form.control}
              name="feePercent"
              label="Service charge"
              suffix="%"
              step="0.05"
              min={0}
              max={10}
              required
            />
            <NumberField
              control={form.control}
              name="feeCap"
              label="Cap per payment (₦, 0 = none)"
              step="500"
              min={0}
            />
          </div>
          <CheckboxField control={form.control} name="aiEnabled" label="AI assistant enabled" />
          <Button type="submit" className="w-fit">
            Save
          </Button>
        </form>
      </Form>
    </SectionCard>
  );
}

function SettlementCard({ tenant }: { tenant: Tenant }) {
  const run = useRunAction();
  const update = usePlatformStore((s) => s.updateSettlement);
  const form = useZodForm<SettlementAccount>(settlementAccountSchema, tenant.settlement);
  return (
    <SectionCard title="Settlement account" description={`Paystack subaccount ${tenant.subaccountCode}`}>
      <Form {...form}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) =>
            run(() => update(tenant.slug, v), {
              success: "Settlement account changed",
              setError: form.setError,
              allowReadOnly: true,
            }),
          )}
        >
          <SelectField
            control={form.control}
            name="bankName"
            label="Bank"
            required
            options={NIGERIAN_BANKS.map((b) => ({ value: b, label: b }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="accountNumber" label="Account number" required />
            <TextField control={form.control} name="accountName" label="Account name" required />
          </div>
          <Button type="submit" className="w-fit">
            Save
          </Button>
        </form>
      </Form>
    </SectionCard>
  );
}

function SubscriptionCard({ tenant }: { tenant: Tenant }) {
  const run = useRunAction();
  const pay = usePlatformStore((s) => s.paySubscription);
  const setSuspended = usePlatformStore((s) => s.setSuspended);
  const setPaidUntil = usePlatformStore((s) => s.setPaidUntil);
  const [months, setMonths] = useState("1");
  const today = todayIso();
  const status = effectiveStatus(tenant, today);
  return (
    <SectionCard title="Subscription" description="Status follows the paid-up date automatically.">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={status} tone={STATUS_TONES[status]} label={STATUS_LABELS[status]} />
          <span className="text-sm">
            Paid until <strong>{formatDate(tenant.paidUntil)}</strong>
            {daysLate(tenant, today) > 0 ? ` · ${daysLate(tenant, today)} days late` : ""}
          </span>
          {tenant.suspended ? (
            <span className="text-destructive text-sm">Suspended: {tenant.suspendReason}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="rec-months" className="text-xs">
              Record an offline payment
            </Label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger id="rec-months" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "3", "6", "12"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} month{m === "1" ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              run(
                () =>
                  pay(tenant.slug, { months: Number(months), method: "recorded-by-platform", paidBy: "Super admin" }),
                {
                  success: (i) => `${i.number} recorded — paid until ${formatDate(i.periodTo)}`,
                  allowReadOnly: true,
                },
              )
            }
          >
            <CircleDollarSign aria-hidden="true" /> Record payment
          </Button>
          {tenant.suspended ? (
            <Button
              variant="outline"
              onClick={() =>
                run(() => setSuspended(tenant.slug, false), { success: "Suspension lifted", allowReadOnly: true })
              }
            >
              <PlayCircle aria-hidden="true" /> Lift suspension
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <Ban aria-hidden="true" /> Suspend
                </Button>
              }
              title={`Suspend ${tenant.name}?`}
              description="Staff can no longer sign in; the hospital admin can still sign in to pay and contact support. Data is kept."
              reasonLabel="Reason"
              confirmLabel="Suspend hospital"
              onConfirm={(reason) => {
                run(() => setSuspended(tenant.slug, true, reason), {
                  success: "Hospital suspended",
                  allowReadOnly: true,
                });
              }}
            />
          )}
        </div>
        <div className="bg-muted/50 grid gap-2 rounded-lg p-3">
          <p className="flex items-center gap-1 text-xs font-medium">
            <CalendarClock className="size-3.5" aria-hidden="true" /> Demo: simulate lateness
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Paid up", days: 30 },
              { label: "3 days late (grace)", days: -3 },
              { label: "15 days late (read-only)", days: -15 },
              { label: "45 days late (suspended)", days: -45 },
            ].map((o) => (
              <Button
                key={o.label}
                size="sm"
                variant="ghost"
                onClick={() =>
                  run(() => setPaidUntil(tenant.slug, shiftDate(today, o.days)), {
                    success: `${tenant.shortName}: ${o.label}`,
                    allowReadOnly: true,
                  })
                }
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export function HospitalDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const run = useRunAction();
  const tenant = usePlatformStore((s) => s.tenants.find((t) => t.slug === slug));
  const invoices = usePlatformStore((s) => s.invoices);
  const tickets = usePlatformStore((s) => s.tickets);
  const remove = usePlatformStore((s) => s.removeTenant);
  const money = useMemo(() => (tenant ? tenantMoney(tenant.slug) : null), [tenant]);

  if (!tenant || !money)
    return (
      <EmptyState
        icon={Building2}
        title="Hospital not found"
        action={
          <Button asChild>
            <Link href="/platform/hospitals">Back to hospitals</Link>
          </Button>
        }
      />
    );

  const mine = invoices.filter((i) => i.tenantSlug === slug).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const myTickets = tickets.filter((t) => t.tenantSlug === slug).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const settlements = [...money.settlements].sort((a, b) => b.at.localeCompare(a.at));

  const settlementColumns: ColumnDef<Settlement, unknown>[] = [
    {
      accessorKey: "at",
      header: "Date",
      cell: ({ row }) => formatDateTime(row.original.at),
      meta: { exportValue: (r) => formatDateTime(r.at) },
    },
    { accessorKey: "channel", header: "Channel" },
    {
      accessorKey: "gross",
      header: "Patient paid",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.gross),
    },
    {
      accessorKey: "gatewayFee",
      header: "Gateway",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.gatewayFee),
    },
    {
      accessorKey: "platformFee",
      header: "Your fee",
      meta: { align: "right" },
      cell: ({ row }) => <strong className="tabular-nums">{formatMoney(row.original.platformFee)}</strong>,
    },
    {
      accessorKey: "hospitalNet",
      header: "To hospital",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.hospitalNet),
    },
  ];
  const invoiceColumns: ColumnDef<SubscriptionInvoice, unknown>[] = [
    { accessorKey: "number", header: "Invoice" },
    { accessorKey: "paidAt", header: "Paid", cell: ({ row }) => formatDate(row.original.paidAt) },
    { id: "period", header: "Period", accessorFn: (r) => `${formatDate(r.periodFrom)} – ${formatDate(r.periodTo)}` },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    { id: "method", header: "Method", accessorFn: (r) => r.method.replace(/-/g, " ") },
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <TenantMark tenant={tenant} size="size-9" /> {tenant.name}
          </span>
        }
        description={`${PLANS[tenant.plan].label} plan · admin ${tenant.admin.name} (${tenant.admin.email}) · onboarded ${formatDate(tenant.createdAt)}`}
        crumbs={[{ label: "Hospitals", href: "/platform/hospitals" }, { label: tenant.shortName }]}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/h/${tenant.slug}`}>
                <ExternalLink aria-hidden="true" /> Open hospital
              </a>
            </Button>
            {tenant.slug !== DEFAULT_TENANT ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" aria-label={`Remove ${tenant.name}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                }
                title={`Remove ${tenant.name} from the demo?`}
                description="Deletes the hospital and every record it has in this browser. This cannot be undone."
                confirmLabel="Remove hospital"
                onConfirm={() => {
                  if (
                    run(
                      () => {
                        remove(tenant.slug);
                        return true;
                      },
                      { success: `${tenant.name} removed`, allowReadOnly: true },
                    )
                  )
                    router.replace("/platform/hospitals");
                }}
              />
            ) : null}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Patient payments"
          value={formatMoney(money.gross)}
          hint={money.opened ? `${money.settlements.length} payments` : "Hospital not opened yet"}
        />
        <StatTile label="Your service charges" value={formatMoney(money.platformFees)} tone="rose" />
        <StatTile label="Settled to hospital" value={formatMoney(money.hospitalNet)} />
        <StatTile label="Patient accounts" value={money.accounts} />
      </div>
      <SectionCard title="Hospital link" className="mb-4">
        <CopyHospitalLink tenant={tenant} />
      </SectionCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <BrandingCard key={`b-${tenant.slug}`} tenant={tenant} />
        <div className="grid content-start gap-4">
          <SubscriptionCard tenant={tenant} />
          <PlanCard
            key={`p-${tenant.plan}-${tenant.feePercent}-${tenant.feeCap}-${tenant.aiEnabled}`}
            tenant={tenant}
          />
          <SettlementCard key={`s-${tenant.settlement.accountNumber}`} tenant={tenant} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Payments & your fees" description="Read from the hospital's own records.">
          <DataTable
            data={settlements}
            columns={settlementColumns}
            searchable={false}
            exportName={`fees-${tenant.slug}`}
            exportTitle={`Platform fees — ${tenant.name}`}
            empty={<EmptyState title={money.opened ? "No patient payments yet" : "Hospital not opened yet"} />}
          />
        </SectionCard>
        <div className="grid content-start gap-4">
          <SectionCard title="Subscription invoices">
            <DataTable
              data={mine}
              columns={invoiceColumns}
              searchable={false}
              empty={<EmptyState title="No invoices" />}
            />
          </SectionCard>
          <SectionCard title="Support tickets">
            {myTickets.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tickets from this hospital.</p>
            ) : (
              <ul className="grid gap-2">
                {myTickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/platform/tickets?ticket=${t.id}`}
                      className="hover:bg-accent flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <span>
                        <span className="block font-medium">{t.subject}</span>
                        <span className="text-muted-foreground text-xs">
                          {t.number} · {formatDateTime(t.updatedAt)}
                        </span>
                      </span>
                      <StatusChip status={t.status} tone={TICKET_TONES[t.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
