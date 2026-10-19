import { z } from "zod";
import {
  brandingSchema,
  gatewayFeesSchema,
  newTicketSchema,
  Plan,
  PLANS,
  settlementAccountSchema,
  subscriptionInvoiceSchema,
  supportTicketSchema,
  tenantSchema,
  ticketMessageSchema,
  type Branding,
  type GatewayFees,
  type NewTicketInput,
  type PlatformAuditEvent,
  type SubscriptionInvoice,
  type SupportTicket,
  type Tenant,
  type TicketStatus,
} from "@/lib/schemas/platform";
import { phone } from "@/lib/schemas/common";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { clearTenantData, DEFAULT_TENANT, slugify } from "@/lib/tenancy";
import { nowIso, shiftDate, todayIso } from "@/lib/utils/dates";
import { newId, nextSequence, pad } from "@/lib/utils/ids";
import { DEFAULT_GATEWAY_FEES } from "@/lib/wallet/fees";

/**
 * Super admin (platform owner). Signs in on the normal login page; this account is not a hospital user and is
 * never listed among the demo users. Demo-grade check: a real system verifies credentials on the server.
 */
export const SUPER_ADMIN_EMAIL = "admin@admin.com";
const SUPER_ADMIN_HASH = "0571dafd8ea46f09eefc642c1e37a11fcab2353d98211f34c4d801e0eb20a26e";

