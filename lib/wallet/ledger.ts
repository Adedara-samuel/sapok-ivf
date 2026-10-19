import type { StaffRequest } from "@/lib/schemas/admin";
import type { Charge, PayerCategory } from "@/lib/schemas";
import type { Episode } from "@/lib/schemas/episode";
import type { LedgerEntry, Settlement, Wallet } from "@/lib/schemas/wallet";

/** Charges a patient account pays automatically. HMO and corporate charges are billed to the sponsor instead. */
export const WALLET_PAYERS: readonly PayerCategory[] = ["self-pay", "referral"];

export function isWalletPayable(charge: Pick<Charge, "payer" | "status">): boolean {
  return WALLET_PAYERS.includes(charge.payer) && (charge.status === "unpaid" || charge.status === "part-paid");
}

/** Balance = credits − debits. Never stored on its own; always computed from the ledger. */
export function walletBalance(entries: readonly LedgerEntry[], walletId: string): number {
  return entries
    .filter((e) => e.walletId === walletId)
    .reduce((s, e) => s + (e.direction === "credit" ? e.amount : -e.amount), 0);
}

export interface WalletTotals {
  received: number;
  spent: number;
  returned: number;
  withdrawn: number;
  balance: number;
}

export function walletTotals(entries: readonly LedgerEntry[], walletId: string): WalletTotals {
  const mine = entries.filter((e) => e.walletId === walletId);
  const sumOf = (kind: LedgerEntry["kind"]) => mine.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  const received = sumOf("deposit");
  const spent = sumOf("charge");
  const returned = sumOf("reversal");
  const withdrawn = sumOf("withdrawal");
  return { received, spent, returned, withdrawn, balance: received - spent + returned - withdrawn };
}

/** Wallet withdrawals awaiting approval (they reserve balance so it cannot be spent twice). */
export function pendingWithdrawals(requests: readonly StaffRequest[], walletId: string): number {
  return requests
    .filter((r) => r.kind === "wallet-refund" && r.entityId === walletId && r.status === "pending")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
}

/** What can still be spent: balance + credit limit − reserved withdrawals. */
export function availableToSpend(
  wallet: Pick<Wallet, "id" | "creditLimit">,
  entries: readonly LedgerEntry[],
  requests: readonly StaffRequest[] = [],
): number {
  return walletBalance(entries, wallet.id) + wallet.creditLimit - pendingWithdrawals(requests, wallet.id);
}

/** The active account a person belongs to (each person is in at most one active account). */
export function walletOfPerson(wallets: readonly Wallet[], personId: string | undefined): Wallet | undefined {
  if (!personId) return undefined;
  return wallets.find((w) => w.status !== "closed" && w.members.some((m) => m.personId === personId));
}

/** The account that pays an episode's bills: the patient's own account, otherwise the partner's. */
export function walletForEpisode(
  wallets: readonly Wallet[],
  episode: Pick<Episode, "patientId" | "partnerId">,
): Wallet | undefined {
  return walletOfPerson(wallets, episode.patientId) ?? walletOfPerson(wallets, episode.partnerId);
}

/** Outstanding wallet-payable amount on a set of episodes. */
export function outstandingFor(charges: readonly Charge[], episodeIds: ReadonlySet<string>): number {
  return charges
    .filter((c) => episodeIds.has(c.episodeId) && isWalletPayable(c))
    .reduce((s, c) => s + (c.amount - c.paid), 0);
}

/** Settlement state at a given time: gateway money lands in the hospital's bank the next working day. */
export function settlementState(
  s: Pick<Settlement, "status" | "settledAt">,
  nowIsoValue: string,
): Settlement["status"] {
  if (s.status === "collected-at-desk") return s.status;
  return s.settledAt && s.settledAt <= nowIsoValue ? "settled" : "pending";
}

/** Next working day 10:00 Lagos (09:00 UTC) after an instant, for settlement dates. */
export function nextSettlementDate(atIso: string): string {
  const d = new Date(atIso);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(9, 0, 0, 0);
  return d.toISOString();
}

/** International format for wa.me links: 08031234567 → 2348031234567. */
export function whatsappNumber(phone: string): string {
  return phone.startsWith("0") ? `234${phone.slice(1)}` : phone;
}
