import { APP_CONFIG } from "@/lib/config";

const formatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${APP_CONFIG.currencySymbol}${formatter.format(Math.abs(Math.round(amount)))}`;
}

export function formatCompactMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${APP_CONFIG.currencySymbol}${(amount / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${APP_CONFIG.currencySymbol}${Math.round(amount / 1_000)}k`;
  return formatMoney(amount);
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