export async function isSuperAdminLogin(email: string, password: string): Promise<boolean> {
  if (email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) return false;
  const data = new TextEncoder().encode(`platform:${SUPER_ADMIN_EMAIL}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === SUPER_ADMIN_HASH;
}

export const RESERVED_SLUGS = ["platform", "login", "admin", "api", "h", "www", "app"];

export const onboardSchema = brandingSchema.extend({
  slug: tenantSchema.shape.slug,
  plan: Plan,
  feePercent: tenantSchema.shape.feePercent,
  feeCap: tenantSchema.shape.feeCap,
  aiEnabled: z.boolean(),
  settlement: settlementAccountSchema,
  dataMode: z.enum(["sample", "empty"]),
  billingMonths: z.number().int().min(1).max(24),
  admin: z.object({
    name: z.string().trim().min(3, "Enter the admin's full name"),
    email: z.email("Enter a valid email address"),
    phone,
  }),
});
export type OnboardInput = z.infer<typeof onboardSchema>;

export const tenantSettingsSchema = z.object({
  plan: Plan,
  feePercent: tenantSchema.shape.feePercent,
  feeCap: tenantSchema.shape.feeCap,
  aiEnabled: z.boolean(),
});
export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;

function seedTenants(): Tenant[] {
  const today = todayIso();
  const created = `${shiftDate(today, -200)}T09:00:00.000Z`;
  return [
    {
      id: "TEN-001",
      slug: DEFAULT_TENANT,
      name: "Overcare IVF",
      shortName: "Overcare IVF",
      tagline: "IVF & fertility care",
      primaryColor: "#0F766E",
      address: "Redemption City, KM 46 Lagos–Ibadan Expressway, Mowe, Ogun State",
      city: "Mowe",
      phone: "08030000900",
      email: "hello@overcare.demo",
      plan: "professional",
      feePercent: 1,
      feeCap: 0,
      aiEnabled: true,
      settlement: { bankName: "Guaranty Trust Bank", accountNumber: "0123456789", accountName: "OVERCARE IVF LTD" },
      subaccountCode: "ACCT_ovr7x2k9d1",
      paidUntil: shiftDate(today, 20),
      suspended: false,
      dataMode: "sample",
      admin: { name: "Demo Admin", email: "admin@rhv.demo", phone: "08030000118" },
      createdAt: created,
    },
    {
      id: "TEN-002",
      slug: "lagoon",
      name: "Lagoon Fertility Centre",
      shortName: "Lagoon Fertility",
      tagline: "Fertility & women's health, Lekki",
      primaryColor: "#6D28D9",
      address: "14 Admiralty Way, Lekki Phase 1, Lagos",
      city: "Lagos",
      phone: "08030000901",
      email: "care@lagoonfertility.demo",
      plan: "professional",
      feePercent: 1.25,
      feeCap: 5_000,
      aiEnabled: true,
      settlement: { bankName: "Zenith Bank", accountNumber: "1012345678", accountName: "LAGOON FERTILITY CENTRE" },
      subaccountCode: "ACCT_lgn4m8q2z7",
      paidUntil: shiftDate(today, -3),
      suspended: false,
      dataMode: "sample",
      admin: { name: "Demo Admin", email: "admin@rhv.demo", phone: "08030000118" },
      createdAt: `${shiftDate(today, -120)}T09:00:00.000Z`,
    },
    {
      id: "TEN-003",
      slug: "bloom",
      name: "Bloom Women's Hospital",
      shortName: "Bloom",
      tagline: "Women's health & IVF, Abuja",
      primaryColor: "#BE185D",
      address: "Plot 22 Aminu Kano Crescent, Wuse 2, Abuja",
      city: "Abuja",
      phone: "08030000902",
      email: "info@bloomhospital.demo",
      plan: "starter",
      feePercent: 1,
      feeCap: 0,
      aiEnabled: false,
      settlement: { bankName: "Access Bank", accountNumber: "0698765432", accountName: "BLOOM WOMENS HOSPITAL" },
      subaccountCode: "ACCT_blm9c3v5h0",
      paidUntil: shiftDate(today, 330),
      suspended: false,
      dataMode: "empty",
      admin: { name: "Amaka Bello", email: "amaka.bello@bloomhospital.demo", phone: "08030000903" },
      createdAt: `${shiftDate(today, -30)}T09:00:00.000Z`,
    },
  ];
}

function seedInvoices(tenants: Tenant[]): SubscriptionInvoice[] {
  const invoices: SubscriptionInvoice[] = [];
  let n = 0;
  tenants.forEach((t) => {
    // three monthly payments ending at the paid-until date
    for (let k = 3; k >= 1; k -= 1) {
      n += 1;
      const periodTo = shiftDate(t.paidUntil, -(k - 1) * 30);
      const periodFrom = shiftDate(periodTo, -30);
      invoices.push({
        id: `INV-S${n}`,
        number: `OVC-INV-${pad(n, 5)}`,
        tenantSlug: t.slug,
        plan: t.plan,
        months: 1,
        amount: PLANS[t.plan].monthly,
        method: k === 2 ? "bank-transfer" : "card",
        reference: `PSK_SUB_${pad(70000 + n * 37, 6)}`,
        periodFrom,
        periodTo,
        paidBy: t.admin.name,
        paidAt: `${shiftDate(periodFrom, -1)}T10:15:00.000Z`,
      });
    }
  });
  return invoices;
}

function seedTickets(): SupportTicket[] {
  const today = todayIso();
  const at = (days: number, time: string) => `${shiftDate(today, days)}T${time}:00.000Z`;
  return [
    {
      id: "TKT-S1",
      number: "TKT-00001",
      tenantSlug: DEFAULT_TENANT,
      subject: "Receipt printer cuts off the last line",
      category: "technical",
      priority: "normal",
      status: "resolved",
      raisedBy: "Sade Johnson",
      raisedByEmail: "sade.johnson@rhv.demo",
      messages: [
        {
          id: "TM-1",
          author: "Sade Johnson",
          fromPlatform: false,
          body: "On the front-desk printer the balance line of receipts is cut off. Chrome on Windows.",
          at: at(-9, "09:12"),
        },
        {
          id: "TM-2",
          author: "Overcare Support",
          fromPlatform: true,
          body: "Thanks — please set the printer's paper size to A4 in the print dialog (it was on Letter). Closing once you confirm.",
          at: at(-9, "11:40"),
        },
        {
          id: "TM-3",
          author: "Sade Johnson",
          fromPlatform: false,
          body: "Confirmed, that fixed it. Thank you!",
          at: at(-8, "08:05"),
        },
      ],
      createdAt: at(-9, "09:12"),
      updatedAt: at(-8, "08:05"),
    },
    {
      id: "TKT-S2",
      number: "TKT-00002",
      tenantSlug: "lagoon",
      subject: "Subscription renewal — can we pay by transfer?",
      category: "billing",
      priority: "high",
      status: "open",
      raisedBy: "Demo Admin",
      raisedByEmail: "admin@rhv.demo",
      messages: [
        {
          id: "TM-4",
          author: "Demo Admin",
          fromPlatform: false,
          body: "Our card was declined for this month's renewal. Can we pay the subscription by bank transfer instead?",
          at: at(-2, "14:30"),
        },
      ],
      createdAt: at(-2, "14:30"),
      updatedAt: at(-2, "14:30"),
    },
  ];
}

export interface PlatformState {
  tenants: Tenant[];
  gatewayFees: GatewayFees;
  invoices: SubscriptionInvoice[];
  tickets: SupportTicket[];
  audit: PlatformAuditEvent[];
  superAdmin: boolean;
  signInSuperAdmin: () => void;
  signOutSuperAdmin: () => void;
  onboard: (input: OnboardInput) => Tenant;
  updateBranding: (slug: string, input: Branding, actor: string) => Tenant;
  updateSettings: (slug: string, input: TenantSettingsInput) => Tenant;
  updateSettlement: (slug: string, input: Tenant["settlement"]) => Tenant;
  /** Hospital pays its subscription (simulated Paystack checkout) or the super admin records an offline payment. */
  paySubscription: (
    slug: string,
    input: { months: number; method: SubscriptionInvoice["method"]; paidBy: string },
  ) => SubscriptionInvoice;
  raiseTicket: (slug: string, input: NewTicketInput, by: { name: string; email: string }) => SupportTicket;
  replyTicket: (id: string, body: string, by: { name: string; fromPlatform: boolean }) => SupportTicket;
  setTicketStatus: (id: string, status: TicketStatus, actor: string) => SupportTicket;
  setSuspended: (slug: string, suspended: boolean, reason?: string) => Tenant;
  setPaidUntil: (slug: string, date: string) => Tenant;
  updateGatewayFees: (input: GatewayFees) => void;
  removeTenant: (slug: string) => void;
  reset: () => void;
}

const defaults = () => {
  const tenants = seedTenants();
  return {
    tenants,
    gatewayFees: { ...DEFAULT_GATEWAY_FEES },
    invoices: seedInvoices(tenants),
    tickets: seedTickets(),
    audit: [] as PlatformAuditEvent[],
    superAdmin: false,
  };
};

export const usePlatformStore = createDomainStore<PlatformState>(
  "platform",
  (set, get) => {
    const log = (summary: string, tenantSlug?: string, actor = "Super admin") =>
      set((s) => {
        s.audit.push({ id: newId("PAU"), at: nowIso(), actor, tenantSlug, summary });
      });
    const find = (slug: string): Tenant => {
      const t = get().tenants.find((x) => x.slug === slug);
      if (!t) throw new DomainError("Hospital not found");
      return t;
    };
    const replace = (next: Tenant) =>
      set((s) => {
        s.tenants[s.tenants.findIndex((t) => t.slug === next.slug)] = next;
      });
    return {
      ...defaults(),
      signInSuperAdmin: () => {
        set((s) => {
          s.superAdmin = true;
        });
        log("Super admin signed in");
      },
      signOutSuperAdmin: () => {
        log("Super admin signed out");
        set((s) => {
          s.superAdmin = false;
        });
      },
      onboard: (input) => {
        const v = validate(onboardSchema, input);
        const slug = slugify(v.slug);
        assert(!RESERVED_SLUGS.includes(slug), "That link name is reserved — choose another", "slug");
        assert(!get().tenants.some((t) => t.slug === slug), "Another hospital already uses this link", "slug");
        const { billingMonths, ...rest } = v;
        const tenant = validate(tenantSchema, {
          ...rest,
          slug,
          id: newId("TEN"),
          subaccountCode: `ACCT_${Math.random().toString(36).slice(2, 12)}`,
          // first period starts today; the onboarding payment is recorded as the first invoice
          paidUntil: todayIso(),
          suspended: false,
          createdAt: nowIso(),
        });
        set((s) => {
          s.tenants.push(tenant);
        });
        log(
          `Onboarded ${tenant.name} (${tenant.plan}, ${tenant.feePercent}% fee) — admin ${tenant.admin.email}`,
          tenant.slug,
        );
        get().paySubscription(tenant.slug, {
          months: billingMonths,
          method: "recorded-by-platform",
          paidBy: "Super admin",
        });
        return get().tenants.find((t) => t.slug === tenant.slug) as Tenant;
      },
      updateBranding: (slug, input, actor) => {
        const v = validate(brandingSchema, input);
        const next = validate(tenantSchema, { ...find(slug), ...v });
        replace(next);
        log(`Updated branding of ${next.name}`, slug, actor);
        return next;
      },
      updateSettings: (slug, input) => {
        const v = validate(tenantSettingsSchema, input);
        const current = find(slug);
        const next = validate(tenantSchema, { ...current, ...v });
        replace(next);
        log(
          `Settings for ${next.name}: plan ${next.plan}, fee ${next.feePercent}%${next.feeCap ? ` (cap ₦${next.feeCap.toLocaleString()})` : ""}, AI ${next.aiEnabled ? "on" : "off"}`,
          slug,
        );
        return next;
      },
      updateSettlement: (slug, input) => {
        const v = validate(settlementAccountSchema, input);
        const next = validate(tenantSchema, { ...find(slug), settlement: v });
        replace(next);
        log(`Changed settlement account of ${next.name} to ${v.bankName} ••••${v.accountNumber.slice(-4)}`, slug);
        return next;
      },
      paySubscription: (slug, { months, method, paidBy }) => {
        assert(Number.isInteger(months) && months >= 1 && months <= 24, "Choose 1–24 months", "months");
        const current = find(slug);
        const today = todayIso();
        const periodFrom = current.paidUntil > today ? current.paidUntil : today;
        const periodTo = shiftDate(periodFrom, months * 30);
        const discount = months >= 12 ? 2 / 12 : 0; // annual prepay: 2 months free
        const amount = Math.round(PLANS[current.plan].monthly * months * (1 - discount));
        const invoice = validate(subscriptionInvoiceSchema, {
          id: newId("INV"),
          number: nextSequence(
            get().invoices.map((i) => i.number),
            "OVC-INV-",
            5,
          ),
          tenantSlug: slug,
          plan: current.plan,
          months,
          amount,
          method,
          reference: `PSK_SUB_${Date.now().toString(36).toUpperCase()}`,
          periodFrom,
          periodTo,
          paidBy,
          paidAt: nowIso(),
        });
        const next = validate(tenantSchema, { ...current, paidUntil: periodTo });
        replace(next);
        set((s) => {
          s.invoices.push(invoice);
        });
        log(
          `Subscription paid: ${invoice.number}, ${months} month(s), ₦${amount.toLocaleString()} — ${next.name} paid until ${periodTo}`,
          slug,
          method === "recorded-by-platform" ? "Super admin" : paidBy,
        );
        return invoice;
      },
      raiseTicket: (slug, input, by) => {
        find(slug);
        const v = validate(newTicketSchema, input);
        const at = nowIso();
        const ticket = validate(supportTicketSchema, {
          id: newId("TKT"),
          number: nextSequence(
            get().tickets.map((t) => t.number),
            "TKT-",
            5,
          ),
          tenantSlug: slug,
          subject: v.subject,
          category: v.category,
          priority: v.priority,
          status: "open",
          raisedBy: by.name,
          raisedByEmail: by.email,
          messages: [{ id: newId("TM"), author: by.name, fromPlatform: false, body: v.body, at }],
          createdAt: at,
          updatedAt: at,
        });
        set((s) => {
          s.tickets.push(ticket);
        });
        log(`Ticket ${ticket.number} raised: ${ticket.subject}`, slug, by.name);
        return ticket;
      },
      replyTicket: (id, body, by) => {
        const ticket = get().tickets.find((t) => t.id === id);
        if (!ticket) throw new DomainError("Ticket not found");
        assert(ticket.status !== "closed", "This ticket is closed. Raise a new ticket instead.");
        const message = validate(ticketMessageSchema, {
          id: newId("TM"),
          author: by.name,
          fromPlatform: by.fromPlatform,
          body,
          at: nowIso(),
        });
        set((s) => {
          const t = s.tickets.find((x) => x.id === id);
          if (!t) return;
          t.messages.push(message);
          t.updatedAt = message.at;
          // a hospital reply reopens a resolved ticket; a platform reply moves it to in-progress
          if (by.fromPlatform && t.status === "open") t.status = "in-progress";
          if (!by.fromPlatform && t.status === "resolved") t.status = "open";
        });
        log(`Reply on ${ticket.number}`, ticket.tenantSlug, by.name);
        return get().tickets.find((t) => t.id === id) as SupportTicket;
      },
      setTicketStatus: (id, status, actor) => {
        const ticket = get().tickets.find((t) => t.id === id);
        if (!ticket) throw new DomainError("Ticket not found");
        set((s) => {
          const t = s.tickets.find((x) => x.id === id);
          if (t) {
            t.status = status;
            t.updatedAt = nowIso();
          }
        });
        log(`${ticket.number} marked ${status}`, ticket.tenantSlug, actor);
        return get().tickets.find((t) => t.id === id) as SupportTicket;
      },
      setSuspended: (slug, suspended, reason) => {
        if (suspended) assert(reason && reason.trim().length >= 5, "Give a reason (at least 5 characters)", "reason");
        const next = validate(tenantSchema, {
          ...find(slug),
          suspended,
          suspendReason: suspended ? reason?.trim() : undefined,
        });
        replace(next);
        log(`${suspended ? `Suspended ${next.name}: ${reason?.trim()}` : `Lifted suspension of ${next.name}`}`, slug);
        return next;
      },
      setPaidUntil: (slug, date) => {
        const next = validate(tenantSchema, { ...find(slug), paidUntil: date });
        replace(next);
        log(`Demo: set ${next.name} paid-until date to ${date}`, slug);
        return next;
      },
      updateGatewayFees: (input) => {
        const v = validate(gatewayFeesSchema, input);
        set((s) => {
          s.gatewayFees = v;
        });
        log("Updated gateway fee model");
      },
      removeTenant: (slug) => {
        assert(slug !== DEFAULT_TENANT, "The demo's main hospital cannot be removed");
        const t = find(slug);
        set((s) => {
          s.tenants = s.tenants.filter((x) => x.slug !== slug);
        });
        clearTenantData(slug);
        log(`Removed ${t.name} and all of its demo data`, slug);
      },
      reset: () => set(() => ({ ...defaults(), superAdmin: get().superAdmin })),
    };
  },
  { shared: true },
);

export function tenantBySlug(slug: string): Tenant | undefined {
  return usePlatformStore.getState().tenants.find((t) => t.slug === slug);
}
