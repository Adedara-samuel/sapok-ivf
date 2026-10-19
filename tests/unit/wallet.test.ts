import { beforeEach, describe, expect, it } from "vitest";
import { ledgerEntrySchema, settlementSchema, walletSchema } from "@/lib/schemas/wallet";
import { buildSeed } from "@/lib/seed/build";
import { cancelOrder, placeOrder } from "@/lib/services/workflows";
import { accountSummary, useBillingStore } from "@/lib/stores/billing";
import { setWriteBlock } from "@/lib/stores/core";
import { useEpisodeStore } from "@/lib/stores/episode";
import { rootReset } from "@/lib/stores/index";
import { useAuditStore } from "@/lib/stores/audit";
import { usePersonStore } from "@/lib/stores/person";
import { useRequestStore } from "@/lib/stores/requests";
import { useSessionStore } from "@/lib/stores/session";
import { useWalletStore } from "@/lib/stores/wallet";
import { DEFAULT_GATEWAY_FEES, gatewayFee, platformFee, splitPayment } from "@/lib/wallet/fees";
import { isWalletPayable, walletBalance, walletForEpisode, walletTotals } from "@/lib/wallet/ledger";

const ANCHOR = new Date("2026-10-08T10:30:00+01:00");

function loginAs(id: string, role: Parameters<ReturnType<typeof useSessionStore.getState>["login"]>[1]) {
  useSessionStore.getState().login(id, role, "BR-01");
}

function walletNamed(name: string) {
  const w = useWalletStore.getState().wallets.find((x) => x.name === name);
  if (!w) throw new Error(`no wallet ${name}`);
  return w;
}

function episodeOf(firstName: string) {
  const p = usePersonStore.getState().persons.find((x) => x.firstName === firstName);
  const e = useEpisodeStore.getState().episodes.find((x) => x.patientId === p?.id && x.status !== "closed");
  if (!e) throw new Error(`no open episode for ${firstName}`);
  return e;
}

const balanceOf = (walletId: string) => walletBalance(useWalletStore.getState().entries, walletId);
const chargeFor = (orderId: string) => useBillingStore.getState().charges.find((c) => c.orderId === orderId);
const DRUG = { catalogCode: "DRG-FA", qty: 1, dosage: "5 mg", frequency: "daily", duration: "30 days" };

