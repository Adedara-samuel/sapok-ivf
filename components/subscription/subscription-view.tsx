"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, Check, CreditCard, LifeBuoy, Lock, Plus, Receipt, ShieldCheck } from "lucide-react";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PrintDialog } from "@/components/print/print-dialog";
import { PrintSection, PrintSheet } from "@/components/print/print-sheet";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { PRIORITY_TONES, TICKET_TONES, TicketThread } from "@/components/subscription/ticket-thread";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useSubscription } from "@/hooks/use-tenant";
import { useZodForm } from "@/hooks/use-zod-form";
import {
  newTicketSchema,
  PLANS,
  TicketCategory,
  TicketPriority,
  type NewTicketInput,
  type SubscriptionInvoice,
  type SupportTicket,
} from "@/lib/schemas/platform";
import { daysLate, STATUS_LABELS } from "@/lib/platform/subscription";
import { audit } from "@/lib/stores/audit";
import { usePlatformStore } from "@/lib/stores/platform";
import { useSessionStore } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { daysBetween, formatDate, formatDateTime, todayIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

const PERIODS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months — 2 months free" },
];

function priceFor(monthly: number, months: number): number {
  return Math.round(monthly * months * (months >= 12 ? 10 / 12 : 1));
}

function PayDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const run = useRunAction();
  const { tenant } = useSubscription();
  const pay = usePlatformStore((s) => s.paySubscription);
  const userId = useSessionStore((s) => s.userId);
  const userName = useStaffStore((s) => s.staff.find((x) => x.id === userId)?.name ?? "Hospital admin");
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<"card" | "bank-transfer">("card");
  const [stage, setStage] = useState<"choose" | "checkout" | "done">("choose");
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  if (!tenant) return null;
  const amount = priceFor(PLANS[tenant.plan].monthly, months);
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStage("choose");
      setInvoice(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{stage === "done" ? "Payment successful" : "Renew subscription"}</DialogTitle>
          <DialogDescription>
            {PLANS[tenant.plan].label} plan · {formatMoney(PLANS[tenant.plan].monthly)} per month
          </DialogDescription>
        </DialogHeader>
        {stage === "choose" ? (
          <div className="grid gap-4">
            <RadioGroup value={String(months)} onValueChange={(v) => setMonths(Number(v))} aria-label="Period">
              {PERIODS.map((p) => (
                <Label
                  key={p.months}
                  className="hover:bg-accent flex items-center justify-between gap-3 rounded-lg border p-3 font-normal"
                >
                  <span className="flex items-center gap-3">
                    <RadioGroupItem value={String(p.months)} />
                    {p.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(priceFor(PLANS[tenant.plan].monthly, p.months))}
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <div className="grid gap-1.5">
              <Label>Pay with</Label>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="grid-cols-2">
                <Label className="flex items-center gap-2 rounded-lg border p-3 font-normal">
                  <RadioGroupItem value="card" /> Card
                </Label>
                <Label className="flex items-center gap-2 rounded-lg border p-3 font-normal">
                  <RadioGroupItem value="bank-transfer" /> Bank transfer
                </Label>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStage("checkout")}>Continue to pay {formatMoney(amount)}</Button>
            </DialogFooter>
          </div>
        ) : stage === "checkout" ? (
          <div className="grid gap-4">
            <div className="rounded-xl border p-4">
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <Lock className="size-3" aria-hidden="true" /> Paystack checkout (demo — no money moves)
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(amount)}</p>
              <p className="text-muted-foreground text-sm">
                {tenant.name} · {months} month{months > 1 ? "s" : ""} of {PLANS[tenant.plan].label}
              </p>
              {method === "card" ? (
                <p className="bg-muted/50 mt-3 rounded-md p-2 font-mono text-sm">4084 0840 8408 4081 · 12/30 · 408</p>
              ) : (
                <p className="bg-muted/50 mt-3 rounded-md p-2 text-sm">
                  Transfer to Paystack-Titan 9912345678 (Overcare Technologies)
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStage("choose")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  const inv = run(() => pay(tenant.slug, { months, method, paidBy: userName }), {
                    allowReadOnly: true,
                  });
                  if (inv) {
                    audit(
                      "create",
                      "subscription",
                      `Paid subscription ${inv.number}: ${formatMoney(inv.amount)} for ${months} month(s)`,
                    );
                    setInvoice(inv);
                    setStage("done");
                  }
                }}
              >
                <CreditCard aria-hidden="true" /> Pay {formatMoney(amount)}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3 text-center">
            <Check className="text-success mx-auto size-10" aria-hidden="true" />
            <p>
              {invoice?.number} paid. {tenant.name} is now paid up to <strong>{formatDate(invoice?.periodTo)}</strong>.
            </p>
            <p className="text-muted-foreground text-sm">A receipt has been added to your invoices.</p>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceReceipt({ invoice }: { invoice: SubscriptionInvoice }) {
  const { tenant } = useSubscription();
  return (
    <PrintDialog
      title={`Invoice ${invoice.number}`}
      documentTitle={invoice.number}
      auditEntity="subscription"
      trigger={
        <Button size="sm" variant="ghost">
          <Receipt aria-hidden="true" /> Receipt
        </Button>
      }
    >
      {(ref) => (
        <PrintSheet ref={ref} title={`Subscription receipt ${invoice.number}`}>
          <PrintSection title="Billed by">
            <p>Overcare Technologies Ltd — IVF clinic management platform</p>
          </PrintSection>
          <PrintSection title="Payment">
            <table>
              <tbody>
                <tr>
                  <th className="w-48">Hospital</th>
                  <td>{tenant?.name}</td>
                </tr>
                <tr>
                  <th>Plan</th>
                  <td>{PLANS[invoice.plan].label}</td>
                </tr>
                <tr>
                  <th>Period</th>
                  <td>
                    {formatDate(invoice.periodFrom)} – {formatDate(invoice.periodTo)} ({invoice.months} month
                    {invoice.months > 1 ? "s" : ""})
                  </td>
                </tr>
                <tr>
                  <th>Amount</th>
                  <td className="font-bold">{formatMoney(invoice.amount)}</td>
                </tr>
                <tr>
                  <th>Method / reference</th>
                  <td>
                    {invoice.method.replace(/-/g, " ")} · {invoice.reference}
                  </td>
                </tr>
                <tr>
                  <th>Paid</th>
                  <td>
                    {formatDateTime(invoice.paidAt)} by {invoice.paidBy}
                  </td>
                </tr>
              </tbody>
            </table>
          </PrintSection>
        </PrintSheet>
      )}
    </PrintDialog>
  );
}

function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const run = useRunAction();
  const { tenant } = useSubscription();
  const raise = usePlatformStore((s) => s.raiseTicket);
  const userId = useSessionStore((s) => s.userId);
  const me = useStaffStore((s) => s.staff.find((x) => x.id === userId));
  const form = useZodForm<NewTicketInput>(newTicketSchema, {
    subject: "",
    category: "technical",
    priority: "normal",
    body: "",
  });
  if (!tenant) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a support ticket</DialogTitle>
          <DialogDescription>
            Goes straight to the Overcare support desk. You&apos;ll see replies here.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              const t = run(
                () => raise(tenant.slug, v, { name: me?.name ?? "Hospital staff", email: me?.email ?? tenant.email }),
                { success: (r) => `Ticket ${r.number} sent to support`, setError: form.setError, allowReadOnly: true },
              );
              if (t) {
                audit("create", "support", `Raised support ticket ${t.number}: ${t.subject}`);
                form.reset();
                onOpenChange(false);
              }
            })}
          >
            <TextField control={form.control} name="subject" label="Subject" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="category"
                label="Category"
                required
                options={TicketCategory.options.map((c) => ({
                  value: c,
                  label: c.replace(/-/g, " ").replace(/^\w/, (x) => x.toUpperCase()),
                }))}
              />
              <SelectField
                control={form.control}
                name="priority"
                label="Priority"
                required
                options={TicketPriority.options.map((p) => ({
                  value: p,
                  label: p.replace(/^\w/, (x) => x.toUpperCase()),
                }))}
              />
            </div>
            <TextareaField control={form.control} name="body" label="Describe the issue" required rows={5} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Send to support</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionView() {
  const canPay = usePermission("admin.settings");
  const { tenant, status, message } = useSubscription();
  const invoices = usePlatformStore((s) => s.invoices);
  const tickets = usePlatformStore((s) => s.tickets);
  const userId = useSessionStore((s) => s.userId);
  const me = useStaffStore((s) => s.staff.find((x) => x.id === userId));
  const [payOpen, setPayOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const today = todayIso();

  const mine = useMemo(
    () => invoices.filter((i) => i.tenantSlug === tenant?.slug).sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [invoices, tenant],
  );
  const myTickets = useMemo(
    () => tickets.filter((t) => t.tenantSlug === tenant?.slug).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tickets, tenant],
  );
  const selected = myTickets.find((t) => t.id === openTicket);
  if (!tenant) return <EmptyState title="Hospital profile not found" />;
  const plan = PLANS[tenant.plan];
  const left = daysBetween(today, tenant.paidUntil);

  const invoiceColumns: ColumnDef<SubscriptionInvoice, unknown>[] = [
    { accessorKey: "number", header: "Invoice" },
    {
      accessorKey: "paidAt",
      header: "Paid",
      cell: ({ row }) => formatDate(row.original.paidAt),
      meta: { exportValue: (r) => formatDate(r.paidAt) },
    },
    { id: "period", header: "Period", accessorFn: (r) => `${formatDate(r.periodFrom)} – ${formatDate(r.periodTo)}` },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { align: "right" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    { id: "method", header: "Method", accessorFn: (r) => r.method.replace(/-/g, " ") },
    { accessorKey: "paidBy", header: "Paid by" },
    {
      id: "receipt",
      header: () => <span className="sr-only">Receipt</span>,
      enableHiding: false,
      cell: ({ row }) => <InvoiceReceipt invoice={row.original} />,
    },
  ];

  const ticketColumns: ColumnDef<SupportTicket, unknown>[] = [
    { accessorKey: "number", header: "Ticket" },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => <span className="font-medium">{row.original.subject}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} tone={TICKET_TONES[row.original.status]} />,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <StatusChip status={row.original.priority} tone={PRIORITY_TONES[row.original.priority]} />,
    },
    { id: "replies", header: "Messages", meta: { align: "right" }, accessorFn: (r) => r.messages.length },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => formatDateTime(row.original.updatedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Subscription & support"
        description={`${tenant.name}'s plan with Overcare, payments and help.`}
        crumbs={[{ label: "Management" }, { label: "Subscription & support" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setTicketOpen(true)}>
              <LifeBuoy aria-hidden="true" /> Raise ticket
            </Button>
            {canPay ? (
              <Button onClick={() => setPayOpen(true)}>
                <CreditCard aria-hidden="true" /> Pay subscription
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              {plan.label} plan <Badge variant="secondary">{formatMoney(plan.monthly)}/month</Badge>
            </span>
          }
          description="Billed in advance; 12-month prepayment gets 2 months free."
          className="lg:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <StatusChip
                status={status}
                tone={status === "active" ? "done" : status === "grace" ? "waiting" : "critical"}
                label={STATUS_LABELS[status]}
              />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Paid up to</p>
              <p className="font-semibold">{formatDate(tenant.paidUntil)}</p>
              <p className="text-muted-foreground text-xs">
                {left >= 0 ? `${left} day${left === 1 ? "" : "s"} left` : `${daysLate(tenant, today)} days overdue`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Included</p>
              <ul className="grid gap-0.5 text-sm">
                <li className="flex items-center gap-1">
                  <Check className="text-success size-3.5" aria-hidden="true" /> Up to {plan.branches} branch
                  {plan.branches > 1 ? "es" : ""}
                </li>
                <li className="flex items-center gap-1">
                  {tenant.aiEnabled ? (
                    <Check className="text-success size-3.5" aria-hidden="true" />
                  ) : (
                    <Lock className="text-muted-foreground size-3.5" aria-hidden="true" />
                  )}
                  AI assistant
                </li>
                <li className="flex items-center gap-1">
                  <Check className="text-success size-3.5" aria-hidden="true" /> Patient &amp; family accounts
                </li>
              </ul>
            </div>
          </div>
          {message ? <p className="bg-muted/50 mt-4 rounded-lg p-3 text-sm">{message}</p> : null}
        </SectionCard>
        <SectionCard title="How renewal works" description="Automatic — nobody has to switch anything on or off.">
          <ul className="grid gap-2 text-sm">
            <li className="flex gap-2">
              <CalendarCheck className="text-success size-4 shrink-0" aria-hidden="true" /> Paid up: everything works.
            </li>
            <li className="flex gap-2">
              <CalendarCheck className="text-warning size-4 shrink-0" aria-hidden="true" /> Up to 7 days late: reminder
              banner, everything still works.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="text-destructive size-4 shrink-0" aria-hidden="true" /> 8–30 days late: read-only
              — records can still be viewed and printed.
            </li>
            <li className="flex gap-2">
              <Lock className="text-destructive size-4 shrink-0" aria-hidden="true" /> Over 30 days: suspended; only the
              admin can sign in to renew.
            </li>
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">
            Platform service charge on patient payments: {tenant.feePercent}%
            {tenant.feeCap ? ` (max ${formatMoney(tenant.feeCap)} per payment)` : ""} — deducted from settlements, never
            from patients.
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Invoices & receipts" description="Every subscription payment.">
          <DataTable
            data={mine}
            columns={invoiceColumns}
            searchable={false}
            exportName="subscription-invoices"
            exportTitle="Subscription invoices"
            empty={<EmptyState title="No payments yet" />}
          />
        </SectionCard>
        <SectionCard
          title="Support tickets"
          description="Questions, problems or requests for the Overcare team."
          actions={
            <Button size="sm" variant="outline" onClick={() => setTicketOpen(true)}>
              <Plus aria-hidden="true" /> New ticket
            </Button>
          }
        >
          <DataTable
            data={myTickets}
            columns={ticketColumns}
            searchPlaceholder="Search tickets…"
            onRowClick={(t) => setOpenTicket(t.id)}
            empty={
              <EmptyState icon={LifeBuoy} title="No tickets yet" description="Raise one whenever you need help." />
            }
          />
        </SectionCard>
      </div>

      <PayDialog open={payOpen} onOpenChange={setPayOpen} />
      <NewTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
      <Sheet open={Boolean(selected)} onOpenChange={(o) => (!o ? setOpenTicket(null) : undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.number}: {selected.subject}
                </SheetTitle>
                <SheetDescription>Conversation with Overcare support</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <TicketThread ticket={selected} author={me?.name ?? "Hospital staff"} fromPlatform={false} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
