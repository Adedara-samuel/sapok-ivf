import type { Charge, Episode, LedgerEntry, Person, Wallet } from "@/lib/schemas";
import type { DepositChannel } from "@/lib/schemas/wallet";
import { createRng } from "@/lib/seed/rng";
import type { SeedData } from "@/lib/seed/types";
import { pad } from "@/lib/utils/ids";
import { DEFAULT_GATEWAY_FEES, splitPayment } from "@/lib/wallet/fees";
import { isWalletPayable, nextSettlementDate } from "@/lib/wallet/ledger";
import { formatMoney } from "@/lib/utils/money";

const PLATFORM_FEE_PERCENT = 1; // matches the default hospital's platform fee

type Mode =
  | { kind: "target"; amount: number } // auto-debit on; topped up so the final balance is `amount`
  | { kind: "drain" } // auto-debit on; ran out of money, some charges unpaid
  | { kind: "credit"; limit: number } // auto-debit on; running on credit approved by the admin
  | { kind: "manual"; amount: number } // auto-debit off; charges wait for someone to authorise payment
  | { kind: "new" }; // just opened, waiting for the holder's BVN to issue an account number

interface Plan {
  name: string;
  kind: Wallet["kind"];
  /** First names of the female patients whose couples belong to the account. */
  couples: string[];
  holder: "female" | "male";
  mode: Mode;
  lowBalanceAlert: number;
  openedOffset?: number;
  /** Don't convert existing desk payments (account opened after they were made). */
  freshStart?: boolean;
}

const MS_MIN = 60_000;
const plusMinutes = (iso: string, minutes: number): string =>
  new Date(Date.parse(iso) + minutes * MS_MIN).toISOString();

/**
 * Adds patient & family accounts to the seed. Runs after billing is generated: payments of account holders are
 * re-labelled as account (wallet) payments, deposits are inserted before they were needed, and outstanding
 * charges are paid from the account exactly as the live auto-debit would — so every invariant holds on day one.
 */
