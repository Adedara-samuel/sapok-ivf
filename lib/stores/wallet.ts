import { z } from "zod";
import type { StaffRequest } from "@/lib/schemas/admin";
import type { Charge } from "@/lib/schemas/billing";
import { fullName, type Person } from "@/lib/schemas/person";
import {
  DepositChannel,
  ledgerEntrySchema,
  RELATIONSHIPS,
  settlementSchema,
  walletConsentSchema,
  walletMessageSchema,
  walletSchema,
  type LedgerEntry,
  type Settlement,
  type VirtualAccount,
  type Wallet,
  type WalletMessage,
} from "@/lib/schemas/wallet";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { useBillingStore, unallocatedCredit, walletFundedNet } from "@/lib/stores/billing";
import { assert, assertWritable, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useNotificationStore } from "@/lib/stores/notifications";
import { usePersonStore } from "@/lib/stores/person";
import { usePlatformStore } from "@/lib/stores/platform";
import { useRequestStore } from "@/lib/stores/requests";
import { currentActorId } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { activeTenantSlug } from "@/lib/tenancy";
import { nowIso } from "@/lib/utils/dates";
import { newId, nextSequence } from "@/lib/utils/ids";
import { formatMoney } from "@/lib/utils/money";
import { splitPayment } from "@/lib/wallet/fees";
import {
  availableToSpend,
  isWalletPayable,
  nextSettlementDate,
  pendingWithdrawals,
  walletBalance,
  walletForEpisode,
  walletOfPerson,
} from "@/lib/wallet/ledger";

// ------------------------------------------------------------------ input schemas

const bvn = z.string().regex(/^\d{11}$/, "BVN has 11 digits");

export const openWalletSchema = z
  .object({
    kind: z.enum(["individual", "family"]),
    name: z.string().trim().min(3, "Give the account a name (at least 3 characters)"),
    holderId: z.string().min(1, "Choose the account holder"),
    members: z.array(z.object({ personId: z.string().min(1), relationship: z.enum(RELATIONSHIPS) })),
    bvn: bvn.optional().or(z.literal("")),
    generateAccount: z.boolean(),
    autoDebit: z.boolean(),
    lowBalanceAlert: z.number({ error: "Enter an amount" }).min(0, "Cannot be negative"),
  })
  .refine((v) => !v.generateAccount || (v.bvn && v.bvn.length === 11), {
    message: "Enter the account holder's 11-digit BVN to issue an account number",
    path: ["bvn"],
  })
  .refine((v) => v.kind === "family" || v.members.length === 0, {
    message: "An individual account has only the holder — choose Family to add members",
    path: ["members"],
  });
export type OpenWalletInput = z.infer<typeof openWalletSchema>;

export const walletSettingsSchema = z.object({
  name: z.string().trim().min(3, "Give the account a name (at least 3 characters)"),
  autoDebit: z.boolean(),
  lowBalanceAlert: z.number({ error: "Enter an amount" }).min(0, "Cannot be negative"),
});
export type WalletSettingsInput = z.infer<typeof walletSettingsSchema>;

export const deskDepositSchema = z
  .object({
    amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero").max(50_000_000),
    channel: z.enum(["cash", "pos"]),
    reference: z.string().optional(),
  })
  .refine((v) => v.channel !== "pos" || (v.reference ?? "").trim().length >= 4, {
    message: "Enter the POS slip reference",
    path: ["reference"],
  });
export type DeskDepositInput = z.infer<typeof deskDepositSchema>;

export const gatewayPaymentSchema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/, "Enter the 10-digit account number"),
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero").max(50_000_000),
  channel: z.enum(["bank-transfer", "card"]),
  senderName: z.string().trim().min(3, "Enter the sender's name"),
  senderBank: z.string().optional(),
  reference: z.string().trim().min(6, "Every gateway payment has a reference"),
});
export type GatewayPaymentInput = z.infer<typeof gatewayPaymentSchema>;

export const withdrawalSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Enter an amount greater than zero"),
  reason: z.string().trim().min(5, "Explain the refund (at least 5 characters)"),
  bankName: z.string().trim().min(3, "Enter the bank the money goes to"),
  accountNumber: z.string().regex(/^\d{10}$/, "Enter the 10-digit account number"),
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