describe("account seed", () => {
  const seed = buildSeed(ANCHOR);

  it("every account, ledger entry and settlement passes its schema", () => {
    expect(seed.wallets.length).toBeGreaterThanOrEqual(8);
    seed.wallets.forEach((w) => expect(walletSchema.safeParse(w).success).toBe(true));
    seed.ledger.forEach((e) => expect(ledgerEntrySchema.safeParse(e).success).toBe(true));
    seed.settlements.forEach((s) => expect(settlementSchema.safeParse(s).success).toBe(true));
  });

  it("keeps balances consistent and within the credit limit", () => {
    seed.wallets.forEach((w) => {
      const entries = seed.ledger.filter((e) => e.walletId === w.id);
      const last = entries.at(-1);
      expect(last?.balanceAfter ?? 0).toBe(walletBalance(seed.ledger, w.id));
      entries.forEach((e) => expect(e.balanceAfter).toBeGreaterThanOrEqual(-w.creditLimit));
    });
  });

  it("puts each person in at most one account", () => {
    const ids = seed.wallets.flatMap((w) => w.members.map((m) => m.personId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("auto-debit accounts with money left have no unpaid self-pay charges", () => {
    seed.wallets
      .filter((w) => w.autoDebit && walletBalance(seed.ledger, w.id) + w.creditLimit > 0)
      .forEach((w) => {
        const eps = seed.episodes.filter((e) => walletForEpisode(seed.wallets, e)?.id === w.id).map((e) => e.id);
        const owed = seed.charges.filter((c) => eps.includes(c.episodeId) && isWalletPayable(c));
        expect({ wallet: w.name, owed: owed.length }).toEqual({ wallet: w.name, owed: 0 });
      });
  });

  it("every account debit matches an account payment on the episode", () => {
    seed.ledger
      .filter((e) => e.kind === "charge")
      .forEach((e) => {
        const p = seed.payments.find((x) => x.id === e.paymentId);
        expect(p?.method).toBe("wallet");
        expect(p?.amount).toBe(e.amount);
        expect(p?.episodeId).toBe(e.episodeId);
      });
  });

  it("splits every deposit so fees come out of the hospital share, never the patient's", () => {
    seed.settlements.forEach((s) => {
      const entry = seed.ledger.find((e) => e.id === s.entryId);
      expect(entry?.amount).toBe(s.gross);
      expect(s.gatewayFee + s.platformFee + s.hospitalNet).toBe(s.gross);
    });
  });

  it("covers the demo scenarios", () => {
    const names = seed.wallets.map((w) => w.name);
    expect(names).toEqual(expect.arrayContaining(["Okafor Family", "Musa Family", "Ibe Family", "Dr Joy Akpan"]));
    expect(seed.wallets.some((w) => !w.virtualAccount)).toBe(true); // awaiting BVN
    expect(seed.wallets.some((w) => !w.autoDebit)).toBe(true);
    expect(seed.wallets.some((w) => w.creditLimit > 0 && walletBalance(seed.ledger, w.id) < 0)).toBe(true);
  });
});

describe("fees", () => {
  it("caps the transfer fee and waives the card flat fee on small payments", () => {
    expect(gatewayFee(10_000, "bank-transfer", DEFAULT_GATEWAY_FEES)).toBe(100);
    expect(gatewayFee(1_000_000, "bank-transfer", DEFAULT_GATEWAY_FEES)).toBe(300);
    expect(gatewayFee(2_000, "card", DEFAULT_GATEWAY_FEES)).toBe(30);
    expect(gatewayFee(10_000, "card", DEFAULT_GATEWAY_FEES)).toBe(250);
    expect(gatewayFee(5_000_000, "card", DEFAULT_GATEWAY_FEES)).toBe(2_000);
    expect(gatewayFee(50_000, "cash", DEFAULT_GATEWAY_FEES)).toBe(0);
  });

  it("charges the platform fee on gateway payments only, with an optional cap", () => {
    expect(platformFee(40_000, "bank-transfer", 1, 0)).toBe(400);
    expect(platformFee(2_000_000, "card", 1.25, 5_000)).toBe(5_000);
    expect(platformFee(40_000, "cash", 1, 0)).toBe(0);
  });

  it("credits the patient the full amount: ₦40,000 shows as ₦40,000", () => {
    const split = splitPayment(40_000, "bank-transfer", DEFAULT_GATEWAY_FEES, 1, 0);
    expect(split).toEqual({ gross: 40_000, gatewayFee: 300, platformFee: 400, hospitalNet: 39_300 });
  });
});

describe("patient & family accounts", () => {
  beforeEach(async () => {
    setWriteBlock(null);
    await rootReset();
    loginAs("S13", "accountant");
  });

  it("debits the account automatically when a patient is billed (200 − 150 = 50 style)", () => {
    const w = walletNamed("Okafor Family");
    const before = balanceOf(w.id);
    const order = placeOrder(episodeOf("Adaobi").id, DRUG);
    expect(chargeFor(order.id)?.status).toBe("paid");
    expect(balanceOf(w.id)).toBe(before - 1_500);
    const entry = useWalletStore.getState().entries.at(-1);
    expect(entry).toMatchObject({ walletId: w.id, kind: "charge", direction: "debit", amount: 1_500 });
    expect(entry?.description).toMatch(/Folic acid/);
    const payment = useBillingStore.getState().payments.find((p) => p.id === entry?.paymentId);
    expect(payment?.method).toBe("wallet");
    expect(useAuditStore.getState().events.some((a) => a.entity === "wallet" && /Auto-debited/.test(a.summary))).toBe(
      true,
    );
    expect(useWalletStore.getState().messages.at(-1)?.body).toMatch(/debited/);
  });

  it("leaves the charge unpaid when there is no money, then settles it when a transfer arrives", () => {
    const w = walletNamed("Oghene Family");
    expect(balanceOf(w.id)).toBe(0);
    const order = placeOrder(episodeOf("Efe").id, { catalogCode: "LAB-AMH", qty: 1 });
    expect(chargeFor(order.id)?.status).toBe("unpaid");
    const owed = useBillingStore
      .getState()
      .charges.filter((c) => c.episodeId === episodeOf("Efe").id && isWalletPayable(c))
      .reduce((s, c) => s + c.amount - c.paid, 0);
    const result = useWalletStore.getState().receiveGatewayPayment({
      accountNumber: w.virtualAccount?.accountNumber ?? "",
      amount: owed + 40_000,
      channel: "bank-transfer",
      senderName: "Tobi Oghene",
      reference: "PSK_TEST_0001",
    });
    expect(result.status).toBe("credited");
    expect(chargeFor(order.id)?.status).toBe("paid");
    expect(balanceOf(w.id)).toBe(40_000);
    const settlement = useWalletStore.getState().settlements.find((s) => s.gatewayRef === "PSK_TEST_0001");
    expect(settlement?.gross).toBe(owed + 40_000);
    expect(settlement?.platformFee).toBe(Math.round((owed + 40_000) / 100));
  });

  it("never credits the same gateway reference twice", () => {
    const w = walletNamed("Okafor Family");
    const input = {
      accountNumber: w.virtualAccount?.accountNumber ?? "",
      amount: 100_000,
      channel: "bank-transfer" as const,
      senderName: "Chukwuma Okafor",
      reference: "PSK_DUP_42",
    };
    const before = balanceOf(w.id);
    expect(useWalletStore.getState().receiveGatewayPayment(input).status).toBe("credited");
    expect(useWalletStore.getState().receiveGatewayPayment(input).status).toBe("duplicate");
    expect(balanceOf(w.id)).toBe(before + 100_000);
  });

  it("part-pays from what is left, and a raised credit limit lets the rest through", () => {
    const w = walletNamed("Musa Family");
    const before = balanceOf(w.id);
    expect(before).toBe(8_500);
    const order = placeOrder(episodeOf("Hadiza").id, { catalogCode: "LAB-AMH", qty: 1 });
    expect(chargeFor(order.id)).toMatchObject({ status: "part-paid", paid: 8_500 });
    expect(balanceOf(w.id)).toBe(0);
    loginAs("S18", "admin");
    useWalletStore.getState().setCreditLimit(w.id, 50_000, "Long-standing patient; agreed by MD");
    expect(chargeFor(order.id)?.status).toBe("paid");
    expect(balanceOf(w.id)).toBe(-16_500);
    expect(() => useWalletStore.getState().setCreditLimit(w.id, 10_000, "Reduce limit please")).toThrow(/owes/);
  });

  it("returns the money to the account when a paid order is cancelled", () => {
    const w = walletNamed("Okafor Family");
    const ep = episodeOf("Adaobi");
    const before = balanceOf(w.id);
    const order = placeOrder(ep.id, { catalogCode: "LAB-FSH", qty: 1 });
    expect(balanceOf(w.id)).toBe(before - 8_000);
    cancelOrder(order.id, "Ordered twice");
    expect(balanceOf(w.id)).toBe(before);
    const b = useBillingStore.getState();
    expect(accountSummary(ep.id, b.charges, b.payments, b.refunds).balance).toBeLessThanOrEqual(0);
    expect(useWalletStore.getState().entries.at(-1)?.kind).toBe("reversal");
  });

  it("does not auto-debit when auto-debit is off; staff can pay on request", () => {
    const w = walletNamed("Dr Joy Akpan");
    const order = placeOrder(episodeOf("Joy").id, { catalogCode: "LAB-FSH", qty: 1 });
    expect(chargeFor(order.id)?.status).toBe("unpaid");
    const result = useWalletStore.getState().settle(w.id, "manual");
    expect(result.debited).toBeGreaterThanOrEqual(8_000);
    expect(chargeFor(order.id)?.status).toBe("paid");
  });

  it("refunds unspent balance only through approval, never beyond the balance", () => {
    const w = walletNamed("Okafor Family");
    const balance = balanceOf(w.id);
    const withdraw = (amount: number) =>
      useWalletStore.getState().requestWithdrawal(w.id, {
        amount,
        reason: "Treatment completed",
        bankName: "GTBank",
        accountNumber: "0123456789",
      });
    expect(() => withdraw(balance + 1)).toThrow(/can be refunded/);
    const request = withdraw(100_000);
    expect(balanceOf(w.id)).toBe(balance);
    expect(() => useRequestStore.getState().decide(request.id, true)).toThrow(/own request/);
    loginAs("S15", "manager");
    useRequestStore.getState().decide(request.id, true);
    expect(balanceOf(w.id)).toBe(balance - 100_000);
    expect(walletTotals(useWalletStore.getState().entries, w.id).withdrawn).toBeGreaterThanOrEqual(100_000);
  });

  it("keeps one account per person and protects the holder", () => {
    const okafor = walletNamed("Okafor Family");
    const musa = walletNamed("Musa Family");
    const member = musa.members.find((m) => m.personId !== musa.holderId);
    if (!member) throw new Error("no member");
    expect(() => useWalletStore.getState().addMember(okafor.id, member.personId, "Relative")).toThrow(
      /already belongs/,
    );
    expect(() => useWalletStore.getState().removeMember(okafor.id, okafor.holderId)).toThrow(/holder/);
  });

  it("opens a family account with an account number only when a BVN is given", () => {
    const tonye = usePersonStore.getState().persons.find((p) => p.firstName === "Tonye");
    const cookey = useWalletStore.getState().wallets.find((w) => w.members.some((m) => m.personId === tonye?.id));
    const someone = usePersonStore
      .getState()
      .persons.find(
        (p) =>
          p.roles.includes("patient") &&
          !useWalletStore.getState().wallets.some((w) => w.members.some((m) => m.personId === p.id)),
      );
    if (!someone) throw new Error("no unlinked patient");
    expect(cookey).toBeDefined();
    const base = {
      kind: "family" as const,
      name: `${someone.lastName} Family`,
      holderId: someone.id,
      members: [],
      autoDebit: true,
      lowBalanceAlert: 50_000,
    };
    expect(() => useWalletStore.getState().openWallet({ ...base, generateAccount: true, bvn: "" }, "BR-01")).toThrow(
      /BVN/,
    );
    const w = useWalletStore.getState().openWallet({ ...base, generateAccount: true, bvn: "22212345678" }, "BR-01");
    expect(w.virtualAccount?.accountNumber).toMatch(/^\d{10}$/);
    expect(w.bvnLast4).toBe("5678");
    expect(JSON.stringify(w)).not.toContain("22212345678");
    expect(w.code).toMatch(/^FAM-\d{6}$/);
  });

  it("blocks changes while the hospital is read-only", () => {
    setWriteBlock("Subscription payment is overdue, so the system is read-only");
    expect(() => placeOrder(episodeOf("Adaobi").id, DRUG)).toThrow(/read-only/);
    expect(() =>
      useWalletStore.getState().recordDeskDeposit(walletNamed("Okafor Family").id, { amount: 1_000, channel: "cash" }),
    ).toThrow(/read-only/);
    setWriteBlock(null);
  });
});