export function addWalletSeed(data: SeedData, at: (offset: number, time?: string) => string): void {
  const rng = createRng(20261019);
  const counters: Record<string, number> = {};
  const sid = (prefix: string, width = 5) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return `${prefix}-${pad(counters[prefix], width)}`;
  };
  let receiptNo = data.payments.reduce((m, p) => Math.max(m, Number.parseInt(p.receiptNo.slice(4), 10) || 0), 0);
  const usedAccountNumbers = new Set<string>();
  const accountNumber = () => {
    for (;;) {
      const n = `${rng.pick(["99", "98", "97"])}${pad(rng.int(0, 99_999_999), 8)}`;
      if (!usedAccountNumbers.has(n)) {
        usedAccountNumbers.add(n);
        return n;
      }
    }
  };

  const selfPayFemales = data.persons.filter(
    (p) => p.roles.includes("patient") && (p.payer.category === "self-pay" || p.payer.category === "referral"),
  );
  const byFirst = (first: string) => selfPayFemales.find((p) => p.firstName === first);
  const generatedSelfPay = selfPayFemales.filter(
    (p) =>
      !["Adaobi", "Hadiza", "Efe", "Rukayat", "Joy", "Mercy", "Tonye"].includes(p.firstName) &&
      p.payer.category === "self-pay" &&
      data.episodes.some((e) => e.patientId === p.id && e.status !== "closed"),
  );
  const g = generatedSelfPay.map((p) => p.firstName);

  const plans: Plan[] = [
    {
      name: "Okafor Family",
      kind: "family",
      couples: ["Adaobi"],
      holder: "male",
      mode: { kind: "target", amount: 450_000 },
      lowBalanceAlert: 100_000,
    },
    {
      name: "Musa Family",
      kind: "family",
      couples: ["Hadiza"],
      holder: "female",
      mode: { kind: "target", amount: 8_500 },
      lowBalanceAlert: 50_000,
    },
    {
      name: "Oghene Family",
      kind: "family",
      couples: ["Efe"],
      holder: "male",
      mode: { kind: "drain" },
      lowBalanceAlert: 50_000,
    },
    {
      name: "Ibe Family",
      kind: "family",
      couples: ["Mercy"],
      holder: "male",
      mode: { kind: "credit", limit: 300_000 },
      lowBalanceAlert: 50_000,
    },
    {
      name: "Dr Joy Akpan",
      kind: "individual",
      couples: ["Joy"],
      holder: "female",
      mode: { kind: "manual", amount: 200_000 },
      lowBalanceAlert: 50_000,
    },
    {
      name: "Rukayat Adeniyi",
      kind: "individual",
      couples: ["Rukayat"],
      holder: "female",
      mode: { kind: "target", amount: 25_000 },
      lowBalanceAlert: 0,
    },
    {
      name: "Cookey Family",
      kind: "family",
      couples: ["Tonye"],
      holder: "male",
      mode: { kind: "target", amount: 150_000 },
      lowBalanceAlert: 50_000,
      openedOffset: 0,
    },
  ];
  if (g[0] && g[1])
    plans.push({
      name: `${byFirst(g[0])?.lastName ?? "Extended"} Extended Family`,
      kind: "family",
      couples: [g[0], g[1]],
      holder: "male",
      mode: { kind: "target", amount: 1_200_000 },
      lowBalanceAlert: 200_000,
    });
  if (g[2])
    plans.push({
      name: `${byFirst(g[2])?.lastName ?? "New"} Family`,
      kind: "family",
      couples: [g[2]],
      holder: "female",
      mode: { kind: "new" },
      lowBalanceAlert: 50_000,
      openedOffset: -1,
      freshStart: true,
    });

  const partnerOf = (female: Person): Person | undefined => {
    const ep = data.episodes.find((e) => e.patientId === female.id && e.partnerId);
    const partnerId = ep?.partnerId;
    if (partnerId) return data.persons.find((p) => p.id === partnerId);
    // couple without an episode yet: partner is the next of kin with the same surname
    return data.persons.find(
      (p) => p.roles.includes("partner") && p.lastName === female.lastName && p.phone === female.nextOfKin.phone,
    );
  };

  const wallets: Wallet[] = [];
  const entries: LedgerEntry[] = [];

  plans.forEach((plan, planIndex) => {
    const females = plan.couples.map(byFirst).filter((p): p is Person => Boolean(p));
    if (females.length === 0) return;
    const first = females[0] as Person;
    const firstPartner = partnerOf(first);
    const holder = plan.holder === "male" && firstPartner ? firstPartner : first;
    const episodes = data.episodes.filter((e) => females.some((f) => f.id === e.patientId));
    const episodeIds = new Set(episodes.map((e) => e.id));
    const openedAt = at(
      plan.openedOffset ?? Math.min(-1, ...episodes.map((e) => daysFrom(data.anchor, e.openedAt))),
      "08:45",
    );

    const members: Wallet["members"] = [];
    const addMember = (p: Person, relationship: Wallet["members"][number]["relationship"]) => {
      if (!members.some((m) => m.personId === p.id))
        members.push({ personId: p.id, relationship, addedAt: openedAt, addedBy: "S16" });
    };
    addMember(holder, "Self");
    females.forEach((f, k) => {
      const partner = partnerOf(f);
      if (k === 0) {
        addMember(f, holder.id === f.id ? "Self" : "Wife");
        if (partner) addMember(partner, holder.id === partner.id ? "Self" : "Husband");
      } else {
        addMember(f, "Relative");
        if (partner) addMember(partner, "Relative");
      }
    });

    const id = `WAL-${pad(planIndex + 1, 4)}`;
    const hasAccount = plan.mode.kind !== "new";
    const wallet: Wallet = {
      id,
      code: `${plan.kind === "family" ? "FAM" : "IND"}-${pad(planIndex + 1, 6)}`,
      kind: plan.kind,
      name: plan.name,
      holderId: holder.id,
      members,
      virtualAccount: hasAccount
        ? {
            provider: "paystack",
            bankName: planIndex % 3 === 2 ? "Titan Bank (Paystack)" : "Wema Bank",
            accountNumber: accountNumber(),
            accountName: `OVERCARE IVF/${plan.name.toUpperCase()}`.slice(0, 40),
            customerCode: `CUS_${pad(rng.int(1, 9_999_999), 7)}${planIndex}`,
            assignedAt: plusMinutes(openedAt, 3),
          }
        : undefined,
      bvnLast4: hasAccount ? pad(rng.int(0, 9999), 4) : undefined,
      autoDebit: plan.mode.kind !== "manual",
      creditLimit: plan.mode.kind === "credit" ? plan.mode.limit : 0,
      lowBalanceAlert: plan.lowBalanceAlert,
      consent: hasAccount
        ? { signerName: `${holder.firstName} ${holder.lastName}`, signatureDataUrl: SIGNATURE, signedAt: openedAt }
        : undefined,
      status: "active",
      branchId: holder.branchId,
      createdAt: openedAt,
      createdBy: "S16",
    };
    wallets.push(wallet);

    const walletEntries: LedgerEntry[] = [];
    const debitFor = (paymentId: string, episode: Episode, amount: number, atIso: string, charges: Charge[]) => {
      walletEntries.push({
        id: sid("WLE"),
        walletId: id,
        kind: "charge",
        direction: "debit",
        amount,
        balanceAfter: 0,
        description:
          charges.length > 0 ? `Paid: ${charges.map((c) => c.description).join(", ")}` : `Charges on ${episode.ivfNo}`,
        personId: episode.patientId,
        episodeId: episode.id,
        paymentId,
        chargeIds: charges.map((c) => c.id),
        at: atIso,
        by: "S13",
      });
    };
    const deposit = (amount: number, atIso: string, channel: DepositChannel) => {
      const entryId = sid("WLE");
      const ref =
        channel === "bank-transfer" || channel === "card"
          ? `PSK_${channel === "card" ? "CRD" : "TRF"}_${pad(rng.int(0, 99_999_999), 8)}`
          : undefined;
      walletEntries.push({
        id: entryId,
        walletId: id,
        kind: "deposit",
        direction: "credit",
        amount,
        balanceAfter: 0,
        description:
          channel === "bank-transfer"
            ? `Bank transfer from ${holder.firstName} ${holder.lastName}`
            : channel === "card"
              ? "Card payment (Paystack)"
              : channel === "cash"
                ? "Cash deposit at front desk"
                : "POS deposit at front desk",
        channel,
        gatewayRef: ref,
        personId: holder.id,
        at: atIso,
        by: channel === "cash" || channel === "pos" ? "S13" : "SYSTEM",
      });
      const split = splitPayment(amount, channel, DEFAULT_GATEWAY_FEES, PLATFORM_FEE_PERCENT, 0);
      data.settlements.push({
        id: sid("STL"),
        walletId: id,
        entryId,
        channel,
        gatewayRef: ref,
        ...split,
        feePercent: channel === "cash" || channel === "pos" ? 0 : PLATFORM_FEE_PERCENT,
        status: channel === "cash" || channel === "pos" ? "collected-at-desk" : "settled",
        at: atIso,
        settledAt: channel === "cash" || channel === "pos" ? undefined : nextSettlementDate(atIso),
      });
    };

    // 1. existing desk payments of these episodes become account payments
    const converted = plan.freshStart
      ? []
      : data.payments
          .filter(
            (p) =>
              episodeIds.has(p.episodeId) &&
              ["cash", "pos", "transfer", "deposit"].includes(p.method) &&
              p.at >= openedAt,
          )
          .sort((a, b) => a.at.localeCompare(b.at));
    converted.forEach((p) => {
      p.method = "wallet";
      p.reference = wallet.code;
    });

    // 2. deposits arrive before each debit would overdraw the account
    let balance = 0;
    const channels: DepositChannel[] = ["bank-transfer", "bank-transfer", "card", "cash", "bank-transfer", "pos"];
    const creditFloor = plan.mode.kind === "credit" ? -plan.mode.limit * 0.4 : 0;
    const totalConverted = converted.reduce((s, p) => s + p.amount, 0);
    let spent = 0;
    converted.forEach((p) => {
      const episode = episodes.find((e) => e.id === p.episodeId) as Episode;
      const coverDeposits = plan.mode.kind !== "credit" || spent < totalConverted * 0.5;
      const beyondLimit = balance - p.amount < -wallet.creditLimit;
      if ((coverDeposits && balance - p.amount < creditFloor) || beyondLimit) {
        const need = p.amount - balance;
        deposit(Math.ceil(Math.max(need, 100_000) / 50_000) * 50_000, plusMinutes(p.at, -45), rng.pick(channels));
        balance = walletEntries.reduce((s, e) => s + (e.direction === "credit" ? e.amount : -e.amount), 0);
      }
      debitFor(p.id, episode, p.amount, p.at, []);
      balance -= p.amount;
      spent += p.amount;
    });

    // 3. final top-up so outstanding charges are covered and the target balance remains
    const outstanding = data.charges
      .filter((c) => episodeIds.has(c.episodeId) && isWalletPayable(c))
      .sort((a, b) => a.at.localeCompare(b.at));
    const due = outstanding.reduce((s, c) => s + (c.amount - c.paid), 0);
    const lastTime = [openedAt, ...converted.map((p) => p.at), ...outstanding.map((c) => c.at)].sort().at(-1) as string;
    const topUpAt = plusMinutes(lastTime, 10);
    if (plan.mode.kind === "target" || plan.mode.kind === "manual") {
      const target = plan.mode.amount + (plan.mode.kind === "target" ? due : 0);
      if (target > balance) {
        deposit(target - balance, topUpAt, plan.openedOffset === 0 ? "bank-transfer" : rng.pick(channels));
        balance = target;
      }
    }

    // 4. auto-debit pays what it can (oldest first), the same way the live store does
    if (wallet.autoDebit && plan.mode.kind !== "new") {
      let available = balance + wallet.creditLimit;
      const byEpisode = new Map<string, Charge[]>();
      outstanding.forEach((c) => byEpisode.set(c.episodeId, [...(byEpisode.get(c.episodeId) ?? []), c]));
      let k = 0;
      byEpisode.forEach((charges, episodeId) => {
        if (available <= 0) return;
        const episode = episodes.find((e) => e.id === episodeId) as Episode;
        let take = Math.min(
          charges.reduce((s, c) => s + c.amount - c.paid, 0),
          available,
        );
        if (take <= 0) return;
        const paidAt = plusMinutes(topUpAt, 5 + k);
        k += 1;
        const covered: Charge[] = [];
        let remaining = take;
        charges.forEach((c) => {
          if (remaining <= 0) return;
          const part = Math.min(c.amount - c.paid, remaining);
          c.paid += part;
          remaining -= part;
          c.status = c.paid >= c.amount ? "paid" : "part-paid";
          covered.push(c);
        });
        take -= remaining;
        receiptNo += 1;
        const paymentId = sid("PAYW");
        data.payments.push({
          id: paymentId,
          episodeId,
          amount: take,
          method: "wallet",
          reference: wallet.code,
          receiptNo: `RCP-${pad(receiptNo, 6)}`,
          receivedBy: "S13",
          at: paidAt,
        });
        debitFor(paymentId, episode, take, paidAt, covered);
        available -= take;
        balance -= take;
      });
    }

    // 5. running balances in time order
    walletEntries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    let running = 0;
    walletEntries.forEach((e) => {
      running += e.direction === "credit" ? e.amount : -e.amount;
      e.balanceAfter = running;
    });
    entries.push(...walletEntries);

    // 6. messages the holder received
    walletEntries.slice(-3).forEach((e) => {
      data.walletMessages.push({
        id: sid("WMS"),
        walletId: id,
        channel: "whatsapp",
        to: holder.phone,
        body:
          e.direction === "credit"
            ? `Overcare IVF: ${formatMoney(e.amount)} received into ${wallet.name} (${wallet.code}). Balance: ${formatMoney(e.balanceAfter)}.`
            : `Overcare IVF: ${formatMoney(e.amount)} debited from ${wallet.name} — ${e.description.replace(/^Paid: /, "")}. Balance: ${formatMoney(e.balanceAfter)}.`,
        at: plusMinutes(e.at, 1),
      });
    });
    data.audit.push({
      id: sid("AUDW"),
      at: openedAt,
      actorId: "S16",
      action: "create",
      entity: "wallet",
      entityId: id,
      summary: `Opened ${plan.kind} account ${wallet.code} (${wallet.name})`,
    });
  });

  data.wallets = wallets;
  data.ledger = entries;
  data.payments.sort((a, b) => a.at.localeCompare(b.at));
  data.audit.sort((a, b) => a.at.localeCompare(b.at));
}

function daysFrom(anchor: string, isoDate: string): number {
  return Math.round((Date.parse(isoDate.slice(0, 10)) - Date.parse(anchor)) / 86_400_000);
}

// Small neutral signature stroke (SVG) used for the seed's auto-debit consents.
const SIGNATURE =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='60'%3E%3Cpath d='M10 40 C40 10 60 50 90 30 S140 20 160 35 210 30 230 20' fill='none' stroke='%230F1F20' stroke-width='2'/%3E%3C/svg%3E";