// ------------------------------------------------------------------ helpers

const VA_BANKS = ["Wema Bank", "Titan Bank (Paystack)"] as const;

function personOrThrow(id: string): Person {
  const p = usePersonStore.getState().persons.find((x) => x.id === id);
  if (!p) throw new DomainError("Person not found");
  return p;
}

function tenantFees() {
  const platform = usePlatformStore.getState();
  const tenant = platform.tenants.find((t) => t.slug === activeTenantSlug());
  return {
    gateway: platform.gatewayFees,
    percent: tenant?.feePercent ?? 1,
    cap: tenant?.feeCap ?? 0,
    name: tenant?.name,
  };
}

function staffIdsWithRole(roles: string[]): string[] {
  return useStaffStore
    .getState()
    .staff.filter((s) => s.active && roles.includes(s.role))
    .map((s) => s.id);
}

export type SettleTrigger = "charge" | "deposit" | "manual" | "member" | "credit-limit" | "settings";

export interface SettleResult {
  debited: number;
  stillOwed: number;
}

export interface WalletState {
  wallets: Wallet[];
  entries: LedgerEntry[];
  settlements: Settlement[];
  messages: WalletMessage[];
  openWallet: (input: OpenWalletInput, branchId: string) => Wallet;
  issueAccountNumber: (walletId: string, bvnValue: string) => Wallet;
  addMember: (walletId: string, personId: string, relationship: Wallet["members"][number]["relationship"]) => Wallet;
  removeMember: (walletId: string, personId: string) => Wallet;
  updateSettings: (walletId: string, input: WalletSettingsInput) => Wallet;
  setCreditLimit: (walletId: string, limit: number, reason: string) => Wallet;
  signConsent: (walletId: string, input: { signerName: string; signatureDataUrl: string }) => Wallet;
  setFrozen: (walletId: string, frozen: boolean, reason: string) => Wallet;
  /** Gateway webhook (charge.success / dedicated account transfer). Idempotent on the reference. */
  receiveGatewayPayment: (input: GatewayPaymentInput) => { status: "credited" | "duplicate"; entry: LedgerEntry };
  recordDeskDeposit: (walletId: string, input: DeskDepositInput) => LedgerEntry;
  /** Pay outstanding charges of the account's members from its balance, oldest first. */
  settle: (walletId: string, trigger: SettleTrigger) => SettleResult;
  /** Called after a charge is raised on an episode. */
  autoDebitEpisode: (episodeId: string) => SettleResult | null;
  /** Called after a charge is waived: wallet-funded credit goes back to the account. */
  returnEpisodeCredit: (episodeId: string, reason: string) => number;
  requestWithdrawal: (walletId: string, input: WithdrawalInput) => StaffRequest;
  applyWithdrawalDecision: (request: StaffRequest) => void;
  reset: (seed: SeedData) => void;
}

