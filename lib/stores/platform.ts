import { z } from "zod";
import {
  brandingSchema,
  gatewayFeesSchema,
  Plan,
  settlementAccountSchema,
  tenantSchema,
  type Branding,
  type GatewayFees,
  type PlatformAuditEvent,
  type Tenant,
} from "@/lib/schemas/platform";
import { phone } from "@/lib/schemas/common";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { clearTenantData, DEFAULT_TENANT, slugify } from "@/lib/tenancy";
import { nowIso, shiftDate, todayIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";
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

export interface PlatformState {
  tenants: Tenant[];
  gatewayFees: GatewayFees;
  audit: PlatformAuditEvent[];
  superAdmin: boolean;
  signInSuperAdmin: () => void;
  signOutSuperAdmin: () => void;
  onboard: (input: OnboardInput) => Tenant;
  updateBranding: (slug: string, input: Branding, actor: string) => Tenant;
  updateSettings: (slug: string, input: TenantSettingsInput) => Tenant;
  updateSettlement: (slug: string, input: Tenant["settlement"]) => Tenant;
  recordSubscriptionPayment: (slug: string, months: number) => Tenant;
  setSuspended: (slug: string, suspended: boolean, reason?: string) => Tenant;
  setPaidUntil: (slug: string, date: string) => Tenant;
  updateGatewayFees: (input: GatewayFees) => void;
  removeTenant: (slug: string) => void;
  reset: () => void;
}

const defaults = () => ({
  tenants: seedTenants(),
  gatewayFees: { ...DEFAULT_GATEWAY_FEES },
  audit: [] as PlatformAuditEvent[],
  superAdmin: false,
});

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
          paidUntil: shiftDate(todayIso(), billingMonths * 30),
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
        return tenant;
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
      recordSubscriptionPayment: (slug, months) => {
        assert(Number.isInteger(months) && months >= 1 && months <= 24, "Choose 1–24 months");
        const current = find(slug);
        const today = todayIso();
        const from = current.paidUntil > today ? current.paidUntil : today;
        const next = validate(tenantSchema, { ...current, paidUntil: shiftDate(from, months * 30) });
        replace(next);
        log(`Subscription payment for ${months} month(s) — ${next.name} paid until ${next.paidUntil}`, slug);
        return next;
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
