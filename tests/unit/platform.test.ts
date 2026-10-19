import { beforeEach, describe, expect, it } from "vitest";
import { effectiveStatus } from "@/lib/platform/subscription";
import { PLANS } from "@/lib/schemas/platform";
import { usePlatformStore, type OnboardInput } from "@/lib/stores/platform";
import { DEFAULT_TENANT, scopedKey, slugify } from "@/lib/tenancy";
import { shiftDate, todayIso } from "@/lib/utils/dates";

const today = todayIso();

const input = (over: Partial<OnboardInput> = {}): OnboardInput => ({
  name: "Harmony Fertility Clinic",
  shortName: "Harmony",
  tagline: "IVF in Ibadan",
  primaryColor: "#1D4ED8",
  address: "5 Ring Road, Ibadan",
  city: "Ibadan",
  phone: "08031112233",
  email: "admin@harmony.demo",
  slug: "harmony",
  plan: "starter",
  feePercent: 1.5,
  feeCap: 0,
  aiEnabled: false,
  settlement: { bankName: "Zenith Bank", accountNumber: "1234567890", accountName: "HARMONY FERTILITY CLINIC" },
  dataMode: "empty",
  billingMonths: 3,
  admin: { name: "Bola Ade", email: "bola@harmony.demo", phone: "08031112244" },
  ...over,
});

beforeEach(() => {
  usePlatformStore.getState().reset();
});

describe("subscription status is automatic", () => {
  it.each([
    [5, "active"],
    [0, "active"],
    [-3, "grace"],
    [-7, "grace"],
    [-8, "read-only"],
    [-30, "read-only"],
    [-31, "suspended"],
  ] as const)("paid until today%+d → %s", (offset, expected) => {
    expect(effectiveStatus({ paidUntil: shiftDate(today, offset), suspended: false }, today)).toBe(expected);
  });

  it("a manual suspension overrides a paid-up subscription", () => {
    expect(effectiveStatus({ paidUntil: shiftDate(today, 100), suspended: true }, today)).toBe("suspended");
  });
});

describe("onboarding hospitals", () => {
  it("creates the hospital with its link, subaccount and first invoice", () => {
    const t = usePlatformStore.getState().onboard(input());
    expect(t.slug).toBe("harmony");
    expect(t.subaccountCode).toMatch(/^ACCT_/);
    expect(t.paidUntil).toBe(shiftDate(today, 90));
    const inv = usePlatformStore.getState().invoices.filter((i) => i.tenantSlug === "harmony");
    expect(inv).toHaveLength(1);
    expect(inv[0]?.amount).toBe(PLANS.starter.monthly * 3);
    expect(usePlatformStore.getState().audit.some((a) => /Onboarded Harmony/.test(a.summary))).toBe(true);
  });

  it("rejects a duplicate or reserved link and invalid details", () => {
    usePlatformStore.getState().onboard(input());
    expect(() => usePlatformStore.getState().onboard(input())).toThrow(/already uses/);
    expect(() => usePlatformStore.getState().onboard(input({ slug: "platform" }))).toThrow(/reserved/);
    expect(() => usePlatformStore.getState().onboard(input({ slug: "x2", feePercent: 25 }))).toThrow();
    expect(() =>
      usePlatformStore
        .getState()
        .onboard(
          input({ slug: "abc", settlement: { bankName: "Zenith Bank", accountNumber: "12", accountName: "X" } }),
        ),
    ).toThrow();
  });

  it("extends the paid-up date on payment, with 2 months free for a year", () => {
    const slug = "lagoon";
    const before = usePlatformStore.getState().tenants.find((t) => t.slug === slug);
    expect(effectiveStatus(before as NonNullable<typeof before>, today)).toBe("grace");
    const inv = usePlatformStore.getState().paySubscription(slug, { months: 12, method: "card", paidBy: "Demo Admin" });
    expect(inv.amount).toBe(Math.round(PLANS.professional.monthly * 10));
    expect(inv.periodFrom).toBe(today); // lapsed: the new period starts today
    const after = usePlatformStore.getState().tenants.find((t) => t.slug === slug);
    expect(after?.paidUntil).toBe(shiftDate(today, 360));
    expect(effectiveStatus(after as NonNullable<typeof after>, today)).toBe("active");
  });

  it("suspension needs a reason", () => {
    expect(() => usePlatformStore.getState().setSuspended("lagoon", true)).toThrow(/reason/);
    const t = usePlatformStore.getState().setSuspended("lagoon", true, "Chargeback under review");
    expect(t.suspended).toBe(true);
  });

  it("the main demo hospital cannot be removed", () => {
    expect(() => usePlatformStore.getState().removeTenant(DEFAULT_TENANT)).toThrow(/cannot be removed/);
  });
});

describe("support tickets", () => {
  it("flows open → in progress → resolved → reopened by the hospital → closed", () => {
    const store = usePlatformStore.getState();
    const t = store.raiseTicket(
      "overcare",
      {
        subject: "Cannot print receipts",
        category: "technical",
        priority: "high",
        body: "The print preview is blank on Firefox.",
      },
      { name: "Sade Johnson", email: "sade.johnson@rhv.demo" },
    );
    expect(t.status).toBe("open");
    expect(t.number).toMatch(/^TKT-\d{5}$/);
    expect(
      usePlatformStore.getState().replyTicket(t.id, "Looking into it", { name: "Support", fromPlatform: true }).status,
    ).toBe("in-progress");
    usePlatformStore.getState().setTicketStatus(t.id, "resolved", "Support");
    expect(
      usePlatformStore.getState().replyTicket(t.id, "Still happening on one PC", { name: "Sade", fromPlatform: false })
        .status,
    ).toBe("open");
    usePlatformStore.getState().setTicketStatus(t.id, "closed", "Sade");
    expect(() => usePlatformStore.getState().replyTicket(t.id, "hello", { name: "Sade", fromPlatform: false })).toThrow(
      /closed/,
    );
  });

  it("validates new tickets", () => {
    expect(() =>
      usePlatformStore
        .getState()
        .raiseTicket(
          "overcare",
          { subject: "Hi", category: "other", priority: "low", body: "short" },
          { name: "A", email: "a@b.c" },
        ),
    ).toThrow();
  });
});

describe("tenancy", () => {
  it("keeps the default hospital on the original storage keys and scopes the others", () => {
    expect(scopedKey("rhv-ivf:persons", DEFAULT_TENANT)).toBe("rhv-ivf:persons");
    expect(scopedKey("rhv-ivf:persons", "lagoon")).toBe("rhv-ivf@lagoon:persons");
  });

  it("builds safe link names", () => {
    expect(slugify("  Lagoon Fertility Centre! ")).toBe("lagoon-fertility-centre");
    expect(slugify("Bloom — Women's Hospital")).toBe("bloom-womens-hospital");
  });
});