export const useWalletStore = createDomainStore<WalletState>("wallet", (set, get) => {
  const find = (id: string): Wallet => {
    const w = get().wallets.find((x) => x.id === id);
    if (!w) throw new DomainError("Account not found");
    return w;
  };
  const replace = (next: Wallet) =>
    set((s) => {
      s.wallets[s.wallets.findIndex((w) => w.id === next.id)] = next;
    });

  const pushEntry = (input: Omit<LedgerEntry, "id" | "balanceAfter" | "at" | "by"> & { by?: string }): LedgerEntry => {
    const balance = walletBalance(get().entries, input.walletId);
    const entry = validate(ledgerEntrySchema, {
      ...input,
      id: newId("WLE"),
      balanceAfter: balance + (input.direction === "credit" ? input.amount : -input.amount),
      at: nowIso(),
      by: input.by ?? currentActorId(),
    });
    set((s) => {
      s.entries.push(entry);
    });
    return entry;
  };

  const message = (wallet: Wallet, body: string) => {
    const holder = usePersonStore.getState().persons.find((p) => p.id === wallet.holderId);
    const m = validate(walletMessageSchema, {
      id: newId("WMS"),
      walletId: wallet.id,
      channel: "whatsapp",
      to: holder?.phone ?? "—",
      body,
      at: nowIso(),
    });
    set((s) => {
      s.messages.push(m);
    });
  };

  const clinicName = () => useSettingsStore.getState().clinic.clinicName;

  const virtualAccountFor = (wallet: Pick<Wallet, "name" | "id">): VirtualAccount => {
    const used = new Set(get().wallets.map((w) => w.virtualAccount?.accountNumber));
    let number = "";
    do {
      number = `99${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`;
    } while (used.has(number));
    return {
      provider: "paystack",
      bankName: VA_BANKS[get().wallets.length % VA_BANKS.length] ?? "Wema Bank",
      accountNumber: number,
      accountName: `${clinicName().toUpperCase()}/${wallet.name.toUpperCase()}`.slice(0, 40),
      customerCode: `CUS_${Math.random().toString(36).slice(2, 12)}`,
      assignedAt: nowIso(),
    };
  };

  const lowBalanceCheck = (wallet: Wallet, before: number) => {
    const after = walletBalance(get().entries, wallet.id);
    if (wallet.lowBalanceAlert > 0 && after < wallet.lowBalanceAlert && before >= wallet.lowBalanceAlert) {
      message(
        wallet,
        `${clinicName()}: ${wallet.name} balance is low (${formatMoney(after)}). Transfer to ${wallet.virtualAccount ? `${wallet.virtualAccount.bankName} ${wallet.virtualAccount.accountNumber}` : "the hospital"} to avoid delays in treatment.`,
      );
      staffIdsWithRole(["accountant"]).forEach((userId) =>
        useNotificationStore.getState().push({
          userId,
          title: "Low account balance",
          body: `${wallet.name} (${wallet.code}) is down to ${formatMoney(after)}.`,
          href: `/accounts/${wallet.id}`,
        }),
      );
    }
  };

  return {
    wallets: [],
    entries: [],
    settlements: [],
    messages: [],

    openWallet: (input, branchId) => {
      assertWritable();
      const v = validate(openWalletSchema, input);
      const holder = personOrThrow(v.holderId);
      const memberInputs = [
        { personId: holder.id, relationship: "Self" as const },
        ...v.members.filter((m) => m.personId !== holder.id),
      ];
      const ids = new Set<string>();
      memberInputs.forEach((m) => {
        assert(!ids.has(m.personId), "A person can only be listed once", "members");
        ids.add(m.personId);
        const p = personOrThrow(m.personId);
        const existing = walletOfPerson(get().wallets, p.id);
        assert(
          !existing,
          `${fullName(p)} already belongs to ${existing?.name} (${existing?.code}). Remove them there first.`,
          m.personId === holder.id ? "holderId" : "members",
        );
      });
      const prefix = v.kind === "family" ? "FAM-" : "IND-";
      const at = nowIso();
      const draft = {
        id: newId("WAL"),
        code: nextSequence(
          get().wallets.map((w) => w.code),
          prefix,
          6,
        ),
        name: v.name,
      };
      const wallet = validate(walletSchema, {
        ...draft,
        kind: v.kind,
        holderId: holder.id,
        members: memberInputs.map((m) => ({ ...m, addedAt: at, addedBy: currentActorId() })),
        virtualAccount: v.generateAccount ? virtualAccountFor(draft) : undefined,
        bvnLast4: v.bvn ? v.bvn.slice(-4) : undefined,
        autoDebit: v.autoDebit,
        creditLimit: 0,
        lowBalanceAlert: v.lowBalanceAlert,
        status: "active",
        branchId,
        createdAt: at,
        createdBy: currentActorId(),
      });
      set((s) => {
        s.wallets.push(wallet);
      });
      audit(
        "create",
        "wallet",
        `Opened ${wallet.kind} account ${wallet.code} (${wallet.name}) for ${memberInputs.length} member(s)${wallet.virtualAccount ? ` — account no. ${wallet.virtualAccount.accountNumber}` : ""}`,
        wallet.id,
      );
      if (wallet.virtualAccount)
        message(
          wallet,
          `${clinicName()}: your account ${wallet.name} is ready. Pay by transfer to ${wallet.virtualAccount.bankName} ${wallet.virtualAccount.accountNumber} (${wallet.virtualAccount.accountName}). Treatment bills are deducted automatically and you get a message for every deduction.`,
        );
      return wallet;
    },

    issueAccountNumber: (walletId, bvnValue) => {
      assertWritable();
      const w = find(walletId);
      assert(!w.virtualAccount, "This account already has an account number");
      assert(/^\d{11}$/.test(bvnValue), "BVN has 11 digits", "bvn");
      const next = validate(walletSchema, { ...w, virtualAccount: virtualAccountFor(w), bvnLast4: bvnValue.slice(-4) });
      replace(next);
      audit("update", "wallet", `Issued account number ${next.virtualAccount?.accountNumber} to ${w.code}`, w.id);
      message(
        next,
        `${clinicName()}: transfer to ${next.virtualAccount?.bankName} ${next.virtualAccount?.accountNumber} to fund ${next.name}.`,
      );
      return next;
    },

    addMember: (walletId, personId, relationship) => {
      assertWritable();
      const w = find(walletId);
      assert(w.status === "active", "This account is not active");
      assert(w.kind === "family", "Only family accounts can have more members — convert by opening a family account");
      const p = personOrThrow(personId);
      const existing = walletOfPerson(get().wallets, personId);
      assert(!existing, `${fullName(p)} already belongs to ${existing?.name} (${existing?.code})`, "personId");
      const next = validate(walletSchema, {
        ...w,
        members: [...w.members, { personId, relationship, addedAt: nowIso(), addedBy: currentActorId() }],
      });
      replace(next);
      audit("update", "wallet", `Linked ${fullName(p)} (${p.prn}) to ${w.code} as ${relationship}`, w.id);
      if (next.autoDebit) get().settle(walletId, "member");
      return next;
    },

    removeMember: (walletId, personId) => {
      assertWritable();
      const w = find(walletId);
      assert(personId !== w.holderId, "The account holder cannot be removed");
      const p = personOrThrow(personId);
      assert(
        w.members.some((m) => m.personId === personId),
        `${fullName(p)} is not a member of this account`,
      );
      const next = validate(walletSchema, { ...w, members: w.members.filter((m) => m.personId !== personId) });
      replace(next);
      audit("update", "wallet", `Removed ${fullName(p)} (${p.prn}) from ${w.code}`, w.id);
      return next;
    },

    updateSettings: (walletId, input) => {
      assertWritable();
      const v = validate(walletSettingsSchema, input);
      const w = find(walletId);
      const next = validate(walletSchema, { ...w, ...v });
      replace(next);
      const changes = [
        w.name !== v.name ? `name → ${v.name}` : null,
        w.autoDebit !== v.autoDebit ? `auto-debit ${v.autoDebit ? "ON" : "OFF"}` : null,
        w.lowBalanceAlert !== v.lowBalanceAlert ? `low-balance alert → ${formatMoney(v.lowBalanceAlert)}` : null,
      ].filter(Boolean);
      audit("update", "wallet", `Updated ${w.code}: ${changes.join(", ") || "no changes"}`, w.id);
      if (!w.autoDebit && v.autoDebit) get().settle(walletId, "settings");
      return next;
    },

    setCreditLimit: (walletId, limit, reason) => {
      assertWritable();
      assert(Number.isFinite(limit) && limit >= 0, "Credit limit cannot be negative", "creditLimit");
      assert(limit <= 20_000_000, "Credit limit is too large", "creditLimit");
      assert(reason.trim().length >= 5, "Give a reason (at least 5 characters)", "reason");
      const w = find(walletId);
      const balance = walletBalance(get().entries, walletId);
      assert(
        balance >= -limit,
        `The account already owes ${formatMoney(-balance)}; the limit cannot be lower than that`,
        "creditLimit",
      );
      const next = validate(walletSchema, { ...w, creditLimit: limit });
      replace(next);
      audit(
        "approve",
        "wallet",
        `Credit limit of ${w.code} changed ${formatMoney(w.creditLimit)} → ${formatMoney(limit)}: ${reason.trim()}`,
        w.id,
      );
      if (next.autoDebit && limit > w.creditLimit) get().settle(walletId, "credit-limit");
      return next;
    },

    signConsent: (walletId, input) => {
      assertWritable();
      const w = find(walletId);
      const consent = validate(walletConsentSchema, { ...input, signedAt: nowIso() });
      replace(validate(walletSchema, { ...w, consent }));
      audit("sign", "wallet", `${consent.signerName} signed the auto-debit authorisation for ${w.code}`, w.id);
      return find(walletId);
    },

    setFrozen: (walletId, frozen, reason) => {
      assertWritable();
      assert(reason.trim().length >= 5, "Give a reason (at least 5 characters)", "reason");
      const w = find(walletId);
      assert(w.status !== "closed", "This account is closed");
      const next = validate(walletSchema, { ...w, status: frozen ? "frozen" : "active" });
      replace(next);
      audit("update", "wallet", `${frozen ? "Froze" : "Unfroze"} ${w.code}: ${reason.trim()}`, w.id);
      return next;
    },

    receiveGatewayPayment: (input) => {
      const v = validate(gatewayPaymentSchema, input);
      const duplicate = get().entries.find((e) => e.gatewayRef === v.reference);
      if (duplicate) {
        audit(
          "view",
          "wallet",
          `Ignored duplicate gateway notification ${v.reference} (already credited)`,
          duplicate.walletId,
        );
        return { status: "duplicate", entry: duplicate };
      }
      const wallet = get().wallets.find((w) => w.virtualAccount?.accountNumber === v.accountNumber);
      if (!wallet)
        throw new DomainError("No patient account has this account number", {
          accountNumber: "Unknown account number",
        });
      assert(wallet.status !== "closed", "This account is closed — the transfer must be reversed by the gateway");
      const before = walletBalance(get().entries, wallet.id);
      const entry = pushEntry({
        walletId: wallet.id,
        kind: "deposit",
        direction: "credit",
        amount: v.amount,
        description: `${v.channel === "card" ? "Card payment" : "Bank transfer"} from ${v.senderName}${v.senderBank ? ` (${v.senderBank})` : ""}`,
        channel: v.channel,
        gatewayRef: v.reference,
        by: "SYSTEM",
      });
      const fees = tenantFees();
      const split = splitPayment(v.amount, v.channel, fees.gateway, fees.percent, fees.cap);
      const settlement = validate(settlementSchema, {
        id: newId("STL"),
        walletId: wallet.id,
        entryId: entry.id,
        channel: v.channel,
        gatewayRef: v.reference,
        ...split,
        feePercent: fees.percent,
        status: "pending",
        at: entry.at,
        settledAt: nextSettlementDate(entry.at),
      });
      set((s) => {
        s.settlements.push(settlement);
      });
      audit(
        "create",
        "payment",
        `${formatMoney(v.amount)} received into ${wallet.code} via ${v.channel === "card" ? "card" : "bank transfer"} (ref ${v.reference})`,
        wallet.id,
      );
      message(
        wallet,
        `${clinicName()}: ${formatMoney(v.amount)} received into ${wallet.name}. Balance: ${formatMoney(entry.balanceAfter)}.`,
      );
      if (wallet.autoDebit && wallet.status === "active") get().settle(wallet.id, "deposit");
      lowBalanceCheck(wallet, before);
      return { status: "credited", entry };
    },

    recordDeskDeposit: (walletId, input) => {
      assertWritable();
      const v = validate(deskDepositSchema, input);
      const wallet = find(walletId);
      assert(wallet.status === "active", "This account is not active");
      const entry = pushEntry({
        walletId,
        kind: "deposit",
        direction: "credit",
        amount: v.amount,
        description: v.channel === "cash" ? "Cash deposit at front desk" : `POS deposit (slip ${v.reference?.trim()})`,
        channel: v.channel,
      });
      const settlement = validate(settlementSchema, {
        id: newId("STL"),
        walletId,
        entryId: entry.id,
        channel: v.channel,
        gross: v.amount,
        gatewayFee: 0,
        platformFee: 0,
        hospitalNet: v.amount,
        feePercent: 0,
        status: "collected-at-desk",
        at: entry.at,
      });
      set((s) => {
        s.settlements.push(settlement);
      });
      audit("create", "payment", `Desk deposit ${formatMoney(v.amount)} (${v.channel}) into ${wallet.code}`, walletId);
      message(
        wallet,
        `${clinicName()}: ${formatMoney(v.amount)} ${v.channel} deposit received into ${wallet.name}. Balance: ${formatMoney(entry.balanceAfter)}.`,
      );
      if (wallet.autoDebit) get().settle(walletId, "deposit");
      return entry;
    },

    settle: (walletId, trigger) => {
      const wallet = find(walletId);
      const episodes = useEpisodeStore.getState().episodes;
      const billing = useBillingStore.getState();
      const myEpisodes = episodes.filter((e) => walletForEpisode(get().wallets, e)?.id === walletId);
      const episodeIds = new Set(myEpisodes.map((e) => e.id));
      const payable = billing.charges
        .filter((c) => episodeIds.has(c.episodeId) && isWalletPayable(c))
        .sort((a, b) => a.at.localeCompare(b.at));
      const owed = () =>
        useBillingStore
          .getState()
          .charges.filter((c) => episodeIds.has(c.episodeId) && isWalletPayable(c))
          .reduce((s, c) => s + c.amount - c.paid, 0);
      if (wallet.status !== "active" || payable.length === 0) return { debited: 0, stillOwed: owed() };
      if (trigger !== "manual") assert(wallet.autoDebit, "Auto-debit is off for this account");

      const before = walletBalance(get().entries, walletId);
      let available = availableToSpend(wallet, get().entries, useRequestStore.getState().requests);
      const order: string[] = [];
      payable.forEach((c) => {
        if (!order.includes(c.episodeId)) order.push(c.episodeId);
      });
      const prefix = useSettingsStore.getState().clinic.receiptPrefix;
      let debited = 0;
      const lines: string[] = [];
      order.forEach((episodeId) => {
        if (available <= 0) return;
        const due = useBillingStore
          .getState()
          .charges.filter((c) => c.episodeId === episodeId && isWalletPayable(c))
          .reduce((s, c) => s + c.amount - c.paid, 0);
        const take = Math.min(due, available);
        if (take <= 0) return;
        const paidBefore = new Map(useBillingStore.getState().charges.map((c) => [c.id, c.paid]));
        const payment = useBillingStore
          .getState()
          .recordPayment(episodeId, { amount: take, method: "wallet", reference: wallet.code }, prefix);
        const covered: Charge[] = useBillingStore
          .getState()
          .charges.filter((c) => c.episodeId === episodeId && c.paid > (paidBefore.get(c.id) ?? 0));
        const episode = myEpisodes.find((e) => e.id === episodeId);
        const patient = usePersonStore.getState().persons.find((p) => p.id === episode?.patientId);
        const description = covered.length > 0 ? `Paid: ${covered.map((c) => c.description).join(", ")}` : "Charges";
        pushEntry({
          walletId,
          kind: "charge",
          direction: "debit",
          amount: take,
          description: `${description}${patient ? ` — ${fullName(patient)}` : ""}`,
          personId: episode?.patientId,
          episodeId,
          paymentId: payment.id,
          chargeIds: covered.map((c) => c.id),
        });
        lines.push(`${formatMoney(take)} for ${covered.map((c) => c.description).join(", ") || "charges"}`);
        available -= take;
        debited += take;
      });
      if (debited > 0) {
        const balance = walletBalance(get().entries, walletId);
        audit(
          "update",
          "wallet",
          `Auto-debited ${formatMoney(debited)} from ${wallet.code} (${trigger}); balance ${formatMoney(balance)}`,
          walletId,
        );
        message(
          wallet,
          `${clinicName()}: ${lines.join("; ")} debited from ${wallet.name}. Available balance: ${formatMoney(balance)}.`,
        );
      }
      const stillOwed = owed();
      if (stillOwed > 0 && trigger === "charge")
        message(
          wallet,
          `${clinicName()}: ${formatMoney(stillOwed)} is waiting for payment on ${wallet.name}. Transfer to ${wallet.virtualAccount ? `${wallet.virtualAccount.bankName} ${wallet.virtualAccount.accountNumber}` : "the hospital"} and it will be settled automatically.`,
        );
      lowBalanceCheck(wallet, before);
      return { debited, stillOwed };
    },

    autoDebitEpisode: (episodeId) => {
      const episode = useEpisodeStore.getState().episodes.find((e) => e.id === episodeId);
      if (!episode) return null;
      const wallet = walletForEpisode(get().wallets, episode);
      if (!wallet || !wallet.autoDebit || wallet.status !== "active") return null;
      return get().settle(wallet.id, "charge");
    },

    returnEpisodeCredit: (episodeId, reason) => {
      const billing = useBillingStore.getState();
      const amount = Math.min(
        unallocatedCredit(episodeId, billing.charges, billing.payments, billing.refunds),
        walletFundedNet(episodeId, billing.payments, billing.refunds),
      );
      if (amount <= 0) return 0;
      const episode = useEpisodeStore.getState().episodes.find((e) => e.id === episodeId);
      const wallet = episode ? walletForEpisode(get().wallets, episode) : undefined;
      if (!wallet) return 0;
      billing.returnToWallet(episodeId, amount, reason);
      pushEntry({
        walletId: wallet.id,
        kind: "reversal",
        direction: "credit",
        amount,
        description: `Returned: ${reason}`,
        episodeId,
        personId: episode?.patientId,
      });
      message(
        wallet,
        `${clinicName()}: ${formatMoney(amount)} returned to ${wallet.name} (${reason}). Balance: ${formatMoney(walletBalance(get().entries, wallet.id))}.`,
      );
      if (wallet.autoDebit && wallet.status === "active") get().settle(wallet.id, "deposit");
      return amount;
    },

    requestWithdrawal: (walletId, input) => {
      assertWritable();
      const v = validate(withdrawalSchema, input);
      const wallet = find(walletId);
      const refundable =
        walletBalance(get().entries, walletId) - pendingWithdrawals(useRequestStore.getState().requests, walletId);
      assert(
        v.amount <= refundable,
        `Only ${formatMoney(Math.max(0, refundable))} of unspent balance can be refunded`,
        "amount",
      );
      const request = useRequestStore.getState().create({
        kind: "wallet-refund",
        title: `Refund ${formatMoney(v.amount)} from ${wallet.code} (${wallet.name})`,
        details: `${v.reason} — pay to ${v.bankName} ${v.accountNumber}`,
        amount: v.amount,
        entityId: walletId,
      });
      return request;
    },

    applyWithdrawalDecision: (request) => {
      if (request.kind !== "wallet-refund" || request.status !== "approved" || !request.entityId) return;
      const wallet = get().wallets.find((w) => w.id === request.entityId);
      if (!wallet || get().entries.some((e) => e.requestId === request.id)) return;
      const balance = walletBalance(get().entries, wallet.id);
      const amount = Math.min(request.amount ?? 0, Math.max(0, balance));
      if (amount <= 0) {
        audit("update", "wallet", `Approved refund on ${wallet.code} could not be paid: no balance left`, wallet.id);
        return;
      }
      pushEntry({
        walletId: wallet.id,
        kind: "withdrawal",
        direction: "debit",
        amount,
        description: `Refund paid out: ${request.details}`,
        requestId: request.id,
      });
      audit("update", "wallet", `Paid out approved refund of ${formatMoney(amount)} from ${wallet.code}`, wallet.id);
      message(
        wallet,
        `${clinicName()}: refund of ${formatMoney(amount)} from ${wallet.name} has been approved and sent to your bank.`,
      );
    },

    reset: (seed) =>
      set((s) => {
        s.wallets = seed.wallets;
        s.entries = seed.ledger;
        s.settlements = seed.settlements;
        s.messages = seed.walletMessages;
      }),
  };
});

export const DEPOSIT_CHANNEL_LABELS: Record<z.infer<typeof DepositChannel>, string> = {
  "bank-transfer": "Bank transfer",
  card: "Card",
  cash: "Cash",
  pos: "POS",
};
