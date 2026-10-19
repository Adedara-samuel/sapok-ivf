import type { Settlement, Wallet } from "@/lib/schemas/wallet";
import { readTenantStore } from "@/lib/tenancy";

export interface TenantMoney {
  /** False when the hospital has never been opened in this browser (no data yet). */
  opened: boolean;
  settlements: Settlement[];
  accounts: number;
  gross: number;
  gatewayFees: number;
  platformFees: number;
  hospitalNet: number;
}

/**
 * A hospital's payment figures, read from its own data. In production this is a SQL aggregate over the
 * settlements table grouped by tenant_id; in the demo each hospital's data lives under its own storage key.
 */
export function tenantMoney(slug: string, range?: { from: string; to: string }): TenantMoney {
  const state = readTenantStore<{ settlements?: Settlement[]; wallets?: Wallet[] }>(slug, "wallet");
  const settlements = (state?.settlements ?? []).filter(
    (s) => !range || (s.at.slice(0, 10) >= range.from && s.at.slice(0, 10) <= range.to),
  );
  const sum = (k: "gross" | "gatewayFee" | "platformFee" | "hospitalNet") => settlements.reduce((a, s) => a + s[k], 0);
  return {
    opened: state !== null,
    settlements,
    accounts: state?.wallets?.length ?? 0,
    gross: sum("gross"),
    gatewayFees: sum("gatewayFee"),
    platformFees: sum("platformFee"),
    hospitalNet: sum("hospitalNet"),
  };
}
