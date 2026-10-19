import type { GatewayFees } from "@/lib/schemas/platform";
import type { DepositChannel } from "@/lib/schemas/wallet";

/** Demo defaults. Confirm against Paystack's published pricing before go-live; the super admin can edit these. */
export const DEFAULT_GATEWAY_FEES: GatewayFees = {
  transferPercent: 1,
  transferCap: 300,
  cardPercent: 1.5,
  cardFlat: 100,
  cardFlatWaivedBelow: 2_500,
  cardCap: 2_000,
};

export interface FeeBreakdown {
  gross: number;
  gatewayFee: number;
  platformFee: number;
  hospitalNet: number;
}

const naira = (n: number) => Math.round(n);

/** Gateway fee on one incoming payment. Cash and POS at the desk never touch the gateway. */
export function gatewayFee(amount: number, channel: DepositChannel, fees: GatewayFees): number {
  if (channel === "bank-transfer") {
    const fee = (amount * fees.transferPercent) / 100;
    return naira(fees.transferCap > 0 ? Math.min(fee, fees.transferCap) : fee);
  }
  if (channel === "card") {
    const flat = amount >= fees.cardFlatWaivedBelow ? fees.cardFlat : 0;
    const fee = (amount * fees.cardPercent) / 100 + flat;
    return naira(fees.cardCap > 0 ? Math.min(fee, fees.cardCap) : fee);
  }
  return 0;
}

/** Platform service charge (the super admin's revenue) on one gateway payment. */
export function platformFee(amount: number, channel: DepositChannel, percent: number, cap: number): number {
  if (channel === "cash" || channel === "pos") return 0;
  const fee = (amount * percent) / 100;
  return naira(cap > 0 ? Math.min(fee, cap) : fee);
}

/**
 * How one payment is split. The patient is always credited `gross`; both fees come out of what the hospital
 * receives, so a ₦40,000 transfer shows as ₦40,000 on the patient's account.
 */
export function splitPayment(
  amount: number,
  channel: DepositChannel,
  fees: GatewayFees,
  percent: number,
  cap: number,
): FeeBreakdown {
  const g = gatewayFee(amount, channel, fees);
  const p = platformFee(amount, channel, percent, cap);
  return { gross: amount, gatewayFee: g, platformFee: p, hospitalNet: amount - g - p };
}
